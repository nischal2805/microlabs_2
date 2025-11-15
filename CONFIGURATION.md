# Configuration Guide

This document provides step-by-step instructions for configuring all API keys and services required for the AI Fever Diagnosis System.

## Table of Contents
1. [Firebase Setup](#firebase-setup)
2. [Google Gemini AI Setup](#google-gemini-ai-setup)
3. [Backend Configuration](#backend-configuration)
4. [Frontend Configuration](#frontend-configuration)
5. [Location Services](#location-services)
6. [Testing Configuration](#testing-configuration)

---

## Firebase Setup

Firebase is used for user authentication and photo storage.

### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project" or select an existing project
3. Enter project name (e.g., "fever-diagnosis-system")
4. Follow the setup wizard (you can disable Google Analytics if not needed)

### Step 2: Enable Authentication

1. In Firebase Console, go to **Build** → **Authentication**
2. Click "Get Started"
3. Enable the following sign-in methods:
   - **Email/Password**: Click on it and toggle "Enable"
   - **Google** (optional): Enable if you want Google sign-in

### Step 3: Create a Web App

1. In Firebase Console, click the **gear icon** (⚙️) → **Project Settings**
2. Scroll down to "Your apps" section
3. Click the **Web** icon (`</>`) to add a web app
4. Register your app with a nickname (e.g., "Fever Diagnosis Web")
5. **Copy the Firebase configuration object** - you'll need this

Example Firebase config:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

### Step 4: Enable Storage for Photos

1. In Firebase Console, go to **Build** → **Storage**
2. Click "Get Started"
3. Choose **Start in production mode** (we'll set rules later)
4. Select a storage location (preferably close to India, e.g., `asia-south1`)
5. Click "Done"

### Step 5: Configure Storage Rules

1. Go to **Storage** → **Rules** tab
2. Replace the rules with:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /patient-photos/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
3. Click "Publish"

---

## Google Gemini AI Setup

Gemini AI is used for analyzing patient symptoms and photos for diagnosis.

### Step 1: Get Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Select "Create API key in new project" or choose an existing project
5. **Copy the API key** - you'll need this for the backend

**Note**: Keep this key secure and never commit it to version control.

### Step 2: Enable Gemini API (if needed)

1. The API should be enabled automatically
2. If you encounter errors, visit [Google Cloud Console](https://console.cloud.google.com/)
3. Enable "Generative Language API" for your project

---

## Backend Configuration

### Step 1: Create Environment File

1. Navigate to the `fever-backend` directory
2. Create a file named `.env` (copy from `.env.example` if available)

### Step 2: Add Required Keys to `.env`

```env
# AI Provider Configuration
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Other AI Providers (fallback)
OPENAI_API_KEY=your_openai_key_here
HUGGINGFACE_API_KEY=your_huggingface_key_here

# Server Configuration
PORT=8000
HOST=0.0.0.0

# CORS Configuration (for development)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Location API (for doctor recommendations)
# Option 1: Google Maps API (Recommended for India)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Option 2: LocationIQ (Alternative)
LOCATIONIQ_API_KEY=your_locationiq_api_key_here
```

### Step 3: Install Python Dependencies

```bash
cd fever-backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Step 4: Run Backend Server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Verify**: Visit `http://localhost:8000/docs` to see the API documentation.

---

## Frontend Configuration

### Step 1: Create Environment File

1. Navigate to the `fever-triage` directory
2. Create a file named `.env.local`

### Step 2: Add Configuration to `.env.local`

```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456

# Location API (Optional - for client-side location features)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

**Note**: All environment variables for Next.js frontend must start with `NEXT_PUBLIC_` to be accessible in the browser.

### Step 3: Install Node Dependencies

```bash
cd fever-triage
npm install
```

### Step 4: Run Frontend Development Server

```bash
npm run dev
```

**Verify**: Visit `http://localhost:3000` to see the application.

---

## Location Services

For doctor recommendations based on location, we need a location/maps API.

### Option 1: Google Maps API (Recommended)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable "Maps JavaScript API" and "Places API"
3. Go to **APIs & Services** → **Credentials**
4. Click "Create Credentials" → "API Key"
5. **Restrict the API key**:
   - Application restrictions: HTTP referrers (for web apps)
   - Add your domains: `localhost:3000`, your production domain
   - API restrictions: Select "Maps JavaScript API" and "Places API"
6. Copy the API key

**Add to both backend and frontend `.env` files**:
```env
GOOGLE_MAPS_API_KEY=your_key_here
```

### Option 2: LocationIQ (Free Alternative)

1. Go to [LocationIQ](https://locationiq.com/)
2. Sign up for a free account
3. Get your API key from the dashboard
4. Add to `.env` files

---

## Testing Configuration

### Backend API Testing

1. Ensure backend is running:
```bash
cd fever-backend
uvicorn main:app --reload
```

2. Visit `http://localhost:8000/api/health` - should return:
```json
{
  "status": "healthy",
  "service": "AI Fever Triage System",
  "ai_provider": "gemini"
}
```

3. Test AI provider:
```bash
curl http://localhost:8000/api/test-providers
```

### Frontend Testing

1. Ensure frontend is running:
```bash
cd fever-triage
npm run dev
```

2. Visit `http://localhost:3000`
3. Try creating an account via Firebase Auth
4. Test the triage assessment flow

### Firebase Testing

1. **Authentication**: Try signing up with email/password
2. **Storage**: Upload a test photo (check Firebase Console → Storage)
3. **Check Console**: Open browser DevTools and check for any Firebase errors

---

## Troubleshooting

### Common Issues

#### Firebase Errors

**"Firebase: Error (auth/configuration-not-found)"**
- Check that all Firebase config values are correct in `.env.local`
- Ensure variables start with `NEXT_PUBLIC_`
- Restart the Next.js dev server after changing `.env.local`

**"Permission denied" for Storage**
- Check Storage Rules in Firebase Console
- Ensure user is authenticated before uploading

#### Gemini API Errors

**"API key not valid"**
- Verify the API key is correct
- Check if the Generative Language API is enabled in Google Cloud Console

**"Rate limit exceeded"**
- Gemini has free tier limits (50 requests per day for some models)
- Consider upgrading or implementing request throttling

#### Location API Errors

**"REQUEST_DENIED"**
- Verify API key is correct
- Check that necessary APIs are enabled (Maps JavaScript API, Places API)
- Verify API key restrictions allow your domain/localhost

#### Connection Errors

**Backend not reachable from frontend**
- Check `NEXT_PUBLIC_API_URL` in frontend `.env.local`
- Ensure backend is running on the correct port
- Check CORS settings in backend `main.py`

---

## Production Deployment

### Environment Variables for Production

When deploying to production platforms (Vercel, Render, etc.):

#### Frontend (Vercel)
Add all `NEXT_PUBLIC_*` variables from `.env.local` to Vercel environment variables.

#### Backend (Render, Railway, etc.)
Add all variables from backend `.env` (without the `NEXT_PUBLIC_` prefix).

### Security Best Practices

1. **Never commit `.env` files** - they're in `.gitignore` for a reason
2. **Use different API keys** for development and production
3. **Restrict API keys** to specific domains/IPs in production
4. **Enable Firebase App Check** for production to prevent abuse
5. **Set up proper CORS** in backend for production domains only

---

## Support

If you encounter issues:
1. Check the logs in your terminal/console
2. Verify all API keys are correctly copied (no extra spaces)
3. Ensure all required APIs are enabled in their respective consoles
4. Check that environment variables are correctly loaded (restart servers after changes)

For Firebase issues: [Firebase Documentation](https://firebase.google.com/docs)
For Gemini issues: [Gemini API Documentation](https://ai.google.dev/docs)
For Next.js issues: [Next.js Documentation](https://nextjs.org/docs)

---

**Last Updated**: 2025-11-15
