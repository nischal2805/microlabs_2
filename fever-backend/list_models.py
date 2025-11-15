import asyncio
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

async def list_available_models():
    if not GEMINI_API_KEY:
        print("GEMINI_API_KEY not found")
        return
    
    try:
        # List available models endpoint
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={GEMINI_API_KEY}"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            
            if response.status_code == 200:
                result = response.json()
                print("Available Gemini models:")
                print("=" * 50)
                
                if "models" in result:
                    for model in result["models"]:
                        name = model.get("name", "").replace("models/", "")
                        description = model.get("description", "No description")
                        supported_methods = model.get("supportedGenerationMethods", [])
                        
                        print(f"Model: {name}")
                        print(f"Description: {description}")
                        print(f"Supported methods: {', '.join(supported_methods)}")
                        print("-" * 30)
                else:
                    print("No models found in response")
                    print(f"Response: {result}")
            else:
                print(f"Error {response.status_code}: {response.text}")
                
    except Exception as e:
        print(f"Exception: {str(e)}")

if __name__ == "__main__":
    asyncio.run(list_available_models())
