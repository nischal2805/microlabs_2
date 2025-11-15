# 🏥 AI Fever Triage System (Gemini-Powered)

A comprehensive fever diagnosis and triage system powered by Google's Gemini AI, featuring facial photo analysis for fatigue and fever detection.

## 🌟 Features

### Core Functionality
- **AI-Powered Triage**: Intelligent fever assessment using Gemini AI
- **Facial Photo Analysis**: Computer vision analysis for fatigue and fever indicators
- **Symptom Assessment**: Comprehensive symptom tracking and evaluation
- **Risk Stratification**: Four-level severity classification (LOW/MEDIUM/HIGH/CRITICAL)
- **Healthcare Chatbot**: Post-assessment support and guidance

### Medical Capabilities
- Evidence-based medical reasoning
- SIRS criteria for sepsis assessment
- Age-specific considerations
- Red flag symptom detection
- Differential diagnosis suggestions
- Clinical explanation and recommendations

## 🏗️ Architecture

### Backend (FastAPI + Gemini AI)
- **Framework**: FastAPI with async support
- **AI Provider**: Google Gemini (text + vision)
- **Image Processing**: PIL for photo validation
- **API Documentation**: Auto-generated Swagger/OpenAPI docs

### Frontend (Next.js + React)
- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS
- **Components**: Modular React components
- **State Management**: React hooks

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- Google Gemini API key (free tier available)

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd fever-backend
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment**
   ```bash
   # Copy .env file and add your Gemini API key
   cp .env.example .env
   # Edit .env and add: GEMINI_API_KEY=your_api_key_here
   ```

4. **Start the backend server**
   ```bash
   python -m uvicorn main:app --reload --port 8000
   ```

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd fever-triage
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   # Update .env.local with your backend URL
   echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

### Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## 🧠 AI-Powered Features

### 1. Facial Photo Analysis
Upload a photo for automated analysis of:
- **Fatigue Indicators**: Dark circles, droopy eyelids, pale skin
- **Fever Indicators**: Flushed face, sweaty appearance, red eyes
- **Health Assessment**: Overall wellness evaluation
- **Confidence Scoring**: AI confidence in analysis

### 2. Intelligent Triage
Comprehensive assessment considering:
- Temperature and duration
- Symptom constellation
- Patient age and medical history
- Facial analysis results (if available)
- Evidence-based medical guidelines

### 3. Clinical Decision Support
- **Severity Classification**: LOW/MEDIUM/HIGH/CRITICAL
- **Differential Diagnoses**: Ranked by probability
- **Red Flag Detection**: Critical symptoms requiring immediate attention
- **Care Recommendations**: Appropriate care setting and urgency

## 📋 API Endpoints

### Core Endpoints
- `GET /api/health` - System health check
- `POST /api/triage` - Basic triage assessment
- `POST /api/triage-enhanced` - Enhanced triage with facial analysis
- `POST /api/analyze-photo` - Facial photo analysis
- `POST /api/chat` - Healthcare chatbot

### Request/Response Examples

#### Basic Triage Assessment
```json
// POST /api/triage
{
  "temperature": 102.5,
  "duration_hours": 24,
  "symptoms": ["headache", "body aches", "fatigue"],
  "age": 35,
  "medical_history": "No significant history"
}
```

#### Enhanced Triage with Photo
```json
// POST /api/triage-enhanced
{
  "temperature": 102.5,
  "duration_hours": 24,
  "symptoms": ["headache", "body aches", "fatigue"],
  "age": 35,
  "medical_history": "No significant history",
  "facial_analysis": {
    "fatigue_indicators": ["dark circles", "pale complexion"],
    "fever_indicators": ["flushed cheeks"],
    "overall_health_appearance": "Appears moderately unwell",
    "confidence_score": 0.85,
    "recommendations": ["Monitor hydration", "Rest recommended"]
  }
}
```

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```env
GEMINI_API_KEY=your_gemini_api_key
PORT=8000
ENVIRONMENT=development
LOG_LEVEL=INFO
FRONTEND_URL=http://localhost:3000
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME="AI Fever Triage System"
NEXT_PUBLIC_ENABLE_CHAT=true
NEXT_PUBLIC_ENABLE_TEMPERATURE_TRACKER=true
NEXT_PUBLIC_ENABLE_MEDICINE_REMINDER=true
```

## 🚀 Deployment

### Backend Deployment (Render)
1. Connect your GitHub repository
2. Set environment variables in Render dashboard
3. Deploy using the provided `render.yaml`

### Frontend Deployment (Vercel)
1. Connect your GitHub repository
2. Set `NEXT_PUBLIC_API_URL` to your backend URL
3. Deploy automatically from main branch

## 🔒 Security & Privacy

- **Data Privacy**: No patient data stored permanently
- **API Security**: Input validation and sanitization
- **Image Processing**: Photos processed in memory, not stored
- **CORS Configuration**: Secure cross-origin requests
- **Medical Disclaimer**: Clear limitations and guidance

## 🧪 Testing

### Backend Tests
```bash
cd fever-backend
python test_gemini_system.py
```

### Frontend Tests
```bash
cd fever-triage
npm run lint
npm run build
```

## 📖 Medical Disclaimer

⚠️ **Important**: This system is for educational and informational purposes only. It does not replace professional medical advice, diagnosis, or treatment. Always consult healthcare professionals for medical concerns.

### Severity Guidelines
- **LOW**: Common viral infections, self-care appropriate
- **MEDIUM**: Flu-like illness, see doctor within 24-48 hours
- **HIGH**: Possible bacterial infection, same-day medical attention
- **CRITICAL**: Signs of serious infection, immediate emergency care

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Google Gemini AI for powerful language and vision capabilities
- FastAPI for excellent async web framework
- Next.js for modern React development
- Medical community for evidence-based guidelines

---

**Built with ❤️ for better healthcare accessibility**
