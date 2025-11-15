"use client";

import { useState, useEffect } from 'react';
import { PatientData, EnhancedPatientData, TriageResponse, submitTriageAssessment, submitEnhancedTriageAssessment, APIError } from '@/lib/api';
import SymptomForm from '@/components/SymptomForm';
import ResultsDisplay from '@/components/ResultsDisplay';
import DemoCases from '@/components/DemoCases';
import TemperatureTracker from '@/components/TemperatureTracker';
import MedicineReminder from '@/components/MedicineReminder';
import Chatbot from '@/components/Chatbot';
import UserProfile from '@/components/UserProfile';
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
	PatientData,
	TriageResponse,
	submitTriageAssessment,
	APIError,
} from "@/lib/api";
import SymptomForm from "@/components/SymptomForm";
import ResultsDisplay from "@/components/ResultsDisplay";
import DemoCases from "@/components/DemoCases";
import TemperatureTracker from "@/components/TemperatureTracker";
import MedicineReminder from "@/components/MedicineReminder";
import Chatbot from "@/components/Chatbot";
import UserProfile from "@/components/UserProfile";
import AuthForm from "@/components/AuthForm";

export default function Home() {
	const { user, userProfile, loading: authLoading, logout } = useAuth();
	const [currentStep, setCurrentStep] = useState<
		"form" | "results" | "dashboard"
	>("form");
	const [loading, setLoading] = useState(false);
	const [results, setResults] = useState<TriageResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [demoData, setDemoData] = useState<Partial<PatientData> | null>(null);
	const [showChatbot, setShowChatbot] = useState(false);
	const [showProfileSetup, setShowProfileSetup] = useState(false);

	const handleFormSubmit = async (patientData: PatientData) => {
		setLoading(true);
		setError(null);

  const handleFormSubmit = async (patientData: PatientData | EnhancedPatientData) => {
    setLoading(true);
    setError(null);

    try {
      let assessment: TriageResponse;
      
      // Check if this is enhanced data with facial analysis
      if ('facial_analysis' in patientData && patientData.facial_analysis) {
        console.log('Submitting enhanced assessment with facial analysis');
        assessment = await submitEnhancedTriageAssessment(patientData as EnhancedPatientData);
      } else {
        console.log('Submitting standard assessment');
        assessment = await submitTriageAssessment(patientData as PatientData);
      }
      
      setResults(assessment);
      setCurrentStep('results');
    } catch (err) {
      if (err instanceof APIError) {
        setError(`Assessment failed: ${err.message}`);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
      console.error('Triage assessment error:', err);
    } finally {
      setLoading(false);
    }
  };
		try {
			const assessment = await submitTriageAssessment(patientData);
			setResults(assessment);
			setCurrentStep("results");
		} catch (err) {
			if (err instanceof APIError) {
				setError(`Assessment failed: ${err.message}`);
			} else {
				setError("An unexpected error occurred. Please try again.");
			}
			console.error("Triage assessment error:", err);
		} finally {
			setLoading(false);
		}
	};

	const handleStartNewAssessment = () => {
		setCurrentStep("form");
		setResults(null);
		setError(null);
		setDemoData(null);
		setShowChatbot(false);
	};

	const handleShowDashboard = () => {
		setCurrentStep("dashboard");
	};

	const handleShowChatbot = () => {
		setShowChatbot(true);
	};

	const handleSelectDemoCase = (data: PatientData) => {
		setDemoData(data);
		setError(null);
	};

	const handleProfileComplete = (profile: any) => {
		// Profile is now managed by Firebase, just close the setup modal
		setShowProfileSetup(false);
	};

	const handleProfileSkip = () => {
		setShowProfileSetup(false);
	};

	// Show loading spinner while checking authentication
	if (authLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
				<div className="text-center">
					<div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
					<p className="text-gray-600 text-lg">Loading...</p>
				</div>
			</div>
		);
	}

	// Show login/signup page if not authenticated
	if (!user) {
		return <AuthForm />;
	}

	// Main application (user is authenticated)
	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
			<div className="container mx-auto px-4 py-8">
				{/* Header */}
				<header className="text-center mb-8">
					{/* User Info and Logout */}
					<div className="flex justify-end mb-4">
						<div className="flex items-center space-x-4">
							{(userProfile || user?.displayName) && (
								<div className="flex items-center space-x-2 bg-white/80 px-4 py-2 rounded-lg shadow-sm">
									<span className="text-sm text-gray-600">Welcome,</span>
									<span className="text-sm font-semibold text-blue-900">
										{userProfile?.name ||
											user?.displayName ||
											user?.email?.split("@")[0] ||
											"User"}
									</span>
								</div>
							)}
							<button
								onClick={logout}
								className="text-sm text-gray-600 hover:text-gray-800 px-4 py-2 rounded-md hover:bg-white/50 transition-colors flex items-center space-x-2"
							>
								<span>Sign Out</span>
							</button>
						</div>
					</div>
					<h1 className="text-4xl md:text-5xl font-bold text-blue-900 mb-4">
						AI Fever Triage System
					</h1>
					<p className="text-lg text-blue-700 max-w-2xl mx-auto leading-relaxed">
						Intelligent clinical decision support powered by AI. Get instant
						fever triage assessments based on clinical protocols and
						evidence-based medicine.
					</p>

					{/* Navigation */}
					<div className="flex justify-center space-x-4 mt-6">
						<button
							onClick={() => setCurrentStep("form")}
							className={`px-4 py-2 rounded-md font-medium transition-colors ${
								currentStep === "form"
									? "bg-blue-600 text-white"
									: "bg-white text-blue-600 border border-blue-600 hover:bg-blue-50"
							}`}
						>
							Assessment
						</button>
						<button
							onClick={handleShowDashboard}
							className={`px-4 py-2 rounded-md font-medium transition-colors ${
								currentStep === "dashboard"
									? "bg-blue-600 text-white"
									: "bg-white text-blue-600 border border-blue-600 hover:bg-blue-50"
							}`}
						>
							Dashboard
						</button>
						{results && (
							<button
								onClick={() => setCurrentStep("results")}
								className={`px-4 py-2 rounded-md font-medium transition-colors ${
									currentStep === "results"
										? "bg-blue-600 text-white"
										: "bg-white text-blue-600 border border-blue-600 hover:bg-blue-50"
								}`}
							>
								Results
							</button>
						)}
					</div>
				</header>

				{/* Medical Disclaimer */}
				<div className="bg-gray-50 border-l-4 border-gray-400 p-6 rounded-lg shadow-md mb-8 max-w-4xl mx-auto">
					<div className="flex items-start">
						<div className="ml-3">
							<h3 className="text-lg font-semibold text-gray-800 mb-2">
								Medical Disclaimer
							</h3>
							<p className="text-gray-700 text-sm leading-relaxed">
								This is an AI assistant for{" "}
								<strong>educational and demonstration purposes only</strong>.
								Always consult healthcare professionals for medical advice and
								diagnosis.
							</p>
						</div>
					</div>
				</div>

				{/* Main Content */}
				<div className="max-w-6xl mx-auto">
					{currentStep === "form" ? (
						<div className="bg-white rounded-lg shadow-lg p-8">
							{/* Demo Cases */}
							<DemoCases
								onSelectCase={handleSelectDemoCase}
								disabled={loading}
							/>

							{/* Error Display */}
							{error && (
								<div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md mb-6">
									<div className="flex items-center">
										<div className="flex-shrink-0">
											<span className="text-xl">❌</span>
										</div>
										<div className="ml-3">
											<p className="text-sm text-red-700">{error}</p>
										</div>
									</div>
								</div>
							)}

							{/* Symptom Form */}
							<div>
								<h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
									Patient Assessment Form
								</h2>
								<SymptomForm
									onSubmit={handleFormSubmit}
									loading={loading}
									initialData={demoData || undefined}
								/>
							</div>
						</div>
					) : currentStep === "dashboard" ? (
						<div className="space-y-6">
							<div className="bg-white rounded-lg shadow-lg p-6">
								<h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
									Patient Care Dashboard
								</h2>

								<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
									{/* Temperature Tracker */}
									<div className="bg-gray-50 rounded-lg p-6">
										<TemperatureTracker />
									</div>

									{/* Medicine Reminder */}
									<div className="bg-gray-50 rounded-lg p-6">
										<MedicineReminder />
									</div>
								</div>

								{/* Action Buttons */}
								<div className="mt-8 text-center space-x-4">
									<button
										onClick={handleShowChatbot}
										className="bg-green-600 text-white px-6 py-3 rounded-md font-medium hover:bg-green-700 transition-colors"
									>
										Ask Health Questions
									</button>
									<button
										onClick={() => setCurrentStep("form")}
										className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
									>
										New Assessment
									</button>
								</div>
							</div>
						</div>
					) : (
						<div className="bg-white rounded-lg shadow-lg p-8">
							<h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
								AI Triage Assessment Results
							</h2>
							{results && (
								<div>
									<ResultsDisplay
										results={results}
										onStartNewAssessment={handleStartNewAssessment}
									/>

									{/* Post-Assessment Actions */}
									<div className="mt-8 text-center space-x-4">
										<button
											onClick={handleShowChatbot}
											className="bg-green-600 text-white px-4 py-2 rounded-md font-medium hover:bg-green-700 transition-colors"
										>
											Ask Follow-up Questions
										</button>
										<button
											onClick={handleShowDashboard}
											className="bg-purple-600 text-white px-4 py-2 rounded-md font-medium hover:bg-purple-700 transition-colors"
										>
											Health Dashboard
										</button>
									</div>
								</div>
							)}
						</div>
					)}
				</div>

				{/* Chatbot */}
				{showChatbot && (
					<Chatbot
						assessmentContext={
							results
								? `Recent assessment: ${
										results.severity
								  } severity - ${results.recommended_action.slice(0, 100)}...`
								: undefined
						}
						onClose={() => setShowChatbot(false)}
					/>
				)}

				{/* User Profile Setup */}
				{showProfileSetup && (
					<UserProfile
						onProfileComplete={handleProfileComplete}
						onSkip={handleProfileSkip}
					/>
				)}

				{/* Footer */}
				<footer className="text-center mt-12 text-gray-600">
					<div className="max-w-2xl mx-auto">
						<p className="text-sm mb-4">
							Powered by AI • Built for healthcare professionals and educational
							use
						</p>
						<div className="flex justify-center space-x-6 text-xs">
							<span>Evidence-based protocols</span>
							<span>Real-time assessment</span>
							<span>Safety-first approach</span>
							<span>Temperature tracking</span>
							<span>Medicine reminders</span>
							<span>AI consultation</span>
						</div>
					</div>
				</footer>
			</div>
		</div>
	);
}
