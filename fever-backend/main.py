from fastapi import FastAPI, HTTPException, Depends, Header, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, validator
from typing import List, Optional
import os
import json
import logging
import asyncio
import httpx
import base64
from PIL import Image
import io
from dotenv import load_dotenv
import googlemaps
import pytz
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut
from datetime import datetime, timezone

# Import Firebase Admin (will initialize if configured)
FIREBASE_AVAILABLE = False
try:
    import firebase_admin
    from firebase_admin import auth, credentials
    FIREBASE_AVAILABLE = True
except ImportError:
    pass  # Will be handled after logger is initialized

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Firebase Admin
if FIREBASE_AVAILABLE:
    try:
        # Try to initialize Firebase Admin
        if not firebase_admin._apps:
            cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
            if cred_path and os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
                logger.info("Firebase Admin initialized with service account file")
            else:
                # Try environment variables
                service_account_info = {
                    "type": "service_account",
                    "project_id": os.getenv("FIREBASE_PROJECT_ID"),
                    "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID"),
                    "private_key": os.getenv("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n"),
                    "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
                    "client_id": os.getenv("FIREBASE_CLIENT_ID"),
                }
                if service_account_info.get("project_id") and service_account_info.get("private_key"):
                    cred = credentials.Certificate(service_account_info)
                    firebase_admin.initialize_app(cred)
                    logger.info("Firebase Admin initialized with environment variables")
                else:
                    logger.warning("Firebase Admin not configured - authentication will be optional")
                    FIREBASE_AVAILABLE = False
        else:
            logger.info("Firebase Admin already initialized")
    except Exception as e:
        logger.warning(f"Firebase Admin initialization failed: {e}. Authentication will be optional.")
        FIREBASE_AVAILABLE = False
else:
    logger.warning("Firebase Admin package not installed - authentication will be optional")

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
VISION_PROVIDER = os.getenv("VISION_PROVIDER", "llama")  # For image analysis: llama, gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

# Initialize clients based on provider
openai_client = None
if OPENAI_API_KEY:
    try:
        from openai import OpenAI
        openai_client = OpenAI(api_key=OPENAI_API_KEY)
    except ImportError:
        logger.warning("OpenAI library not available")

# Initialize Google Maps client if API key is available
gmaps = None
if GOOGLE_MAPS_API_KEY:
    try:
        gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)
        logger.info("Google Maps client initialized successfully")
    except Exception as e:
        logger.warning(f"Google Maps initialization failed: {e}")

# Initialize geocoder
geolocator = Nominatim(user_agent="fever_triage_app")

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
    fatigue_indicators: List[str] = Field(..., description="List of detected fatigue indicators")
    fever_indicators: List[str] = Field(..., description="List of detected fever indicators")
    overall_health_appearance: str = Field(..., description="Overall health assessment from appearance")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="AI confidence in analysis")
    recommendations: List[str] = Field(..., description="List of health recommendations")

class LocationData(BaseModel):
    latitude: Optional[float] = Field(None, description="Latitude coordinate")
    longitude: Optional[float] = Field(None, description="Longitude coordinate")
    city: Optional[str] = Field(None, description="City name")
    state: Optional[str] = Field(None, description="State/Province name")
    country: Optional[str] = Field(None, description="Country name")
    timezone: Optional[str] = Field(None, description="Timezone identifier")

class PatientDataWithLocation(PatientData):
    location: Optional[LocationData] = Field(None, description="Patient location data")
    assessment_time: Optional[str] = Field(None, description="Time of assessment in ISO format")

class ComprehensiveTriageResponse(BaseModel):
    # Basic triage response
    severity: str = Field(..., description="Severity level: LOW/MEDIUM/HIGH/CRITICAL")
    diagnosis_suggestions: List[str] = Field(..., description="List of potential diagnoses")
    recommended_action: str = Field(..., description="Recommended action for patient")
    clinical_explanation: str = Field(..., description="Clinical reasoning and explanation")
    red_flags: List[str] = Field(..., description="List of concerning symptoms/signs")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="AI confidence score")
    
    # Photo analysis results
    facial_analysis: Optional[FacialAnalysisResponse] = Field(None, description="Facial analysis results if photo provided")
    
    # Location and time context
    location_context: Optional[str] = Field(None, description="Location-based health insights")
    seasonal_context: Optional[str] = Field(None, description="Seasonal and time-based health insights")
    likely_fever_types: List[dict] = Field(default=[], description="Location-based likely fever types with probabilities")
    home_remedies: List[str] = Field(default=[], description="Home remedies for low-risk cases")
    
    # Combined assessment
    combined_reasoning: str = Field(..., description="Combined assessment reasoning including visual and symptom analysis")

# Firebase Authentication Dependencies
security = HTTPBearer(auto_error=False)

async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    """Optional auth - returns user info if token provided and valid, None otherwise"""
    if not credentials:
        return None
    
    if not FIREBASE_AVAILABLE:
        logger.warning("Firebase Admin not available - skipping token verification")
        return None
    
    try:
        token = credentials.credentials
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        logger.warning(f"Token verification failed: {e}")
        return None

async def get_location_insights(location: LocationData) -> dict:
    """Generate location-based health insights and likely fever diagnosis"""
    if not location or not location.city:
        return {
            "insights": "No location data available for contextual analysis.",
            "likely_fever_types": [],
            "risk_level": "unknown"
        }
    
    # Enhanced disease prevalence by region in India with likelihood scores
    disease_regions = {
        "mumbai": {
            "dengue": 0.8, "malaria": 0.6, "chikungunya": 0.7, "typhoid": 0.4, "viral_fever": 0.5
        },
        "delhi": {
            "dengue": 0.9, "chikungunya": 0.6, "typhoid": 0.7, "viral_fever": 0.6, "malaria": 0.3
        },
        "chennai": {
            "dengue": 0.8, "malaria": 0.5, "viral_fever": 0.7, "typhoid": 0.4, "chikungunya": 0.5
        },
        "kolkata": {
            "dengue": 0.7, "malaria": 0.8, "typhoid": 0.6, "viral_fever": 0.5, "chikungunya": 0.4
        },
        "bangalore": {
            "dengue": 0.8, "chikungunya": 0.7, "viral_fever": 0.6, "typhoid": 0.4, "malaria": 0.3
        },
        "hyderabad": {
            "dengue": 0.7, "chikungunya": 0.6, "malaria": 0.5, "viral_fever": 0.6, "typhoid": 0.4
        },
        "pune": {
            "dengue": 0.8, "chikungunya": 0.7, "viral_fever": 0.5, "typhoid": 0.4, "malaria": 0.3
        },
        "ahmedabad": {
            "malaria": 0.7, "typhoid": 0.6, "viral_fever": 0.5, "dengue": 0.4, "chikungunya": 0.3
        }
    }
    
    city_lower = location.city.lower()
    city_diseases = {}
    
    # Find matching city
    for city, diseases in disease_regions.items():
        if city in city_lower or city_lower in city:
            city_diseases = diseases
            break
    
    # Default diseases if city not found
    if not city_diseases:
        city_diseases = {"viral_fever": 0.6, "dengue": 0.4, "typhoid": 0.3, "malaria": 0.3}
    
    # Adjust for seasonal factors
    current_month = datetime.now().month
    seasonal_multiplier = {}
    
    if current_month in [6, 7, 8, 9]:  # Monsoon season
        seasonal_multiplier = {"dengue": 1.5, "malaria": 1.4, "chikungunya": 1.3, "typhoid": 1.2}
        season_info = "Monsoon season increases risk of water-borne and vector-borne diseases."
    elif current_month in [10, 11, 12, 1]:  # Post-monsoon/winter  
        seasonal_multiplier = {"dengue": 1.3, "chikungunya": 1.2, "viral_fever": 1.1}
        season_info = "Post-monsoon period with peak vector-borne disease activity."
    elif current_month in [3, 4, 5]:  # Summer
        seasonal_multiplier = {"viral_fever": 1.1, "typhoid": 1.2}
        season_info = "Summer season with increased risk of dehydration and food contamination."
    else:
        seasonal_multiplier = {}
        season_info = "Regular seasonal precautions apply."
    
    # Calculate final likelihood scores
    final_scores = {}
    for disease, base_score in city_diseases.items():
        multiplier = seasonal_multiplier.get(disease, 1.0)
        final_scores[disease] = min(base_score * multiplier, 1.0)
    
    # Sort by likelihood
    likely_fevers = sorted(final_scores.items(), key=lambda x: x[1], reverse=True)[:3]
    
    insights = f"In {location.city}, based on current seasonal patterns: {season_info}"
    
    return {
        "insights": insights,
        "likely_fever_types": [{"type": fever.replace('_', ' ').title(), "likelihood": score} 
                              for fever, score in likely_fevers],
        "seasonal_context": season_info
    }

async def get_temporal_insights(assessment_time: str = None) -> str:
    """Generate time-based health insights"""
    try:
        if assessment_time:
            dt = datetime.fromisoformat(assessment_time.replace('Z', '+00:00'))
        else:
            dt = datetime.now()
        
        insights = []
        
        # Time of day considerations
        hour = dt.hour
        if 22 <= hour or hour <= 5:  # Night time
            insights.append("Night-time fever assessment - consider rest and monitoring.")
        elif 6 <= hour <= 11:  # Morning
            insights.append("Morning assessment allows for better symptom tracking.")
        elif 12 <= hour <= 17:  # Afternoon
            insights.append("Afternoon fever may be concerning if persistent since morning.")
        elif 18 <= hour <= 21:  # Evening
            insights.append("Evening fever is common but should be monitored overnight.")
        
        # Day of week (for clinic availability)
        weekday = dt.weekday()
        if weekday < 5:  # Monday to Friday
            insights.append("Medical facilities are readily available during weekdays.")
        else:  # Weekend
            insights.append("Weekend assessment - emergency services available if needed.")
        
        # Season-specific advice (India)
        month = dt.month
        if month in [6, 7, 8, 9]:  # Monsoon
            insights.append("Monsoon season requires extra precaution against water-borne infections.")
        elif month in [10, 11]:  # Post-monsoon
            insights.append("Post-monsoon period - peak time for vector-borne diseases.")
        elif month in [12, 1, 2]:  # Winter
            insights.append("Winter season - viral infections are common.")
        elif month in [3, 4, 5]:  # Summer
            insights.append("Summer season - stay hydrated and avoid heat exposure.")
        
        return " ".join(insights)
        
    except Exception as e:
        logger.error(f"Error generating temporal insights: {e}")
        return "General time-based precautions apply."

async def reverse_geocode_location(latitude: float, longitude: float) -> LocationData:
    """Convert coordinates to location information"""
    try:
        if geolocator:
            location = geolocator.reverse(f"{latitude}, {longitude}", timeout=10)
            if location:
                address = location.raw.get('address', {})
                
                # Extract location components
                city = (address.get('city') or 
                       address.get('town') or 
                       address.get('village') or 
                       address.get('suburb') or 
                       address.get('neighbourhood'))
                
                state = (address.get('state') or 
                        address.get('state_district'))
                
                country = address.get('country')
                
                # Get timezone using Google Maps if available
                timezone_id = None
                if gmaps:
                    try:
                        timezone_result = gmaps.timezone((latitude, longitude))
                        timezone_id = timezone_result.get('timeZoneId')
                    except Exception as e:
                        logger.warning(f"Timezone lookup failed: {e}")
                
                return LocationData(
                    latitude=latitude,
                    longitude=longitude,
                    city=city,
                    state=state,
                    country=country,
                    timezone=timezone_id
                )
    
    except GeocoderTimedOut:
        logger.warning("Geocoding timeout")
    except Exception as e:
        logger.error(f"Reverse geocoding error: {e}")
    
    return LocationData(latitude=latitude, longitude=longitude)

def get_home_remedies(severity: str, likely_fever_type: str = None) -> list:
    """Generate India-specific home remedies for low-risk fever cases"""
    
    if severity not in ["LOW", "MEDIUM"]:
        return ["Seek immediate medical attention - home remedies not recommended for high-risk cases"]
    
    general_remedies = [
        "Stay well hydrated - drink plenty of water, coconut water, and warm fluids",
        "Take adequate rest in a cool, well-ventilated room",
        "Use cool compresses on forehead and wrists to reduce temperature",
        "Consume light, easily digestible foods like khichdi, daliya, or rice porridge",
        "Drink warm ginger-honey-lemon tea for comfort and immunity boost"
    ]
    
    fever_specific_remedies = {
        "viral_fever": [
            "Steam inhalation with eucalyptus oil or ajwain for congestion relief",
            "Tulsi and ginger tea 2-3 times daily for natural immunity",
            "Consume warm turmeric milk before bedtime",
            "Gargle with warm salt water for throat comfort"
        ],
        "typhoid": [
            "Strictly maintain hand hygiene and consume only boiled/filtered water",
            "Eat banana, rice, applesauce, and toast (BRAT diet) for digestive comfort",
            "Drink ORS or homemade electrolyte solution frequently",
            "Avoid raw fruits and vegetables temporarily"
        ],
        "dengue": [
            "Increase fluid intake - coconut water, fresh fruit juices, and water",
            "Consume papaya leaf juice (consult doctor first) for platelet support",
            "Monitor for bleeding signs and seek immediate help if found",
            "Avoid aspirin and ibuprofen - use only paracetamol for fever"
        ],
        "chikungunya": [
            "Apply warm compresses to aching joints for pain relief",
            "Gentle stretching and light movement when comfortable",
            "Anti-inflammatory foods like turmeric, ginger, and omega-3 rich items",
            "Adequate rest to prevent joint strain"
        ],
        "malaria": [
            "Maintain strict mosquito protection - nets, repellents, long sleeves",
            "Stay hydrated and maintain electrolyte balance",
            "Consume neem tea (in moderation) for natural antimalarial properties",
            "Follow prescribed medication schedule strictly"
        ]
    }
    
    remedies = general_remedies.copy()
    
    if likely_fever_type and likely_fever_type.lower().replace(' ', '_') in fever_specific_remedies:
        fever_key = likely_fever_type.lower().replace(' ', '_')
        remedies.extend(fever_specific_remedies[fever_key])
    
    # Add important disclaimer
    remedies.append("IMPORTANT: These are supportive measures only. Consult a healthcare provider if symptoms worsen or persist beyond 2-3 days.")
    
    return remedies

def create_system_prompt() -> str:
    return """You are a compassionate AI health assistant helping with fever care in India. Your role is to provide helpful, reassuring guidance while being culturally sensitive.

IMPORTANT COMMUNICATION GUIDELINES:
- Use gentle, supportive language that doesn't cause anxiety
- Present information in a hopeful, caring manner
- Focus on recovery and wellness rather than complications
- Avoid scary medical terminology
- Emphasize that most fevers are manageable with proper care
- Always reassure while being medically accurate, Also never use any emojis in the results

Your role is to:
- Use evidence-based medicine principles specific to Indian healthcare context
- Apply SIRS criteria for sepsis assessment
- Follow Indian medical protocols and WHO guidelines
- Always err on the side of caution for patient safety
- Identify life-threatening conditions immediately
- Provide differential diagnoses ranked by probability for Indian endemic diseases
- Consider age-specific considerations and seasonal patterns in India

INDIA-SPECIFIC FEVER CONDITIONS TO CONSIDER:

1. DENGUE FEVER (Monsoon season prevalent)
   Symptoms: Sudden high fever, severe body/joint pain, skin rash, bleeding tendency
   Precautions: Hydration with ORS, avoid aspirin/ibuprofen, monitor platelets
   Severity: HIGH if platelet drop or bleeding signs

2. MALARIA (All year, peak in monsoon)
   Symptoms: Fever with chills, sweating episodes, headache
   Precautions: Mosquito protection, eliminate stagnant water
   Severity: HIGH for P. falciparum, CRITICAL if cerebral symptoms

3. TYPHOID (Endemic, poor sanitation areas)
   Symptoms: Gradually rising fever, abdominal pain, rose spots
   Precautions: Boiled water, food hygiene, avoid street food
   Severity: MEDIUM to HIGH, CRITICAL if complications

4. CHIKUNGUNYA (Aedes mosquito borne)
   Symptoms: Sudden high fever, severe joint pain, rash
   Precautions: Mosquito protection, joint care, hydration
   Severity: MEDIUM, HIGH in elderly

5. VIRAL FEVER (Common, seasonal)
   Symptoms: Mild-moderate fever, cold, cough, throat irritation
   Precautions: Steam inhalation, warm fluids, rest
   Severity: LOW to MEDIUM

6. HEAT EXHAUSTION (Summer months)
   Symptoms: High body temperature, dizziness, heavy sweating
   Precautions: Cool environment, electrolyte solutions, light clothing
   Severity: MEDIUM, CRITICAL if heat stroke

7. GASTROENTERITIS FEVER (Monsoon/contaminated food)
   Symptoms: Fever with vomiting, diarrhea, dehydration
   Precautions: ORS frequently, bland foods (BRAT diet), hand hygiene
   Severity: MEDIUM, HIGH if severe dehydration

8. PNEUMONIA-RELATED FEVER (Winter/pollution)
   Symptoms: Fever with productive cough, chest pain, breathing difficulty
   Precautions: Warm fluids, rest, avoid cold air
   Severity: HIGH, CRITICAL if respiratory distress

9. SEPSIS-RELATED FEVER (Medical emergency)
   Symptoms: High persistent fever, confusion, rapid pulse, low BP
   Precautions: IMMEDIATE emergency care
   Severity: CRITICAL - require immediate hospitalization

10. CHICKENPOX (More common in children)
    Symptoms: Fever with itchy fluid-filled blisters
    Precautions: Isolation, avoid scratching, cool baths
    Severity: LOW to MEDIUM, HIGH if complications

SEVERITY CLASSIFICATION (India-specific):
- LOW: Viral fever, mild heat exhaustion, early chickenpox (temp <101°F)
- MEDIUM: Typhoid, chikungunya, gastroenteritis, moderate pneumonia (temp 101-103°F)
- HIGH: Dengue, malaria, severe pneumonia, dehydration (temp >103°F)
- CRITICAL: Severe malaria, sepsis, heat stroke, respiratory distress (temp >104°F or danger signs)

RED FLAG SYMPTOMS (Immediate hospital referral):
- Altered consciousness, confusion
- Difficulty breathing, chest pain
- Bleeding (dengue concern)
- Severe dehydration signs
- Stiff neck (meningitis)
- Temperature >104°F (40°C)
- Rapid pulse with low BP
- Persistent vomiting unable to keep fluids down

SEASONAL CONSIDERATIONS:
- Monsoon (June-Sept): Higher risk of dengue, malaria, chikungunya, gastroenteritis
- Summer (March-May): Heat-related illnesses, dehydration
- Winter (Dec-Feb): Respiratory infections, pneumonia
- Post-monsoon (Oct-Nov): Dengue, chikungunya peak


Always return a properly formatted JSON response. Consider seasonal patterns, local disease prevalence, and provide India-appropriate management advice."""

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

async def call_gemini_vision_api(image_data: str, prompt: str) -> str:
    """Call Gemini Vision API for photo analysis"""
    if not GEMINI_API_KEY:
        raise Exception("Gemini API key not configured")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    
    payload = {
        "contents": [{
            "parts": [
                {
                    "text": prompt
                },
                {
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": image_data
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
        await asyncio.sleep(1)  # Rate limiting
        response = await client.post(url, json=payload)
        
        if response.status_code == 429:
            await asyncio.sleep(2)
            response = await client.post(url, json=payload)
        
        if response.status_code != 200:
            error_text = response.text
            logger.error(f"Gemini Vision API error {response.status_code}: {error_text}")
            raise Exception(f"Gemini Vision API error: {response.status_code}")
        
        result = response.json()
        if "candidates" not in result or not result["candidates"]:
            raise Exception("No candidates in Gemini Vision response")
            
        return result["candidates"][0]["content"]["parts"][0]["text"]

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
        "firebase_configured": FIREBASE_AVAILABLE,
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
async def triage_assessment(
    patient_data: PatientData,
    user: Optional[dict] = Depends(get_current_user)
):
    """
    Main triage endpoint that processes patient data and returns AI-powered assessment
    Optional authentication - works with or without auth token
    """
    try:
        # Log incoming request (without sensitive data)
        user_info = f"user: {user.get('email')}" if user else "anonymous user"
        logger.info(f"Processing triage request for {user_info}, {patient_data.age}y patient with temp {patient_data.temperature}°F")
        
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
async def chat_endpoint(
    chat_message: ChatMessage,
    user: Optional[dict] = Depends(get_current_user)
):
    """
    Post-assessment chatbot for follow-up questions
    Optional authentication - works with or without auth token
    """
    try:
        if not os.getenv("GEMINI_API_KEY") and not os.getenv("OPENAI_API_KEY"):
            logger.error("No AI API keys configured for chat")
            raise HTTPException(status_code=500, detail="Chat service not configured")
        
        user_info = f"user: {user.get('email')}" if user else "anonymous user"
        logger.info(f"Chat request from {user_info}")
        
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

@app.post("/api/analyze-photo", response_model=FacialAnalysisResponse)
async def analyze_photo(
    photo: UploadFile = File(...),
    user: Optional[dict] = Depends(get_current_user)
):
    """
    Analyze facial photo for fatigue and fever indicators using Gemini Vision
    """
    try:
        if not GEMINI_API_KEY:
            raise HTTPException(status_code=500, detail="Photo analysis service not configured")
        
        # Validate file type
        if not photo.content_type or not photo.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Read and validate file size
        photo_data = await photo.read()
        if len(photo_data) > 10 * 1024 * 1024:  # 10MB limit
            raise HTTPException(status_code=400, detail="File too large (max 10MB)")
        
        user_info = f"user: {user.get('email')}" if user else "anonymous user"
        logger.info(f"Processing photo analysis for {user_info}")
        
        # Convert image to base64
        try:
            # Open and potentially resize image
            image = Image.open(io.BytesIO(photo_data))
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Resize if too large (max 1024x1024 for API efficiency)
            max_size = 1024
            if image.width > max_size or image.height > max_size:
                image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            
            # Convert back to bytes
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format='JPEG', quality=85)
            img_byte_arr.seek(0)
            
            # Encode to base64
            image_base64 = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')
            
        except Exception as e:
            logger.error(f"Image processing error: {e}")
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        # Create analysis prompt
        analysis_prompt = """You are a medical AI assistant analyzing facial appearance for signs of fatigue and fever. 

Please analyze this facial photo for:

1. FATIGUE INDICATORS:
   - Dark circles under eyes
   - Droopy or heavy eyelids
   - Pale or dull skin tone
   - Overall tired appearance
   - Lack of alertness in facial expression

2. FEVER INDICATORS:
   - Flushed or red cheeks
   - Sweaty or shiny appearance
   - Glassy or unfocused eyes
   - Overall warm/heated appearance
   - Signs of discomfort

3. OVERALL HEALTH APPEARANCE:
   - General wellness assessment
   - Alertness level
   - Skin condition
   - Hydration signs

Please respond with ONLY a valid JSON object:
{
    "fatigue_indicators": ["list of detected fatigue signs"],
    "fever_indicators": ["list of detected fever signs"],
    "overall_health_appearance": "description of general appearance",
    "confidence_score": 0.75,
    "recommendations": ["health recommendations based on appearance"]
}

Important: Base your assessment only on visible facial features. Do not make definitive medical diagnoses."""

        # Call Gemini Vision API
        try:
            response = await call_gemini_vision_api(image_base64, analysis_prompt)
            logger.info(f"Gemini Vision response: {response[:200]}...")
            
            # Parse JSON response
            response_clean = response.strip()
            if "```json" in response_clean:
                response_clean = response_clean.split("```json")[1].split("```")[0]
            elif "```" in response_clean:
                response_clean = response_clean.split("```")[1].split("```")[0]
            
            analysis_result = json.loads(response_clean)
            
            # Create response object
            facial_analysis = FacialAnalysisResponse(
                fatigue_indicators=analysis_result.get("fatigue_indicators", []),
                fever_indicators=analysis_result.get("fever_indicators", []),
                overall_health_appearance=analysis_result.get("overall_health_appearance", "Unable to assess from photo"),
                confidence_score=float(analysis_result.get("confidence_score", 0.5)),
                recommendations=analysis_result.get("recommendations", ["Consult healthcare provider for professional assessment"])
            )
            
            logger.info(f"Photo analysis completed with {len(facial_analysis.fatigue_indicators)} fatigue and {len(facial_analysis.fever_indicators)} fever indicators")
            return facial_analysis
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {e}")
            # Return fallback response
            return FacialAnalysisResponse(
                fatigue_indicators=["Unable to analyze - please ensure good lighting and clear face view"],
                fever_indicators=[],
                overall_health_appearance="Photo analysis could not be completed. Please ensure good lighting and a clear view of your face.",
                confidence_score=0.0,
                recommendations=["Retake photo with better lighting", "Consult healthcare provider for assessment"]
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Photo analysis error: {e}")
        raise HTTPException(status_code=500, detail="Photo analysis failed")

@app.post("/api/triage-comprehensive", response_model=ComprehensiveTriageResponse)
async def comprehensive_triage_assessment(
    patient_data: str = Form(...),
    photo: Optional[UploadFile] = File(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    assessment_time: Optional[str] = Form(None), 
    user: Optional[dict] = Depends(get_current_user)
):
    """
    Comprehensive triage endpoint that combines symptom analysis with optional photo analysis
    """
    try:
        # Parse patient data from form
        try:
            patient_info = PatientData.parse_raw(patient_data)
        except Exception as e:
            logger.error(f"Invalid patient data format: {e}")
            raise HTTPException(status_code=400, detail="Invalid patient data format")
        
        user_info = f"user: {user.get('email')}" if user else "anonymous user"
        logger.info(f"Processing comprehensive triage for {user_info}, {patient_info.age}y patient")
        
        # Step 1: Get initial symptom-based assessment
        logger.info("Step 1: Analyzing symptoms...")
        symptom_assessment = await get_ai_triage_assessment(patient_info)
        
        # Step 2: Analyze photo if provided
        facial_analysis = None
        if photo:
            logger.info("Step 2: Analyzing facial photo...")
            try:
                # Validate file type
                if not photo.content_type or not photo.content_type.startswith('image/'):
                    logger.warning("Invalid photo file type, skipping photo analysis")
                else:
                    # Read and process photo
                    photo_data = await photo.read()
                    if len(photo_data) > 10 * 1024 * 1024:  # 10MB limit
                        logger.warning("Photo too large, skipping photo analysis")
                    else:
                        # Process image and get analysis
                        image = Image.open(io.BytesIO(photo_data))
                        if image.mode != 'RGB':
                            image = image.convert('RGB')
                        
                        # Resize if needed
                        max_size = 1024
                        if image.width > max_size or image.height > max_size:
                            image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
                        
                        # Convert to base64
                        img_byte_arr = io.BytesIO()
                        image.save(img_byte_arr, format='JPEG', quality=85)
                        img_byte_arr.seek(0)
                        image_base64 = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')
                        
                        # Create analysis prompt
                        analysis_prompt = """Analyze this facial photo for signs of fatigue and fever. Look for:
                        
FATIGUE INDICATORS: Dark circles, droopy eyelids, pale skin, tired appearance
FEVER INDICATORS: Flushed cheeks, sweaty appearance, glassy eyes, heated look

Respond with JSON:
{
    "fatigue_indicators": ["list of signs"],
    "fever_indicators": ["list of signs"],
    "overall_health_appearance": "description",
    "confidence_score": 0.75,
    "recommendations": ["health recommendations"]
}"""
                        
                        # Call Gemini Vision API
                        response = await call_gemini_vision_api(image_base64, analysis_prompt)
                        
                        # Parse response
                        response_clean = response.strip()
                        if "```json" in response_clean:
                            response_clean = response_clean.split("```json")[1].split("```")[0]
                        elif "```" in response_clean:
                            response_clean = response_clean.split("```")[1].split("```")[0]
                        
                        analysis_result = json.loads(response_clean)
                        
                        facial_analysis = FacialAnalysisResponse(
                            fatigue_indicators=analysis_result.get("fatigue_indicators", []),
                            fever_indicators=analysis_result.get("fever_indicators", []),
                            overall_health_appearance=analysis_result.get("overall_health_appearance", "Unable to assess"),
                            confidence_score=float(analysis_result.get("confidence_score", 0.5)),
                            recommendations=analysis_result.get("recommendations", [])
                        )
                        
                        logger.info(f"Photo analysis completed: {len(facial_analysis.fatigue_indicators)} fatigue, {len(facial_analysis.fever_indicators)} fever indicators")
                        
            except Exception as e:
                logger.warning(f"Photo analysis failed: {e}, continuing with symptom-only assessment")
        
        # Step 3: Process location and time context
        location_insights = {"insights": "No location data available", "likely_fever_types": [], "seasonal_context": ""}
        temporal_context = ""
        location_data = None
        
        if latitude is not None and longitude is not None:
            logger.info("Step 3a: Processing location context...")
            try:
                location_data = await reverse_geocode_location(latitude, longitude)
                location_insights = await get_location_insights(location_data)
                logger.info(f"Location context: {location_data.city}, {location_data.state}")
                fever_types_str = ', '.join([f"{t['type']} ({t['likelihood']:.2f})" for t in location_insights['likely_fever_types']])
                logger.info(f"Likely fever types: {fever_types_str}")
            except Exception as e:
                logger.warning(f"Location processing failed: {e}")
                location_insights = {"insights": "Location context not available", "likely_fever_types": [], "seasonal_context": ""}
        
        logger.info("Step 3b: Processing temporal context...")
        try:
            temporal_context = await get_temporal_insights(assessment_time)
        except Exception as e:
            logger.warning(f"Temporal context processing failed: {e}")
            temporal_context = "Time-based insights not available."

        # Step 4: Combine all analyses for final assessment
        logger.info("Step 4: Creating comprehensive combined assessment...")
        
        # Create enhanced prompt that includes symptom, visual, location, and time data
        system_prompt = create_system_prompt()
        
        # Build comprehensive prompt
        symptoms_str = ", ".join(patient_info.symptoms) if patient_info.symptoms else "None reported"
        history_str = patient_info.medical_history if patient_info.medical_history else "Not provided"
        
        photo_context = ""
        if facial_analysis:
            photo_context = f"""
            
FACIAL ANALYSIS RESULTS:
- Fatigue indicators: {', '.join(facial_analysis.fatigue_indicators) if facial_analysis.fatigue_indicators else 'None detected'}
- Fever indicators: {', '.join(facial_analysis.fever_indicators) if facial_analysis.fever_indicators else 'None detected'}
- Overall appearance: {facial_analysis.overall_health_appearance}
- Photo analysis confidence: {facial_analysis.confidence_score:.2f}
"""
        
        # Get likely fever type for home remedies
        likely_fever_type = location_insights['likely_fever_types'][0]['type'] if location_insights['likely_fever_types'] else None
        
        combined_prompt = f"""Please provide a comprehensive assessment combining symptom data, visual analysis, location context, and timing:

PATIENT PRESENTATION:
- Age: {patient_info.age} years
- Temperature: {patient_info.temperature}°F
- Fever duration: {patient_info.duration_hours} hours
- Symptoms: {symptoms_str}
- Medical history: {history_str}{photo_context}

LOCATION-BASED FEVER LIKELIHOOD:
{location_insights['insights']}
Most likely fever types in this area:
{', '.join([f"{ft['type']} (likelihood: {ft['likelihood']:.1%})" for ft in location_insights['likely_fever_types']])}

TIME & SEASONAL CONTEXT:
{temporal_context}

IMPORTANT: Based on location data, focus your diagnosis on the most likely fever types for this region and season. Be specific about which fever type is most probable.

INITIAL SYMPTOM-BASED ASSESSMENT:
- Severity: {symptom_assessment.severity}
- Diagnoses: {', '.join(symptom_assessment.diagnosis_suggestions)}
- Clinical reasoning: {symptom_assessment.clinical_explanation}

Please provide a FINAL COMPREHENSIVE assessment that considers both symptom data and visual indicators (if available).

Respond with JSON:
{{
    "severity": "LOW|MEDIUM|HIGH|CRITICAL",
    "diagnosis_suggestions": ["Final diagnosis suggestions"],
    "recommended_action": "Final recommendation",
    "clinical_explanation": "Final clinical reasoning",
    "red_flags": ["Warning signs to monitor"],
    "confidence_score": 0.85,
    "combined_reasoning": "Explanation of how visual and symptom data were combined"
}}"""
        
        # Get final combined assessment
        try:
            response_content = await call_gemini_api(system_prompt, combined_prompt)
            
            # Parse response
            response_clean = response_content.strip()
            if "```json" in response_clean:
                response_clean = response_clean.split("```json")[1].split("```")[0]
            elif "```" in response_clean:
                response_clean = response_clean.split("```")[1].split("```")[0]
            
            final_assessment = json.loads(response_clean)
            
            # Add home remedies for low-risk cases
            final_severity = final_assessment.get("severity", symptom_assessment.severity)
            home_remedies = get_home_remedies(final_severity, likely_fever_type) if final_severity in ["LOW", "MEDIUM"] else []
            
            # Create comprehensive response
            comprehensive_response = ComprehensiveTriageResponse(
                severity=final_severity,
                diagnosis_suggestions=final_assessment.get("diagnosis_suggestions", symptom_assessment.diagnosis_suggestions),
                recommended_action=final_assessment.get("recommended_action", symptom_assessment.recommended_action),
                clinical_explanation=final_assessment.get("clinical_explanation", symptom_assessment.clinical_explanation),
                red_flags=final_assessment.get("red_flags", symptom_assessment.red_flags),
                confidence_score=float(final_assessment.get("confidence_score", symptom_assessment.confidence_score)),
                facial_analysis=facial_analysis,
                location_context=location_insights['insights'] if location_insights['insights'] else None,
                seasonal_context=temporal_context if temporal_context else None,
                likely_fever_types=location_insights['likely_fever_types'],
                home_remedies=home_remedies,
                combined_reasoning=final_assessment.get("combined_reasoning", "Assessment based on symptom analysis" + (" and facial indicators" if facial_analysis else "") + (" with location insights" if location_insights['insights'] else "") + (" and timing considerations" if temporal_context else ""))
            )
            
            logger.info(f"Comprehensive assessment completed: {comprehensive_response.severity} severity")
            return comprehensive_response
            
        except Exception as e:
            logger.warning(f"Combined assessment failed: {e}, using symptom assessment")
            # Fallback to symptom assessment
            return ComprehensiveTriageResponse(
                severity=symptom_assessment.severity,
                diagnosis_suggestions=symptom_assessment.diagnosis_suggestions,
                recommended_action=symptom_assessment.recommended_action,
                clinical_explanation=symptom_assessment.clinical_explanation,
                red_flags=symptom_assessment.red_flags,
                confidence_score=symptom_assessment.confidence_score,
                facial_analysis=facial_analysis,
                combined_reasoning="Assessment based on symptom analysis" + (" and facial visual indicators" if facial_analysis else "")
            )
        
    except Exception as e:
        logger.error(f"Comprehensive triage error: {e}")
        # Return fallback response
        fallback = await get_fallback_response(patient_info)
        return ComprehensiveTriageResponse(
            severity=fallback.severity,
            diagnosis_suggestions=fallback.diagnosis_suggestions,
            recommended_action=fallback.recommended_action,
            clinical_explanation=fallback.clinical_explanation,
            red_flags=fallback.red_flags,
            confidence_score=fallback.confidence_score,
            facial_analysis=facial_analysis,
            combined_reasoning="Fallback assessment due to processing error"
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
            "triage-comprehensive": "/api/triage-comprehensive (POST - with optional photo)",
            "chat": "/api/chat (POST)",
            "analyze-photo": "/api/analyze-photo (POST)"
        },
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
