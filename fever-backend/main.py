from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import List, Optional
import os
import json
import logging
import asyncio
import httpx
import base64
import io
from PIL import Image
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Fever Triage System",
    description="AI-powered fever diagnostics and triage system using Gemini AI",
    version="2.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gemini API configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    logger.warning("GEMINI_API_KEY not configured. Please add it to your .env file")

# Pydantic models
class PatientData(BaseModel):
    temperature: float = Field(..., ge=95.0, le=110.0, description="Temperature in Fahrenheit")
    duration_hours: int = Field(..., ge=1, le=720, description="Duration of fever in hours")
    symptoms: List[str] = Field(..., description="List of symptoms")
    age: int = Field(..., ge=0, le=120, description="Patient age in years")
    medical_history: Optional[str] = Field(None, description="Optional medical history")

    @validator('temperature')
    def validate_temperature(cls, v):
        if v < 95.0 or v > 110.0:
            raise ValueError('Temperature must be between 95.0 and 110.0 Fahrenheit')
        return v

class TriageResponse(BaseModel):
    severity: str = Field(..., description="Severity level: LOW/MEDIUM/HIGH/CRITICAL")
    diagnosis_suggestions: List[str] = Field(..., description="List of potential diagnoses")
    recommended_action: str = Field(..., description="Recommended action for patient")
    clinical_explanation: str = Field(..., description="Clinical reasoning and explanation")
    red_flags: List[str] = Field(..., description="List of concerning symptoms/signs")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="AI confidence score")

class ChatMessage(BaseModel):
    message: str = Field(..., description="User's question or message")
    context: Optional[str] = Field(None, description="Previous assessment context")

class ChatResponse(BaseModel):
    response: str = Field(..., description="AI response to user question")
    suggestions: List[str] = Field(default=[], description="Suggested follow-up questions")

class FacialAnalysisResponse(BaseModel):
    fatigue_indicators: List[str] = Field(..., description="Observed fatigue indicators from facial analysis")
    fever_indicators: List[str] = Field(..., description="Observed fever indicators from facial analysis")
    overall_health_appearance: str = Field(..., description="General health assessment from appearance")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Confidence in facial analysis")
    recommendations: List[str] = Field(..., description="Additional recommendations based on appearance")

class EnhancedPatientData(BaseModel):
    temperature: float = Field(..., ge=95.0, le=110.0, description="Temperature in Fahrenheit")
    duration_hours: int = Field(..., ge=1, le=720, description="Duration of fever in hours")
    symptoms: List[str] = Field(..., description="List of symptoms")
    age: int = Field(..., ge=0, le=120, description="Patient age in years")
    medical_history: Optional[str] = Field(None, description="Optional medical history")
    facial_analysis: Optional[FacialAnalysisResponse] = Field(None, description="Results from facial photo analysis")

    @validator('temperature')
    def validate_temperature(cls, v):
        if v < 95.0 or v > 110.0:
            raise ValueError('Temperature must be between 95.0 and 110.0 Fahrenheit')
        return v

def create_system_prompt() -> str:
    return """You are a clinical decision support AI specializing in emergency medicine, infectious diseases, and fever triage. 

Your role is to:
- Use evidence-based medicine principles
- Apply SIRS criteria for sepsis assessment
- Follow standard ER protocols and triage guidelines
- Always err on the side of caution for patient safety
- Identify life-threatening conditions immediately
- Provide differential diagnoses ranked by probability
- Consider age-specific considerations

Clinical Guidelines:
- LOW severity: Common viral infections, self-care appropriate, typically temp <101°F
- MEDIUM severity: Flu-like illness, see doctor within 24-48 hours, temp 101-103°F  
- HIGH severity: Possible bacterial infection, same-day medical attention needed, temp >103°F
- CRITICAL severity: Signs of sepsis/meningitis/severe pneumonia, immediate ER required

Red Flag Symptoms (require immediate attention):
- Altered mental status, confusion, lethargy
- Stiff neck with fever (meningitis concern)
- Difficulty breathing, chest pain
- Rapid heart rate with hypotension signs
- Petechial rash
- Severe dehydration
- Temperature >104°F (40°C)

Always return a properly formatted JSON response with all required fields. Be thorough but concise in your clinical reasoning."""

def create_user_prompt(patient_data, facial_analysis=None) -> str:
    symptoms_str = ", ".join(patient_data.symptoms) if patient_data.symptoms else "None reported"
    history_str = patient_data.medical_history if patient_data.medical_history else "Not provided"
    
    # Add facial analysis information if available
    facial_info = ""
    if facial_analysis and facial_analysis.confidence_score > 0.3:
        fatigue_str = ", ".join(facial_analysis.fatigue_indicators) if facial_analysis.fatigue_indicators else "None observed"
        fever_str = ", ".join(facial_analysis.fever_indicators) if facial_analysis.fever_indicators else "None observed"
        facial_info = f"""
FACIAL ANALYSIS RESULTS:
- Fatigue indicators: {fatigue_str}
- Fever indicators: {fever_str}
- Overall appearance: {facial_analysis.overall_health_appearance}
- Analysis confidence: {facial_analysis.confidence_score:.2f}
"""
    
    return f"""Please assess this patient and provide a structured triage recommendation:

PATIENT PRESENTATION:
- Age: {patient_data.age} years
- Temperature: {patient_data.temperature}°F
- Fever duration: {patient_data.duration_hours} hours
- Symptoms: {symptoms_str}
- Medical history: {history_str}{facial_info}

REQUESTED ANALYSIS:
1. Severity classification (LOW/MEDIUM/HIGH/CRITICAL)
2. Differential diagnoses ranked by probability
3. Specific red flags to monitor
4. Recommended care setting and urgency
5. Patient-friendly explanation of condition
6. Confidence level in assessment

Please provide your response in the following JSON format:
{{
    "severity": "LOW|MEDIUM|HIGH|CRITICAL",
    "diagnosis_suggestions": ["Primary diagnosis", "Secondary diagnosis", "Other possibilities"],
    "recommended_action": "Clear, actionable recommendation for patient",
    "clinical_explanation": "Professional explanation of reasoning and assessment",
    "red_flags": ["Specific warning signs to watch for"],
    "confidence_score": 0.85
}}"""

async def call_gemini_api(system_prompt: str, user_prompt: str) -> str:
    """Call Google Gemini API"""
    if not GEMINI_API_KEY:
        raise Exception("Gemini API key not configured")
    
    logger.info("Calling Gemini API for triage assessment")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    
    # Format the prompt for Gemini
    combined_prompt = f"""You are a clinical decision support AI. Please analyze this patient case and respond with a JSON object only.

{system_prompt}

{user_prompt}

Please respond with ONLY a valid JSON object with these exact fields:
{{
    "severity": "LOW|MEDIUM|HIGH|CRITICAL",
    "diagnosis_suggestions": ["Primary diagnosis", "Secondary diagnosis"],
    "recommended_action": "Clear action recommendation",
    "clinical_explanation": "Professional medical explanation",
    "red_flags": ["Warning sign 1", "Warning sign 2"],
    "confidence_score": 0.85
}}"""

    payload = {
        "contents": [{
            "parts": [{
                "text": combined_prompt
            }]
        }],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 1500,
        }
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Try up to 3 times with exponential backoff for rate limiting
        for attempt in range(3):
            try:
                response = await client.post(url, json=payload)
                
                if response.status_code == 200:
                    result = response.json()
                    logger.info(f"Gemini API response successful on attempt {attempt + 1}")
                    
                    if "candidates" not in result or not result["candidates"]:
                        raise Exception("No candidates in Gemini response")
                        
                    return result["candidates"][0]["content"]["parts"][0]["text"]
                
                elif response.status_code == 429:  # Rate limited
                    wait_time = (2 ** attempt) + 1  # Exponential backoff: 2, 5, 9 seconds
                    logger.warning(f"Rate limited, waiting {wait_time} seconds before retry {attempt + 1}/3")
                    await asyncio.sleep(wait_time)
                    continue
                
                else:
                    error_text = response.text
                    logger.error(f"Gemini API error {response.status_code}: {error_text}")
                    raise Exception(f"Gemini API error: {response.status_code} - {error_text}")
            
            except httpx.TimeoutException:
                logger.warning(f"Timeout on attempt {attempt + 1}/3")
                if attempt == 2:  # Last attempt
                    raise Exception("Gemini API timeout after 3 attempts")
                await asyncio.sleep(2)
                continue
        
        # If all retries failed
        raise Exception("Gemini API failed after 3 retries")

async def get_fallback_response(patient_data: PatientData) -> TriageResponse:
    """Generate a rule-based fallback response when AI is not available"""
    logger.warning("Using fallback rule-based assessment")
    
    # Simple rule-based triage
    temp = patient_data.temperature
    age = patient_data.age
    symptoms = [s.lower() for s in patient_data.symptoms]
    
    # Determine severity based on simple rules
    severity = "LOW"
    red_flags = []
    diagnoses = ["Viral infection", "Common cold"]
    action = "Monitor symptoms and rest at home"
    
    # Critical symptoms
    critical_symptoms = ["confusion", "stiff neck", "difficulty breathing", "chest pain"]
    if any(s in symptoms for s in critical_symptoms) or temp >= 104.0:
        severity = "CRITICAL"
        red_flags = ["High fever", "Concerning symptoms present"]
        diagnoses = ["Possible serious infection", "Requires immediate evaluation"]
        action = "Seek immediate emergency care - call 911"
    
    # High severity
    elif temp >= 103.0 or age > 65 or "rapid heartbeat" in symptoms:
        severity = "HIGH" 
        red_flags = ["High fever", "Risk factors present"]
        diagnoses = ["Possible bacterial infection", "Flu", "Pneumonia"]
        action = "See healthcare provider today"
    
    # Medium severity
    elif temp >= 101.0 or len(symptoms) > 3:
        severity = "MEDIUM"
        diagnoses = ["Viral infection", "Flu", "Upper respiratory infection"]
        action = "See healthcare provider within 24-48 hours if no improvement"
    
    return TriageResponse(
        severity=severity,
        diagnosis_suggestions=diagnoses,
        recommended_action=action,
        clinical_explanation=f"Rule-based assessment: Temperature {temp}°F, {len(symptoms)} symptoms. This is a simplified assessment - please consult healthcare provider for proper evaluation.",
        red_flags=red_flags,
        confidence_score=0.6  # Lower confidence for rule-based
    )

async def get_ai_triage_assessment(patient_data, facial_analysis=None) -> TriageResponse:
    """Get AI-powered triage assessment using Gemini"""
    try:
        system_prompt = create_system_prompt()
        user_prompt = create_user_prompt(patient_data, facial_analysis)
        
        logger.info(f"Requesting AI assessment for patient: age {patient_data.age}, temp {patient_data.temperature}°F")
        
        # Call Gemini API
        response_content = await call_gemini_api(system_prompt, user_prompt)
        
        logger.info(f"Received AI response: {response_content[:200]}...")
        
        # Try to parse JSON response
        try:
            # Clean up the response to extract JSON
            response_clean = response_content.strip()
            if "```json" in response_clean:
                response_clean = response_clean.split("```json")[1].split("```")[0]
            elif "```" in response_clean:
                response_clean = response_clean.split("```")[1].split("```")[0]
            
            ai_assessment = json.loads(response_clean)
        except json.JSONDecodeError:
            logger.warning("Could not parse JSON, using fallback response")
            return await get_fallback_response(patient_data)
        
        # Validate and create response object
        triage_response = TriageResponse(
            severity=ai_assessment.get("severity", "MEDIUM"),
            diagnosis_suggestions=ai_assessment.get("diagnosis_suggestions", ["Unable to determine"]),
            recommended_action=ai_assessment.get("recommended_action", "Consult healthcare provider"),
            clinical_explanation=ai_assessment.get("clinical_explanation", "Assessment completed"),
            red_flags=ai_assessment.get("red_flags", []),
            confidence_score=float(ai_assessment.get("confidence_score", 0.7))
        )
        
        logger.info(f"Successfully processed assessment with severity: {triage_response.severity}")
        return triage_response
        
    except Exception as e:
        logger.error(f"AI assessment error: {e}")
        logger.info("Falling back to rule-based assessment")
        return await get_fallback_response(patient_data)

async def call_gemini_chat(system_prompt: str, user_prompt: str) -> str:
    """Call Gemini API for chat responses"""
    if not GEMINI_API_KEY:
        raise Exception("Gemini API key not configured")
    
    logger.info("Calling Gemini API for chat")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    
    # Format the prompt for Gemini chat
    combined_prompt = f"""You are a helpful medical chat assistant. {system_prompt}

User: {user_prompt}

Please provide a helpful, conversational response. Keep it friendly but professional."""

    payload = {
        "contents": [{
            "parts": [{
                "text": combined_prompt
            }]
        }],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 500,
        }
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        await asyncio.sleep(1)  # Rate limiting for Gemini
        response = await client.post(url, json=payload)
        
        if response.status_code == 429:
            await asyncio.sleep(2)
            response = await client.post(url, json=payload)
        
        if response.status_code != 200:
            error_text = response.text
            logger.error(f"Gemini chat API error {response.status_code}: {error_text}")
            raise Exception(f"Gemini chat API error: {response.status_code}")
        
        result = response.json()
        
        if "candidates" not in result or not result["candidates"]:
            raise Exception("No candidates in Gemini chat response")
            
        return result["candidates"][0]["content"]["parts"][0]["text"]

async def get_chat_response(system_prompt: str, user_prompt: str) -> str:
    """Get AI response for chat messages using Gemini"""
    try:
        response = await call_gemini_chat(system_prompt, user_prompt)
        return response
    except Exception as e:
        logger.error(f"Chat error: {e}")
        return "I'm having trouble responding right now. Please consult healthcare professionals for medical advice."

async def analyze_facial_photo_with_gemini(image_base64: str) -> FacialAnalysisResponse:
    """Analyze facial photo for fatigue and fever indicators using Gemini Vision"""
    if not GEMINI_API_KEY:
        raise Exception("Gemini API key not configured")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    
    prompt = """You are a medical AI assistant analyzing a facial photograph for signs of fatigue and fever. 

Please examine this photo and provide analysis in JSON format for:

FATIGUE INDICATORS:
- Dark circles under eyes
- Droopy or heavy eyelids
- Pale or ashen skin tone
- Lack of facial color/vitality
- Tired facial expression
- Sunken appearance around eyes

FEVER INDICATORS:
- Flushed or red face/cheeks
- Sweaty or clammy appearance
- Glossy or watery eyes
- Red or irritated eyes
- Overall unwell appearance

ASSESSMENT CRITERIA:
- Rate confidence from 0.0 to 1.0
- Be objective and medical in assessment
- Note if photo quality affects analysis
- Suggest follow-up if appearance is concerning

Respond with this exact JSON structure:
{
    "fatigue_indicators": ["observed indicator 1", "observed indicator 2"],
    "fever_indicators": ["observed indicator 1", "observed indicator 2"],
    "overall_health_appearance": "Description of general appearance and health impression",
    "confidence_score": 0.85,
    "recommendations": ["recommendation 1", "recommendation 2"]
}"""

    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": image_base64
                    }
                }
            ]
        }],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 1000,
        }
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=payload)
        
        if response.status_code != 200:
            logger.error(f"Gemini Vision API error {response.status_code}: {response.text}")
            raise Exception(f"Gemini Vision API error: {response.status_code}")
        
        result = response.json()
        if "candidates" not in result or not result["candidates"]:
            raise Exception("No candidates in Gemini Vision response")
            
        response_text = result["candidates"][0]["content"]["parts"][0]["text"]
        
        # Clean and parse JSON response
        try:
            response_clean = response_text.strip()
            if "```json" in response_clean:
                response_clean = response_clean.split("```json")[1].split("```")[0]
            elif "```" in response_clean:
                response_clean = response_clean.split("```")[1].split("```")[0]
            
            analysis_data = json.loads(response_clean)
            return FacialAnalysisResponse(**analysis_data)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini Vision response: {e}")
            # Return fallback response
            return FacialAnalysisResponse(
                fatigue_indicators=["Unable to analyze - image processing error"],
                fever_indicators=["Unable to analyze - image processing error"],
                overall_health_appearance="Analysis could not be completed due to processing error",
                confidence_score=0.1,
                recommendations=["Please retake photo with better lighting", "Consult healthcare provider"]
            )

async def get_facial_analysis_fallback() -> FacialAnalysisResponse:
    """Fallback response when facial analysis isn't available"""
    return FacialAnalysisResponse(
        fatigue_indicators=["Facial analysis not available"],
        fever_indicators=["Facial analysis not available"],
        overall_health_appearance="Unable to analyze appearance - please rely on reported symptoms",
        confidence_score=0.0,
        recommendations=["Focus on reported symptoms", "Monitor temperature regularly", "Consult healthcare provider if symptoms worsen"]
    )

async def analyze_facial_photo(image_data: bytes) -> FacialAnalysisResponse:
    """Main function to analyze facial photo using Gemini Vision"""
    try:
        # Convert image to base64
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        logger.info("Analyzing facial photo with Gemini Vision")
        return await analyze_facial_photo_with_gemini(image_base64)
        
    except Exception as e:
        logger.error(f"Facial analysis error: {e}")
        return await get_facial_analysis_fallback()

# API Endpoints
@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "AI Fever Triage System",
        "version": "2.0.0",
        "ai_provider": "gemini",
        "gemini_configured": bool(GEMINI_API_KEY)
    }

@app.post("/api/analyze-photo", response_model=FacialAnalysisResponse)
async def analyze_photo_endpoint(file: UploadFile = File(...)):
    """
    Analyze uploaded facial photo for fatigue and fever indicators
    """
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Read and validate file size (max 10MB)
        contents = await file.read()
        if len(contents) > 10 * 1024 * 1024:  # 10MB
            raise HTTPException(status_code=400, detail="File too large (max 10MB)")
        
        # Validate it's a valid image
        try:
            image = Image.open(io.BytesIO(contents))
            image.verify()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        # Analyze the photo
        logger.info(f"Analyzing uploaded photo: {file.filename}")
        analysis = await analyze_facial_photo(contents)
        
        return analysis
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Photo analysis error: {e}")
        raise HTTPException(status_code=500, detail="Failed to analyze photo")

@app.post("/api/triage", response_model=TriageResponse)
async def triage_assessment(patient_data: PatientData):
    """
    Main triage endpoint that processes patient data and returns AI-powered assessment
    """
    try:
        # Log incoming request (without sensitive data)
        logger.info(f"Processing triage request for {patient_data.age}y patient with temp {patient_data.temperature}°F")
        
        # Get AI assessment
        assessment = await get_ai_triage_assessment(patient_data)
        
        # Additional safety checks
        if patient_data.temperature >= 104.0 and assessment.severity not in ["HIGH", "CRITICAL"]:
            assessment.severity = "CRITICAL"
            assessment.red_flags.append("Dangerously high fever (≥104°F)")
            logger.warning(f"Upgraded severity to CRITICAL due to high temperature: {patient_data.temperature}°F")
        
        # Check for critical symptoms
        critical_symptoms = ["confusion", "stiff neck", "difficulty breathing", "chest pain", "rapid heartbeat"]
        if any(symptom.lower() in [s.lower() for s in patient_data.symptoms] for symptom in critical_symptoms):
            if assessment.severity == "LOW":
                assessment.severity = "MEDIUM"
                logger.info("Upgraded severity due to concerning symptoms")
        
        return assessment
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in triage assessment: {e}")
        # Return fallback response instead of error
        return await get_fallback_response(patient_data)

@app.post("/api/triage-enhanced", response_model=TriageResponse)
async def enhanced_triage_assessment(patient_data: EnhancedPatientData):
    """
    Enhanced triage endpoint that includes facial analysis data
    """
    try:
        # Log incoming request
        logger.info(f"Processing enhanced triage request for {patient_data.age}y patient with temp {patient_data.temperature}°F")
        
        # Get AI assessment with facial analysis
        assessment = await get_ai_triage_assessment(patient_data, patient_data.facial_analysis)
        
        # Additional safety checks including facial indicators
        if patient_data.temperature >= 104.0 and assessment.severity not in ["HIGH", "CRITICAL"]:
            assessment.severity = "CRITICAL"
            assessment.red_flags.append("Dangerously high fever (≥104°F)")
            logger.warning(f"Upgraded severity to CRITICAL due to high temperature: {patient_data.temperature}°F")
        
        # Check for concerning facial indicators
        if patient_data.facial_analysis and patient_data.facial_analysis.confidence_score > 0.5:
            concerning_indicators = [
                "severe fatigue appearance", "extremely pale", "very flushed", 
                "difficulty keeping eyes open", "signs of dehydration"
            ]
            if any(indicator in " ".join(patient_data.facial_analysis.fatigue_indicators + patient_data.facial_analysis.fever_indicators).lower() 
                   for indicator in concerning_indicators):
                if assessment.severity == "LOW":
                    assessment.severity = "MEDIUM"
                    assessment.red_flags.append("Concerning appearance noted in facial analysis")
                    logger.info("Upgraded severity due to concerning facial indicators")
        
        # Check for critical symptoms
        critical_symptoms = ["confusion", "stiff neck", "difficulty breathing", "chest pain", "rapid heartbeat"]
        if any(symptom.lower() in [s.lower() for s in patient_data.symptoms] for symptom in critical_symptoms):
            if assessment.severity == "LOW":
                assessment.severity = "MEDIUM"
                logger.info("Upgraded severity due to concerning symptoms")
        
        return assessment
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in enhanced triage assessment: {e}")
        # Return fallback response instead of error
        return await get_fallback_response(patient_data)

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(chat_message: ChatMessage):
    """
    Post-assessment chatbot for follow-up questions
    """
    try:
        if not GEMINI_API_KEY:
            logger.error("Gemini API key not configured for chat")
            raise HTTPException(status_code=500, detail="Chat service not configured")
        
        # Create a healthcare-focused chat prompt
        system_prompt = """You are a helpful healthcare assistant providing follow-up support after a fever triage assessment. 
        
        Your role:
        - Answer questions about fever management, symptoms, and general health advice
        - Provide medication reminders and general wellness tips
        - Offer reassurance and guidance on when to seek medical care
        - Always remind users this is not a substitute for professional medical advice
        
        Guidelines:
        - Keep responses concise and helpful
        - Always err on the side of caution
        - Suggest seeking medical care for concerning symptoms
        - Provide practical, actionable advice
        
        Do not:
        - Provide specific medical diagnoses
        - Recommend specific medications or dosages
        - Replace professional medical judgment"""
        
        user_prompt = f"Context: {chat_message.context or 'General health question'}\n\nUser Question: {chat_message.message}\n\nPlease provide a helpful, reassuring response with practical advice."
        
        # Get AI response
        ai_response = await get_chat_response(system_prompt, user_prompt)
        
        # Generate follow-up suggestions
        suggestions = [
            "What should I eat while recovering?",
            "When should I take my temperature again?",
            "What warning signs should I watch for?",
            "How can I manage my symptoms at home?"
        ]
        
        return ChatResponse(
            response=ai_response,
            suggestions=suggestions
        )
        
    except Exception as e:
        logger.error(f"Chat endpoint error: {e}")
        # Fallback response
        return ChatResponse(
            response="I'm here to help with your health questions. While I can provide general guidance, please consult healthcare professionals for specific medical advice. What would you like to know?",
            suggestions=[
                "What should I eat while recovering?",
                "When should I take my temperature again?",
                "What warning signs should I watch for?"
            ]
        )

@app.get("/")
async def root():
    """Root endpoint with basic information"""
    return {
        "message": "AI Fever Triage System API",
        "version": "2.0.0",
        "ai_provider": "Gemini AI",
        "endpoints": {
            "health": "/api/health",
            "triage": "/api/triage (POST)",
            "enhanced_triage": "/api/triage-enhanced (POST)",
            "analyze_photo": "/api/analyze-photo (POST)",
            "chat": "/api/chat (POST)"
        },
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
