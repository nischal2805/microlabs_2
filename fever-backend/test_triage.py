import asyncio
import httpx
import json

async def test_triage():
    url = "http://localhost:8000/api/triage"
    
    test_data = {
        "temperature": 103.0,
        "duration_hours": 24,
        "age": 20,
        "symptoms": ["headache", "body aches", "chills"],
        "medical_history": "No significant medical history"
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=test_data)
            
            if response.status_code == 200:
                result = response.json()
                print("✅ Triage assessment SUCCESS!")
                print(f"Severity: {result['severity']}")
                print(f"Diagnosis: {', '.join(result['diagnosis_suggestions'])}")
                print(f"Recommended Action: {result['recommended_action']}")
                print(f"Confidence: {result['confidence_score']:.2f}")
            else:
                print(f"❌ Triage assessment FAILED: {response.status_code}")
                print(f"Error: {response.text}")
                
    except Exception as e:
        print(f"❌ Exception: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_triage())
