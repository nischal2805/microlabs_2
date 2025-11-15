# Usage Guide - AI Fever Diagnosis System

## Quick Start Guide

This guide will help you get started with the AI Fever Diagnosis System.

## Prerequisites

Before you begin, ensure you have:
- ✅ Python 3.11 or higher installed
- ✅ Node.js 18 or higher installed
- ✅ A Google account for Firebase and Gemini API
- ✅ Internet connection for API calls

## Step-by-Step Setup

### 1. Configure API Keys

Follow the detailed instructions in [CONFIGURATION.md](./CONFIGURATION.md) to:
1. Set up Firebase (Authentication & Storage)
2. Get Google Gemini API key
3. Optionally set up Google Maps API for location services

### 2. Backend Setup

```bash
# Navigate to backend directory
cd fever-backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file from example
cp .env.example .env

# Edit .env and add your API keys
# Use nano, vim, or any text editor
nano .env
```

**Required in .env:**
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
AI_PROVIDER=gemini
```

**Start the backend:**
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at: `http://localhost:8000`

### 3. Frontend Setup

```bash
# Navigate to frontend directory (in a new terminal)
cd fever-triage

# Install dependencies
npm install

# Create .env.local file from example
cp .env.local.example .env.local

# Edit .env.local and add your Firebase config
# Use any text editor
nano .env.local
```

**Required in .env.local:**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123
```

**Start the frontend:**
```bash
npm run dev
```

The frontend will be available at: `http://localhost:3000`

## Using the Application

### 1. Create an Account

1. Visit `http://localhost:3000`
2. Click **"Sign In / Sign Up"** in the top right
3. Click **"Sign Up"** tab
4. Enter your details:
   - Full Name
   - Email Address
   - Password (minimum 6 characters)
5. Click **"Create Account"**

### 2. Upload Patient Photo (Optional)

In the assessment form:
1. Click **"Choose Photo"** in the Patient Photo section
2. Select an image from your device (JPG, PNG, GIF)
3. The photo will be analyzed by AI for visual symptoms

### 3. Fill in Patient Information

**Required Fields:**
- **Temperature:** Patient's temperature in Fahrenheit (95-110°F)
- **Duration:** How long they've had fever (in hours)
- **Age:** Patient's age in years
- **Location:** City and state for doctor recommendations
- **Symptoms:** Select all that apply

**Optional:**
- **Food/Diet History:** Recent eating patterns
- **Medical History:** Relevant conditions or medications

### 4. Submit for Diagnosis

Click **"Get AI Diagnosis Assessment"** to submit.

### 5. Review Results

The comprehensive results will show:

#### 📊 Severity Level
- **LOW:** Self-care appropriate
- **MEDIUM:** See doctor within 24-48 hours
- **HIGH:** Same-day medical attention needed
- **CRITICAL:** Immediate emergency care required

#### 🏥 Recommended Action
Clear guidance on what to do next

#### 📞 Emergency Contacts
India-specific emergency numbers for your city

#### 🩺 Possible Diagnoses
AI-generated list of potential conditions

#### 💊 Medications (Microlabs)
- Recommended over-the-counter medications
- Dosage and frequency information
- **Note:** Always consult a doctor before taking medication

#### 👨‍⚕️ Nearby Doctors
- Doctor name and specialty
- Phone number (clickable to call)
- Hospital/clinic address
- Based on your location

#### ⚠️ Warning Signs
Symptoms to monitor that may require immediate attention

#### 📸 Photo Analysis (if uploaded)
Visual analysis of any rashes or visible symptoms

## Features

### 🔐 Firebase Authentication
- Secure user accounts
- Email/password authentication
- Password reset functionality
- Protected photo storage

### 📸 Photo Analysis
- Upload patient photos
- AI analyzes visible symptoms
- Stored securely in Firebase Storage
- Supports rashes, skin conditions, etc.

### 🇮🇳 India-Specific Features
- Emergency numbers by city (108, local helplines)
- Doctor recommendations in major Indian cities
- India-specific diseases (Dengue, Malaria, Typhoid)
- Monsoon and tropical disease considerations

### 💊 Microlabs Medications
- Curated list of Microlabs pharmaceutical products
- Dosage recommendations based on symptoms
- Purpose and frequency guidance
- Safety disclaimers

### 🗺️ Location-Based Services
- Doctor recommendations near you
- Local emergency contacts
- City-specific healthcare resources

## Common Use Cases

### Case 1: Common Cold
**Inputs:**
- Temperature: 99.5°F
- Duration: 12 hours
- Symptoms: Headache, Sore Throat, Runny Nose
- Age: 28

**Expected Output:**
- Severity: LOW
- Recommendation: Rest, hydration, over-the-counter medications
- Medications: Paracetamol, Cetirizine

### Case 2: High Fever
**Inputs:**
- Temperature: 103.2°F
- Duration: 36 hours
- Symptoms: Body Aches, Chills, Fatigue, Headache
- Age: 35
- Location: Mumbai

**Expected Output:**
- Severity: HIGH
- Recommendation: See doctor today
- Medications: Paracetamol, possibly antibiotics (prescription)
- Doctors: List of physicians in Mumbai

### Case 3: Critical Emergency
**Inputs:**
- Temperature: 104.8°F
- Duration: 6 hours
- Symptoms: Confusion, Difficulty Breathing, Chest Pain
- Age: 55

**Expected Output:**
- Severity: CRITICAL
- Recommendation: **CALL 108 IMMEDIATELY**
- Emergency contacts highlighted
- Red flags clearly marked

## Testing with Demo Cases

The app includes pre-configured demo cases:
1. Click **"Demo Cases"** in the assessment screen
2. Select a case (Low, Medium, High, or Critical severity)
3. Form will auto-populate
4. Click submit to see results

## Dashboard Features

Access from the **Dashboard** tab:

### Temperature Tracker
- Log daily temperatures
- View temperature trends
- Visual charts

### Medicine Reminders
- Set medication schedules
- Browser notifications
- Track medication adherence

### User Profile
- Update personal information
- Medical history
- Emergency contacts

### AI Chatbot
- Follow-up questions
- Health advice
- Symptom monitoring

## Troubleshooting

### Backend Not Starting
```bash
# Check if port 8000 is in use
lsof -i :8000

# Kill the process if needed
kill -9 <PID>

# Restart backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Not Starting
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Restart
npm run dev
```

### Firebase Authentication Not Working
1. Check `.env.local` has correct Firebase config
2. Verify Firebase project has Email/Password enabled
3. Restart the Next.js dev server after changing `.env.local`
4. Check browser console for error messages

### Photo Upload Fails
1. Ensure Firebase Storage is enabled
2. Check Storage Rules allow authenticated uploads
3. Verify image is under 5MB
4. Ensure user is signed in

### AI Not Responding
1. Check backend logs for API errors
2. Verify `GEMINI_API_KEY` is correct in backend `.env`
3. Check Gemini API quota in Google Cloud Console
4. Try the `/api/test-providers` endpoint to test AI providers

### No Doctor Recommendations
1. Enter location in the form (e.g., "Mumbai, Maharashtra")
2. Location must be one of the supported cities
3. Backend will return default doctors if location not found

## API Endpoints

### Backend API (http://localhost:8000)

#### Health Check
```bash
GET /api/health
```

#### Triage Assessment
```bash
POST /api/triage
Content-Type: application/json

{
  "temperature": 101.5,
  "duration_hours": 24,
  "symptoms": ["headache", "cough"],
  "age": 30,
  "location": "Mumbai",
  "photo_base64": "..."  // Optional
}
```

#### Test AI Providers
```bash
GET /api/test-providers
```

#### Chat
```bash
POST /api/chat
Content-Type: application/json

{
  "message": "What should I do if fever gets worse?",
  "context": "Previous assessment showed medium severity"
}
```

## Security Best Practices

1. **Never commit `.env` or `.env.local` files**
2. **Use different API keys for development and production**
3. **Restrict API keys to specific domains in production**
4. **Enable Firebase App Check in production**
5. **Review Firebase Storage rules regularly**
6. **Use HTTPS in production**

## Getting Help

If you encounter issues:

1. **Check Configuration:** Review [CONFIGURATION.md](./CONFIGURATION.md)
2. **Check Logs:** Backend and frontend console logs
3. **Test APIs:** Use `/api/health` and `/api/test-providers`
4. **Firebase Console:** Check for authentication or storage errors
5. **Google Cloud Console:** Check Gemini API usage and errors

## Production Deployment

### Backend (Render/Railway/etc.)
1. Push code to GitHub
2. Connect repository to hosting platform
3. Add environment variables from `.env.example`
4. Deploy

### Frontend (Vercel)
1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables from `.env.local.example`
4. Deploy

**Important:** Update `NEXT_PUBLIC_API_URL` to your production backend URL!

## Disclaimer

⚠️ **Medical Disclaimer**: This application is for educational and informational purposes only. It should not be used as a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of qualified healthcare providers with any questions regarding medical conditions.

## License

MIT License - See LICENSE file for details

---

**Built with ❤️ for better healthcare accessibility in India**
