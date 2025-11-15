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
    photo_base64: Optional[str] = Field(None, description="Base64 encoded patient photo")
    photo_url: Optional[str] = Field(None, description="URL to patient photo")
    location: Optional[str] = Field(None, description="Patient location (city, state)")

    @validator('temperature')
    def validate_temperature(cls, v):
        if v < 95.0 or v > 110.0:
            raise ValueError('Temperature must be between 95.0 and 110.0 Fahrenheit')
        return v

class MedicationRecommendation(BaseModel):
    name: str = Field(..., description="Medication name")
    manufacturer: str = Field(default="Microlabs", description="Manufacturer")
    dosage: str = Field(..., description="Recommended dosage")
    frequency: str = Field(..., description="How often to take")
    purpose: str = Field(..., description="What it treats")

class DoctorRecommendation(BaseModel):
    name: str = Field(..., description="Doctor name")
    specialty: str = Field(..., description="Medical specialty")
    phone: str = Field(..., description="Contact phone number")
    address: str = Field(..., description="Clinic/Hospital address")
    distance: Optional[str] = Field(None, description="Distance from patient")

class TriageResponse(BaseModel):
    severity: str = Field(..., description="Severity level: LOW/MEDIUM/HIGH/CRITICAL")
    diagnosis_suggestions: List[str] = Field(..., description="List of potential diagnoses")
    recommended_action: str = Field(..., description="Recommended action for patient")
    clinical_explanation: str = Field(..., description="Clinical reasoning and explanation")
    red_flags: List[str] = Field(..., description="List of concerning symptoms/signs")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="AI confidence score")
    medications: List[MedicationRecommendation] = Field(default=[], description="Microlabs medication recommendations")
    doctors: List[DoctorRecommendation] = Field(default=[], description="Nearby doctors")
    emergency_contacts: List[str] = Field(default=[], description="Emergency contact numbers")
    photo_analysis: Optional[str] = Field(None, description="Analysis of patient photo if provided")

class ChatMessage(BaseModel):
    message: str = Field(..., description="User's question or message")
    context: Optional[str] = Field(None, description="Previous assessment context")

class ChatResponse(BaseModel):
    response: str = Field(..., description="AI response to user question")
    suggestions: List[str] = Field(default=[], description="Suggested follow-up questions")

# India-specific doctor database (mock data - in production, use real database)
INDIA_DOCTORS_DB = {
    "mumbai": [
        {"name": "Dr. Rajesh Kumar", "specialty": "General Physician", "phone": "+91-22-2345-6789", "address": "Apollo Hospital, Tardeo, Mumbai"},
        {"name": "Dr. Priya Sharma", "specialty": "Infectious Disease Specialist", "phone": "+91-22-2456-7890", "address": "Lilavati Hospital, Bandra, Mumbai"},
        {"name": "Dr. Amit Patel", "specialty": "Pediatrician", "phone": "+91-22-2567-8901", "address": "KEM Hospital, Parel, Mumbai"},
    ],
    "delhi": [
        {"name": "Dr. Sandeep Singh", "specialty": "General Physician", "phone": "+91-11-4567-8901", "address": "AIIMS, Ansari Nagar, Delhi"},
        {"name": "Dr. Meera Verma", "specialty": "Infectious Disease Specialist", "phone": "+91-11-5678-9012", "address": "Max Hospital, Saket, Delhi"},
        {"name": "Dr. Vikram Malhotra", "specialty": "Internal Medicine", "phone": "+91-11-6789-0123", "address": "Fortis Hospital, Vasant Kunj, Delhi"},
    ],
    "bangalore": [
        {"name": "Dr. Anand Rao", "specialty": "General Physician", "phone": "+91-80-1234-5678", "address": "Manipal Hospital, HAL Airport Road, Bangalore"},
        {"name": "Dr. Lakshmi Menon", "specialty": "Infectious Disease Specialist", "phone": "+91-80-2345-6789", "address": "Apollo Hospital, Bannerghatta Road, Bangalore"},
        {"name": "Dr. Suresh Reddy", "specialty": "Family Medicine", "phone": "+91-80-3456-7890", "address": "Columbia Asia Hospital, Whitefield, Bangalore"},
    ],
    "chennai": [
        {"name": "Dr. Karthik Subramanian", "specialty": "General Physician", "phone": "+91-44-1234-5678", "address": "Apollo Hospital, Greams Road, Chennai"},
        {"name": "Dr. Divya Ramesh", "specialty": "Infectious Disease Specialist", "phone": "+91-44-2345-6789", "address": "MIOT Hospital, Manapakkam, Chennai"},
        {"name": "Dr. Venkat Krishnan", "specialty": "Internal Medicine", "phone": "+91-44-3456-7890", "address": "Fortis Malar Hospital, Adyar, Chennai"},
    ],
    "pune": [
        {"name": "Dr. Nikhil Joshi", "specialty": "General Physician", "phone": "+91-20-1234-5678", "address": "Ruby Hall Clinic, Pune"},
        {"name": "Dr. Sneha Deshmukh", "specialty": "Infectious Disease Specialist", "phone": "+91-20-2345-6789", "address": "Sahyadri Hospital, Deccan, Pune"},
        {"name": "Dr. Rahul Bhosale", "specialty": "Family Medicine", "phone": "+91-20-3456-7890", "address": "Deenanath Mangeshkar Hospital, Pune"},
    ],
    "hyderabad": [
        {"name": "Dr. Srinivas Rao", "specialty": "General Physician", "phone": "+91-40-1234-5678", "address": "Apollo Hospital, Jubilee Hills, Hyderabad"},
        {"name": "Dr. Kavitha Reddy", "specialty": "Infectious Disease Specialist", "phone": "+91-40-2345-6789", "address": "Yashoda Hospital, Somajiguda, Hyderabad"},
        {"name": "Dr. Ramesh Naidu", "specialty": "Internal Medicine", "phone": "+91-40-3456-7890", "address": "KIMS Hospital, Secunderabad, Hyderabad"},
    ],
}

# Emergency numbers for India
INDIA_EMERGENCY_CONTACTS = {
    "national": ["108 - National Ambulance Service", "102 - National Health Helpline"],
    "mumbai": ["108 - Ambulance", "1916 - Medical Helpline"],
    "delhi": ["108 - Ambulance", "011-23921801 - Delhi Medical Emergency"],
    "bangalore": ["108 - Ambulance", "080-22261000 - BBMP Health Helpline"],
    "chennai": ["108 - Ambulance", "044-28592750 - Chennai Corporation Health"],
    "pune": ["108 - Ambulance", "020-26127394 - PMC Health Helpline"],
    "hyderabad": ["108 - Ambulance", "040-23814939 - GHMC Health Helpline"],
}

# Microlabs medication database for fever and related conditions
MICROLABS_MEDICATIONS = {
    "fever_reducer": [
        {"name": "Paracetamol 500mg (Microlabs)", "dosage": "500-1000mg", "frequency": "Every 4-6 hours", "purpose": "Reduce fever and pain"},
        {"name": "Ibuprofen 400mg (Microlabs)", "dosage": "400mg", "frequency": "Every 6-8 hours", "purpose": "Reduce fever and inflammation"},
    ],
    "antibiotic": [
        {"name": "Amoxicillin 500mg (Microlabs)", "dosage": "500mg", "frequency": "Three times daily", "purpose": "Bacterial infections"},
        {"name": "Azithromycin 500mg (Microlabs)", "dosage": "500mg", "frequency": "Once daily", "purpose": "Bacterial respiratory infections"},
    ],
    "antihistamine": [
        {"name": "Cetirizine 10mg (Microlabs)", "dosage": "10mg", "frequency": "Once daily", "purpose": "Allergic reactions and symptoms"},
    ],
    "cough": [
        {"name": "Dextromethorphan Syrup (Microlabs)", "dosage": "10ml", "frequency": "Three times daily", "purpose": "Cough suppression"},
    ],
    "decongestant": [
        {"name": "Pseudoephedrine 60mg (Microlabs)", "dosage": "60mg", "frequency": "Every 6 hours", "purpose": "Nasal congestion relief"},
    ],
}

def get_doctors_by_location(location: Optional[str]) -> List[DoctorRecommendation]:
    """Get doctor recommendations based on location"""
    if not location:
        # Return default doctors from major cities
        default_doctors = []
        for city in ["mumbai", "delhi", "bangalore"]:
            if city in INDIA_DOCTORS_DB:
                default_doctors.extend(INDIA_DOCTORS_DB[city][:1])
        return [DoctorRecommendation(**doc) for doc in default_doctors]
    
    # Normalize location
    location_lower = location.lower()
    
    # Find matching city
    for city, doctors in INDIA_DOCTORS_DB.items():
        if city in location_lower:
            return [DoctorRecommendation(**doc) for doc in doctors]
    
    # If no match, return default
    return [DoctorRecommendation(**doc) for doc in INDIA_DOCTORS_DB.get("mumbai", [])[:2]]

def get_emergency_contacts(location: Optional[str]) -> List[str]:
    """Get emergency contact numbers based on location"""
    contacts = INDIA_EMERGENCY_CONTACTS["national"].copy()
    
    if location:
        location_lower = location.lower()
        for city, city_contacts in INDIA_EMERGENCY_CONTACTS.items():
            if city in location_lower and city != "national":
                contacts.extend(city_contacts)
                break
    
    return contacts

def get_medication_recommendations(severity: str, symptoms: List[str]) -> List[MedicationRecommendation]:
    """Get Microlabs medication recommendations based on severity and symptoms"""
    medications = []
    
    # Always recommend fever reducer
    medications.extend(MICROLABS_MEDICATIONS["fever_reducer"])
    
    # Add based on severity
    if severity in ["HIGH", "CRITICAL"]:
        # Note: Antibiotics should only be prescribed by doctors
        medications.append(
            MedicationRecommendation(
                name="Prescription Antibiotic (Microlabs)",
                manufacturer="Microlabs",
                dosage="As prescribed by doctor",
                frequency="As prescribed by doctor",
                purpose="Bacterial infection (prescription required)"
            )
        )
    
    # Add based on symptoms
    symptom_keywords = [s.lower() for s in symptoms]
    
    if any(word in " ".join(symptom_keywords) for word in ["cough", "throat"]):
        medications.extend(MICROLABS_MEDICATIONS["cough"])
    
    if any(word in " ".join(symptom_keywords) for word in ["congestion", "runny nose", "blocked nose"]):
        medications.extend(MICROLABS_MEDICATIONS["decongestant"])
    
    if any(word in " ".join(symptom_keywords) for word in ["allergy", "allergic", "rash", "itching"]):
        medications.extend(MICROLABS_MEDICATIONS["antihistamine"])
    
    return medications

def create_system_prompt() -> str:
    return """You are a clinical decision support AI specializing in emergency medicine, infectious diseases, and fever triage for patients in India. 

Your role is to:
- Use evidence-based medicine principles
- Apply SIRS criteria for sepsis assessment
- Follow standard ER protocols and triage guidelines
- Always err on the side of caution for patient safety
- Identify life-threatening conditions immediately
- Provide differential diagnoses ranked by probability
- Consider age-specific considerations
- Analyze patient photos when provided for visual symptoms
- Recommend medications manufactured by Microlabs (Indian pharmaceutical company)
- Consider India-specific health conditions and epidemiology

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

India-Specific Considerations:
- Common tropical diseases: Dengue, Malaria, Typhoid
- Monsoon-related infections
- Vector-borne diseases prevalence
- Access to healthcare facilities
- Medication availability in India

Always return a properly formatted JSON response with all required fields. Be thorough but concise in your clinical reasoning."""

def create_user_prompt(patient_data: PatientData) -> str:
    symptoms_str = ", ".join(patient_data.symptoms) if patient_data.symptoms else "None reported"
    history_str = patient_data.medical_history if patient_data.medical_history else "Not provided"
    location_str = patient_data.location if patient_data.location else "Not specified"
    photo_info = "Patient photo provided for visual analysis" if (patient_data.photo_base64 or patient_data.photo_url) else "No photo provided"
    
    return f"""Please assess this patient and provide a structured triage recommendation:

PATIENT PRESENTATION:
- Age: {patient_data.age} years
- Temperature: {patient_data.temperature}°F
- Fever duration: {patient_data.duration_hours} hours
- Symptoms: {symptoms_str}
- Medical history: {history_str}
- Location: {location_str} (India)
- Visual information: {photo_info}

REQUESTED ANALYSIS:
1. Severity classification (LOW/MEDIUM/HIGH/CRITICAL)
2. Differential diagnoses ranked by probability (consider India-specific diseases)
3. Specific red flags to monitor
4. Recommended care setting and urgency
5. Patient-friendly explanation of condition
6. Confidence level in assessment
7. If photo provided, analyze visible symptoms (rash, skin condition, etc.)

Please provide your response in the following JSON format:
{{
    "severity": "LOW|MEDIUM|HIGH|CRITICAL",
    "diagnosis_suggestions": ["Primary diagnosis", "Secondary diagnosis", "Other possibilities"],
    "recommended_action": "Clear, actionable recommendation for patient",
    "clinical_explanation": "Professional explanation of reasoning and assessment",
    "red_flags": ["Specific warning signs to watch for"],
    "confidence_score": 0.85,
    "photo_analysis": "Analysis of visual symptoms if photo provided, or null"
}}"""

async def call_gemini_api(system_prompt: str, user_prompt: str, image_base64: Optional[str] = None) -> str:
    """Call Google Gemini API with optional image support"""
    if not GEMINI_API_KEY:
        raise Exception("Gemini API key not configured")
    
    logger.info(f"Using Gemini API key: {GEMINI_API_KEY[:20]}...")
    
    # Use gemini-pro-vision if image is provided, otherwise gemini-pro
    model = "gemini-2.0-flash" if not image_base64 else "gemini-2.0-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
    
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
    "confidence_score": 0.85,
    "photo_analysis": "Visual analysis if photo provided, or null"
}}"""

    # Build parts array
    parts = [{"text": combined_prompt}]
    
    # Add image if provided
    if image_base64:
        parts.append({
            "inline_data": {
                "mime_type": "image/jpeg",
                "data": image_base64
            }
        })

    payload = {
        "contents": [{
            "parts": parts
        }],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 2000,
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
        action = "Seek immediate emergency care - call 108 (National Ambulance Service)"
    
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
    
    # Get location-based recommendations
    doctors = get_doctors_by_location(patient_data.location)
    emergency_contacts = get_emergency_contacts(patient_data.location)
    medications = get_medication_recommendations(severity, patient_data.symptoms)
    
    return TriageResponse(
        severity=severity,
        diagnosis_suggestions=diagnoses,
        recommended_action=action,
        clinical_explanation=f"Rule-based assessment: Temperature {temp}°F, {len(symptoms)} symptoms. This is a simplified assessment - please consult healthcare provider for proper evaluation.",
        red_flags=red_flags,
        confidence_score=0.6,  # Lower confidence for rule-based
        medications=medications,
        doctors=doctors,
        emergency_contacts=emergency_contacts,
        photo_analysis=None
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
                response_content = await call_gemini_api(system_prompt, user_prompt, patient_data.photo_base64)
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
                        response_content = await call_gemini_api(system_prompt, user_prompt, patient_data.photo_base64)
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
        
        # Get location-based recommendations
        doctors = get_doctors_by_location(patient_data.location)
        emergency_contacts = get_emergency_contacts(patient_data.location)
        
        # Get medication recommendations
        severity = ai_assessment.get("severity", "MEDIUM")
        medications = get_medication_recommendations(severity, patient_data.symptoms)
        
        # Validate and create response object
        triage_response = TriageResponse(
            severity=severity,
            diagnosis_suggestions=ai_assessment.get("diagnosis_suggestions", ["Unable to determine"]),
            recommended_action=ai_assessment.get("recommended_action", "Consult healthcare provider"),
            clinical_explanation=ai_assessment.get("clinical_explanation", "Assessment completed"),
            red_flags=ai_assessment.get("red_flags", []),
            confidence_score=float(ai_assessment.get("confidence_score", 0.7)),
            medications=medications,
            doctors=doctors,
            emergency_contacts=emergency_contacts,
            photo_analysis=ai_assessment.get("photo_analysis")
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
