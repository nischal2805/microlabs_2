import firebase_admin
from firebase_admin import credentials, auth
import os
import logging

logger = logging.getLogger(__name__)

# Initialize Firebase Admin (only once)
if not firebase_admin._apps:
    # Option 1: Use service account JSON file
    cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin initialized with service account")
    else:
        # Option 2: Use environment variables for service account
        # Check if we have the required environment variables
        service_account_info = {
            "type": "service_account",
            "project_id": os.getenv("FIREBASE_PROJECT_ID"),
            "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID"),
            "private_key": os.getenv("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n"),
            "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
            "client_id": os.getenv("FIREBASE_CLIENT_ID"),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        }
        
        # Only initialize if we have the minimum required fields
        if service_account_info.get("project_id") and service_account_info.get("private_key"):
            try:
                cred = credentials.Certificate(service_account_info)
                firebase_admin.initialize_app(cred)
                logger.info("Firebase Admin initialized with environment variables")
            except Exception as e:
                logger.warning(f"Firebase Admin initialization with env vars failed: {e}")
        else:
            # Option 3: Try Application Default Credentials (for production environments like GCP)
            try:
                firebase_admin.initialize_app()
                logger.info("Firebase Admin initialized with default credentials")
            except Exception as e:
                logger.warning(f"Firebase Admin initialization failed: {e}. Authentication will be optional.")
else:
    logger.info("Firebase Admin already initialized")

def verify_token(token: str) -> dict:
    """Verify Firebase ID token and return decoded token"""
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise

