// API client functions for the fever triage system

export interface PatientData {
  temperature: number;
  duration_hours: number;
  symptoms: string[];
  age: number;
  medical_history?: string;
}

export interface TriageResponse {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  diagnosis_suggestions: string[];
  recommended_action: string;
  clinical_explanation: string;
  red_flags: string[];
  confidence_score: number;
}

export interface FacialAnalysisResponse {
  fatigue_indicators: string[];
  fever_indicators: string[];
  overall_health_appearance: string;
  confidence_score: number;
  recommendations: string[];
}

export interface EnhancedPatientData extends PatientData {
  facial_analysis?: FacialAnalysisResponse;
}

export interface HealthCheckResponse {
  status: string;
  service: string;
  version: string;
  openai_configured: boolean;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new APIError(
        response.status,
        errorData.detail || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    // Network or other errors
    throw new APIError(0, `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function submitTriageAssessment(patientData: PatientData): Promise<TriageResponse> {
  return apiRequest<TriageResponse>('/api/triage', {
    method: 'POST',
    body: JSON.stringify(patientData),
  });
}

export async function analyzePhoto(file: File): Promise<FacialAnalysisResponse> {
  const formData = new FormData();
  formData.append('file', file);
  
  const url = `${API_BASE_URL}/api/analyze-photo`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new APIError(
        response.status,
        errorData.detail || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    throw new APIError(0, `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function submitEnhancedTriageAssessment(patientData: EnhancedPatientData): Promise<TriageResponse> {
  return apiRequest<TriageResponse>('/api/triage-enhanced', {
    method: 'POST',
    body: JSON.stringify(patientData),
  });
}

export async function checkHealth(): Promise<HealthCheckResponse> {
  return apiRequest<HealthCheckResponse>('/api/health');
}

export { APIError };
