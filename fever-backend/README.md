=# AI Fever Triage System - Backend

A FastAPI-based backend service that provides AI-powered fever triage assessments using OpenAI's GPT-4.

## Features

🩺 **Clinical Decision Support**: AI-powered triage using GPT-4 with medical knowledge  
🔬 **Evidence-Based**: Follows ER protocols and SIRS criteria for sepsis assessment  
⚡ **Fast API**: High-performance REST API with automatic documentation  
🛡️ **Safety First**: Always errs on the side of caution for patient safety  
📊 **Structured Output**: Consistent JSON responses with confidence scores  

## API Endpoints

### POST `/api/triage`
Main triage assessment endpoint.

**Request Body:**
```json
{
  "temperature": 102.5,
  "duration_hours": 24,
  "symptoms": ["headache", "chills", "body aches"],
  "age": 35,
  "medical_history": "No significant medical history"
}
```

**Response:**
```json
{
  "severity": "MEDIUM",
  "diagnosis_suggestions": [
    "Viral upper respiratory infection",
    "Influenza",
    "Early bacterial infection"
  ],
  "recommended_action": "Monitor symptoms and see healthcare provider within 24-48 hours if no improvement",
  "clinical_explanation": "Patient presents with moderate fever and systemic symptoms consistent with viral illness...",
  "red_flags": [
    "Watch for difficulty breathing",
    "Monitor for persistent high fever >103°F"
  ],
  "confidence_score": 0.85
}
```

### GET `/api/health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "AI Fever Triage System",
  "version": "1.0.0",
  "openai_configured": true
}
```

## Local Development Setup

1. **Clone the repository**
```bash
cd fever-backend
```

2. **Create virtual environment**
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Set up environment variables**
```bash
# Copy the template
cp .env.example .env
# Edit .env and add your OpenAI API key
OPENAI_API_KEY=your_actual_api_key_here
```

5. **Run the development server**
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

6. **Access the API**
- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Deployment

### Render Deployment

1. **Create new Web Service on Render**
2. **Configuration:**
   - Runtime: Python 3.11
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. **Environment Variables:**
   - `OPENAI_API_KEY`: Your OpenAI API key

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4 access | Yes |

## Triage Logic

The system uses a four-tier severity classification:

- **LOW**: Common viral infections, self-care appropriate, temp <101°F typically
- **MEDIUM**: Flu-like illness, see doctor within 24-48 hours, temp 101-103°F
- **HIGH**: Possible bacterial infection, same-day medical attention needed, temp >103°F
- **CRITICAL**: Signs of sepsis/meningitis/severe pneumonia, immediate ER required

## Medical Disclaimer

⚠️ **Important**: This system is for educational and demonstration purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of qualified healthcare providers with any questions regarding medical conditions. In case of emergency, call 911 immediately.

## License

MIT License - see LICENSE file for details.
