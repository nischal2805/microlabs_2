# Firebase Authentication Setup Guide

This guide will help you set up Firebase Authentication for the AI Fever Triage System.

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard to create your project

## Step 2: Enable Authentication

1. In Firebase Console, go to **Authentication** → **Get Started**
2. Click on **Sign-in method** tab
3. Enable **Email/Password** provider:
   - Click on "Email/Password"
   - Toggle "Enable" to ON
   - Click "Save"

## Step 2.5: Enable Firestore Database (for storing user profiles)

1. In Firebase Console, go to **Firestore Database** → **Create database**
2. Choose **Start in test mode** (for development) or **Production mode** (for production)
3. Select a location for your database
4. Click **Enable**
5. **Important**: For production, set up security rules to protect user data:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

## Step 3: Get Firebase Web App Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to **Your apps** section
3. Click the **Web** icon (`</>`) to add a web app
4. Register your app (give it a nickname)
5. Copy the Firebase configuration object

## Step 4: Configure Frontend

Add the following environment variables to `fever-triage/.env.local`:

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Step 5: Get Firebase Service Account Key (for Backend)

1. In Firebase Console, go to **Project Settings**
2. Go to **Service Accounts** tab
3. Click **Generate new private key**
4. Download the JSON file (keep it secure!)
5. Save it in your `fever-backend` directory (e.g., `serviceAccountKey.json`)

## Step 6: Configure Backend

Add to `fever-backend/.env`:

**Option A: Using Service Account File (Recommended for local development)**

```bash
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
```

**Option B: Using Environment Variables (Recommended for production)**

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your_private_key_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your_client_id
```

## Step 7: Test the Setup

1. Start the backend:

   ```bash
   cd fever-backend
   uvicorn main:app --reload
   ```

2. Start the frontend:

   ```bash
   cd fever-triage
   npm run dev
   ```

3. Visit http://localhost:3000
4. You should see the login/signup page
5. Create an account and test the authentication

## Session Persistence

Firebase Authentication automatically handles session persistence:

- Users stay logged in across browser sessions
- Sessions persist until the user explicitly logs out
- Tokens are automatically refreshed

## Security Notes

- **Never commit** `serviceAccountKey.json` to version control
- Add `serviceAccountKey.json` to `.gitignore`
- In production, use environment variables instead of files
- Keep your Firebase API keys secure

## Troubleshooting

### "Firebase Admin not configured" warning

- Make sure you've set up the service account key or environment variables
- Check that the file path is correct (if using file method)
- Verify all environment variables are set (if using env method)

### "Token verification failed"

- Check that Firebase Admin is properly initialized
- Verify the service account has the correct permissions
- Ensure the token is being sent correctly from the frontend

### Frontend can't connect to Firebase

- Check that all `NEXT_PUBLIC_FIREBASE_*` environment variables are set
- Verify the Firebase project is active
- Check browser console for specific error messages

## Next Steps

- Users can now sign up and log in
- Sessions persist automatically
- Backend endpoints accept optional authentication
- You can extend this to add role-based access control if needed
