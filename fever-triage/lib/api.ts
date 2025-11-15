// API client functions for the fever triage system
import { auth } from "./firebase";

export interface PatientData {
	temperature: number;
	duration_hours: number;
	symptoms: string[];
	age: number;
	medical_history?: string;
}

export interface TriageResponse {
	severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
	diagnosis_suggestions: string[];
	recommended_action: string;
	clinical_explanation: string;
	red_flags: string[];
	confidence_score: number;
}

export interface HealthCheckResponse {
	status: string;
	service: string;
	version: string;
	openai_configured: boolean;
}

export interface FacialAnalysisResponse {
	fatigue_indicators: string[];
	fever_indicators: string[];
	overall_health_appearance: string;
	confidence_score: number;
	recommendations: string[];
}

export interface ComprehensiveTriageResponse {
	// Basic triage response
	severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
	diagnosis_suggestions: string[];
	recommended_action: string;
	clinical_explanation: string;
	red_flags: string[];
	confidence_score: number;
	
	// Photo analysis results
	facial_analysis?: FacialAnalysisResponse;
	
	// Location and time context
	location_context?: string;
	seasonal_context?: string;
	likely_fever_types: {type: string, likelihood: number}[];
	home_remedies: string[];
	
	// Combined assessment
	combined_reasoning: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class APIError extends Error {
	constructor(public status: number, message: string) {
		super(message);
		this.name = "APIError";
	}
}

async function apiRequest<T>(
	endpoint: string,
	options: RequestInit = {}
): Promise<T> {
	const url = `${API_BASE_URL}${endpoint}`;

	// Get Firebase auth token if user is logged in
	let token: string | null = null;
	if (auth.currentUser) {
		try {
			token = await auth.currentUser.getIdToken();
		} catch (error) {
			console.warn("Failed to get auth token:", error);
		}
	}

	try {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...(options.headers as Record<string, string>),
		};

		// Add authorization header if token is available
		if (token) {
			headers["Authorization"] = `Bearer ${token}`;
		}

		const response = await fetch(url, {
			headers,
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
		throw new APIError(
			0,
			`Network error: ${
				error instanceof Error ? error.message : "Unknown error"
			}`
		);
	}
}

export async function submitTriageAssessment(
	patientData: PatientData
): Promise<TriageResponse> {
	return apiRequest<TriageResponse>("/api/triage", {
		method: "POST",
		body: JSON.stringify(patientData),
	});
}

export async function checkHealth(): Promise<HealthCheckResponse> {
	return apiRequest<HealthCheckResponse>("/api/health");
}

export async function analyzePhoto(file: File): Promise<FacialAnalysisResponse> {
	const formData = new FormData();
	formData.append('photo', file);

	// Get Firebase auth token if user is logged in
	let token: string | null = null;
	if (auth.currentUser) {
		try {
			token = await auth.currentUser.getIdToken();
		} catch (error) {
			console.warn("Failed to get auth token:", error);
		}
	}

	const headers: Record<string, string> = {};
	if (token) {
		headers["Authorization"] = `Bearer ${token}`;
	}

	try {
		const response = await fetch(`${API_BASE_URL}/api/analyze-photo`, {
			method: 'POST',
			headers,
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

		// Network or other errors
		throw new APIError(
			0,
			`Network error: ${
				error instanceof Error ? error.message : "Unknown error"
			}`
		);
	}
}

export async function submitComprehensiveTriageAssessment(
	patientData: PatientData,
	photo?: File,
	location?: {latitude: number, longitude: number}
): Promise<ComprehensiveTriageResponse> {
	const formData = new FormData();
	
	// Add patient data as JSON
	formData.append('patient_data', JSON.stringify(patientData));
	
	// Add photo if provided
	if (photo) {
		formData.append('photo', photo);
	}
	
	// Add location if provided
	if (location) {
		formData.append('latitude', location.latitude.toString());
		formData.append('longitude', location.longitude.toString());
	}
	
	// Add current time
	formData.append('assessment_time', new Date().toISOString());

	// Get Firebase auth token if user is logged in
	let token: string | null = null;
	if (auth.currentUser) {
		try {
			token = await auth.currentUser.getIdToken();
		} catch (error) {
			console.warn("Failed to get auth token:", error);
		}
	}

	const headers: Record<string, string> = {};
	if (token) {
		headers["Authorization"] = `Bearer ${token}`;
	}

	try {
		const response = await fetch(`${API_BASE_URL}/api/triage-comprehensive`, {
			method: 'POST',
			headers,
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

		// Network or other errors
		throw new APIError(
			0,
			`Network error: ${
				error instanceof Error ? error.message : "Unknown error"
			}`
		);
	}
}

export { APIError };
