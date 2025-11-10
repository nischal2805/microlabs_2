from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import List, Optional
import os
import json
import logging
import asyncio
import httpx
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Fever Triage System",
    description="AI-powered fever diagnostics and triage system using GPT-4",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# AI Provider configuration
AI_PROVIDER = os.getenv("AI_PROVIDER", "gemini")  # Options: openai, gemini, ollama, huggingface
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY")

# Initialize clients based on provider
openai_client = None
if OPENAI_API_KEY:
    try:
        from openai import OpenAI
        openai_client = OpenAI(api_key=OPENAI_API_KEY)
    except ImportError:
        logger.warning("OpenAI library not available")

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

def create_user_prompt(patient_data: PatientData) -> str:
    symptoms_str = ", ".join(patient_data.symptoms) if patient_data.symptoms else "None reported"
    history_str = patient_data.medical_history if patient_data.medical_history else "Not provided"
    
    return f"""Please assess this patient and provide a structured triage recommendation:

PATIENT PRESENTATION:
- Age: {patient_data.age} years
- Temperature: {patient_data.temperature}°F
- Fever duration: {patient_data.duration_hours} hours
- Symptoms: {symptoms_str}
- Medical history: {history_str}

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
    
    logger.info(f"Using Gemini API key: {GEMINI_API_KEY[:20]}...")
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
        
        # If all retries failed
        raise Exception("Gemini API failed after 3 retries (rate limited)")

async def call_ollama_api(system_prompt: str, user_prompt: str) -> str:
    """Call Ollama API (local)"""
    url = f"{OLLAMA_URL}/api/generate"
    
    payload = {
        "model": "llama3.2",  # You can change this to any available model
        "prompt": f"{system_prompt}\n\n{user_prompt}\n\nPlease respond in JSON format.",
        "stream": False,
        "options": {
            "temperature": 0.3,
            "num_predict": 1500
        }
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        return result["response"]

async def call_huggingface_api(system_prompt: str, user_prompt: str) -> str:
    """Call Hugging Face Inference API"""
    if not HUGGINGFACE_API_KEY:
        raise Exception("Hugging Face API key not configured")
    
    # Using a free model that's good for text generation
    url = "https://api-inference.huggingface.co/models/microsoft/DialoGPT-large"
    
    headers = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}"}
    payload = {
        "inputs": f"{system_prompt}\n\n{user_prompt}\n\nResponse in JSON:",
        "parameters": {
            "temperature": 0.3,
            "max_new_tokens": 1500,
            "return_full_text": False
        }
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        
        result = response.json()
        return result[0]["generated_text"] if result else "Unable to generate response"

async def call_openai_api(system_prompt: str, user_prompt: str) -> str:
    """Call OpenAI API"""
    if not openai_client:
        raise Exception("OpenAI not configured")
    
    models_to_try = ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"]
    
    for model in models_to_try:
        try:
            logger.info(f"Trying OpenAI model: {model}")
            response = openai_client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                max_tokens=1500,
                response_format={"type": "json_object"} if model != "gpt-3.5-turbo" else None
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.warning(f"OpenAI model {model} failed: {e}")
            continue
    
    raise Exception("All OpenAI models failed")

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

async def get_ai_triage_assessment(patient_data: PatientData) -> TriageResponse:
    """Get AI-powered triage assessment using multiple providers"""
    try:
        system_prompt = create_system_prompt()
        user_prompt = create_user_prompt(patient_data)
        
        logger.info(f"Requesting AI assessment for patient: age {patient_data.age}, temp {patient_data.temperature}°F")
        logger.info(f"Using AI provider: {AI_PROVIDER}")
        
        # Try different AI providers
        response_content = None
        
        try:
            if AI_PROVIDER == "gemini" and GEMINI_API_KEY:
                logger.info("Trying Gemini API")
                response_content = await call_gemini_api(system_prompt, user_prompt)
            elif AI_PROVIDER == "ollama":
                logger.info("Trying Ollama API")
                response_content = await call_ollama_api(system_prompt, user_prompt)
            elif AI_PROVIDER == "huggingface" and HUGGINGFACE_API_KEY:
                logger.info("Trying Hugging Face API")
                response_content = await call_huggingface_api(system_prompt, user_prompt)
            elif AI_PROVIDER == "openai" and openai_client:
                logger.info("Trying OpenAI API")
                response_content = await call_openai_api(system_prompt, user_prompt)
            else:
                raise Exception(f"AI provider {AI_PROVIDER} not configured")
        
        except Exception as primary_error:
            logger.warning(f"Primary AI provider failed: {primary_error}")
            
            # Try fallback providers
            fallback_providers = ["gemini", "ollama", "huggingface", "openai"]
            
            for provider in fallback_providers:
                if provider == AI_PROVIDER:
                    continue
                    
                try:
                    logger.info(f"Trying fallback provider: {provider}")
                    
                    if provider == "gemini" and GEMINI_API_KEY:
                        response_content = await call_gemini_api(system_prompt, user_prompt)
                        break
                    elif provider == "ollama":
                        response_content = await call_ollama_api(system_prompt, user_prompt)
                        break
                    elif provider == "huggingface" and HUGGINGFACE_API_KEY:
                        response_content = await call_huggingface_api(system_prompt, user_prompt)
                        break
                    elif provider == "openai" and openai_client:
                        response_content = await call_openai_api(system_prompt, user_prompt)
                        break
                        
                except Exception as fallback_error:
                    logger.warning(f"Fallback provider {provider} failed: {fallback_error}")
                    continue
        
        if not response_content:
            logger.warning("All AI providers failed, using fallback response")
            return await get_fallback_response(patient_data)
        
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
    
    logger.info(f"Using Gemini API key: {GEMINI_API_KEY[:20]}...")
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
    
    async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
        await asyncio.sleep(1)  # Rate limiting for Gemini
        response = await client.post(url, json=payload)
        
        if response.status_code != 200:
            error_text = response.text
            logger.error(f"Gemini chat API error {response.status_code}: {error_text}")
            raise Exception(f"Gemini chat API error: {response.status_code}")
        
        result = response.json()
        logger.info(f"Gemini chat API response: {result}")
        
        if "candidates" not in result or not result["candidates"]:
            raise Exception("No candidates in Gemini chat response")
            
        return result["candidates"][0]["content"]["parts"][0]["text"]

async def get_chat_response(system_prompt: str, user_prompt: str) -> str:
    """Get AI response for chat messages"""
    try:
        # Try Gemini first if configured
        if GEMINI_API_KEY and AI_PROVIDER == "gemini":
            try:
                response = await call_gemini_chat(system_prompt, user_prompt)
                return response
            except Exception as e:
                logger.warning(f"Gemini chat failed: {e}")
        
        # Try OpenAI as fallback
        if OPENAI_API_KEY:
            try:
                response = openai_client.chat.completions.create(
                    model="gpt-3.5-turbo",  # Use cheaper model for chat
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.7,  # Slightly more creative for chat
                    max_tokens=500
                )
                return response.choices[0].message.content
            except Exception as e:
                logger.warning(f"OpenAI chat failed: {e}")
        
        # Fallback response
        return "I'm here to help with your health questions. While I can provide general guidance, please consult healthcare professionals for specific medical advice."
        
    except Exception as e:
        logger.error(f"Chat error: {e}")
        return "I'm having trouble responding right now. Please consult healthcare professionals for medical advice."

async def call_gemini_chat(system_prompt: str, user_prompt: str) -> str:
    """Call Gemini API for chat responses"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    
    combined_prompt = f"{system_prompt}\n\n{user_prompt}"
    
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
        await asyncio.sleep(1)  # Rate limiting
        response = await client.post(url, json=payload)
        
        if response.status_code == 429:
            await asyncio.sleep(2)
            response = await client.post(url, json=payload)
        
        if response.status_code != 200:
            raise Exception(f"Gemini chat error: {response.status_code}")
        
        result = response.json()
        return result["candidates"][0]["content"]["parts"][0]["text"]

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "AI Fever Triage System",
        "version": "2.0.0",
        "ai_provider": AI_PROVIDER,
        "providers_configured": {
            "openai": bool(OPENAI_API_KEY),
            "gemini": bool(GEMINI_API_KEY),
            "ollama": True,  # Assume available if URL is set
            "huggingface": bool(HUGGINGFACE_API_KEY)
        }
    }

@app.get("/api/test-providers")
async def test_providers():
    """Test which AI providers are available"""
    results = {}
    
    # Test Gemini
    if GEMINI_API_KEY:
        try:
            test_response = await call_gemini_api("You are a test.", "Say 'Hello from Gemini'")
            results["gemini"] = {"status": "available", "response": test_response[:50]}
        except Exception as e:
            results["gemini"] = {"status": "error", "error": str(e)}
    else:
        results["gemini"] = {"status": "not_configured"}
    
    # Test Ollama
    try:
        test_response = await call_ollama_api("You are a test.", "Say 'Hello from Ollama'")
        results["ollama"] = {"status": "available", "response": test_response[:50]}
    except Exception as e:
        results["ollama"] = {"status": "error", "error": str(e)}
    
    # Test Hugging Face
    if HUGGINGFACE_API_KEY:
        try:
            test_response = await call_huggingface_api("You are a test.", "Say 'Hello from HF'")
            results["huggingface"] = {"status": "available", "response": test_response[:50]}
        except Exception as e:
            results["huggingface"] = {"status": "error", "error": str(e)}
    else:
        results["huggingface"] = {"status": "not_configured"}
    
    # Test OpenAI
    if openai_client:
        try:
            test_response = await call_openai_api("You are a test.", "Say 'Hello from OpenAI'")
            results["openai"] = {"status": "available", "response": test_response[:50]}
        except Exception as e:
            results["openai"] = {"status": "error", "error": str(e)}
    else:
        results["openai"] = {"status": "not_configured"}
    
    return {
        "current_provider": AI_PROVIDER,
        "test_results": results
    }

@app.post("/api/triage", response_model=TriageResponse)
async def triage_assessment(patient_data: PatientData):
    """
    Main triage endpoint that processes patient data and returns AI-powered assessment
    """
    try:
        # Log incoming request (without sensitive data)
        logger.info(f"Processing triage request for {patient_data.age}y patient with temp {patient_data.temperature}°F")
        
        # Get AI assessment (with built-in fallback)
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

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(chat_message: ChatMessage):
    """
    Post-assessment chatbot for follow-up questions
    """
    try:
        if not os.getenv("GEMINI_API_KEY") and not os.getenv("OPENAI_API_KEY"):
            logger.error("No AI API keys configured for chat")
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
        
        # Try to get AI response
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
        "endpoints": {
            "health": "/api/health",
            "triage": "/api/triage (POST)",
            "chat": "/api/chat (POST)"
        },
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
