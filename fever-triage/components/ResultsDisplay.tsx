'use client';

import { useState } from 'react';
import { TriageResponse } from '@/lib/api';
import { DoctorSpecialtyService } from '@/lib/doctorSpecialtyService';
import { MapPin, Search } from 'lucide-react';

interface ResultsDisplayProps {
  results: TriageResponse;
  onStartNewAssessment: () => void;
}

const severityConfig = {
  LOW: {
    bgColor: 'bg-green-500',
    textColor: 'text-white',
    title: 'LOW SEVERITY'
  },
  MEDIUM: {
    bgColor: 'bg-yellow-500',
    textColor: 'text-white',
    title: 'MEDIUM SEVERITY'
  },
  HIGH: {
    bgColor: 'bg-orange-500',
    textColor: 'text-white',
    title: 'HIGH SEVERITY'
  },
  CRITICAL: {
    bgColor: 'bg-red-500',
    textColor: 'text-white',
    title: 'CRITICAL SEVERITY'
  }
};

export default function ResultsDisplay({ results, onStartNewAssessment }: ResultsDisplayProps) {
  const [showExplanation, setShowExplanation] = useState(false);
  
  const config = severityConfig[results.severity];
  const confidencePercentage = Math.round(results.confidence_score * 100);

  // Analyze fever type and get doctor recommendations
  const feverAnalysis = DoctorSpecialtyService.analyzeFeverType(results);
  const searchKeywords = DoctorSpecialtyService.getSearchKeywords(feverAnalysis.feverType, feverAnalysis.isEmergency);

  const handleFindSpecializedDoctors = () => {
    // Store the fever analysis in localStorage for the FindDoctors component
    localStorage.setItem('feverAnalysis', JSON.stringify({
      feverType: feverAnalysis.feverType,
      recommendedSpecialties: feverAnalysis.recommendedSpecialties,
      searchKeywords,
      isEmergency: feverAnalysis.isEmergency,
      confidence: feverAnalysis.confidence
    }));
    
    // Redirect to find doctors page
    window.location.href = '/?findDoctors=true';
  };

  return (
    <div className="space-y-6">
      {/* Critical Condition Notice */}
      {results.severity === 'CRITICAL' && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <div className="flex items-center">
            <div className="ml-3">
              <p className="text-sm text-red-700">
                <strong>CRITICAL CONDITION DETECTED:</strong> This patient may require immediate medical evaluation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Severity Badge */}
      <div className="text-center">
        <div className={`inline-flex items-center px-8 py-4 rounded-lg shadow-lg ${config.bgColor} ${config.textColor}`}>
          <div>
            <div className="text-2xl font-bold">{config.title}</div>
            <div className="text-sm opacity-90">Confidence: {confidencePercentage}%</div>
          </div>
        </div>
      </div>

      {/* Recommended Action */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-md">
        <h3 className="text-lg font-semibold text-blue-800 mb-3">
          Recommended Action
        </h3>
        <p className="text-blue-700 text-base leading-relaxed">
          {results.recommended_action}
        </p>
      </div>

      {/* Diagnosis Suggestions */}
      <div className="bg-white p-6 rounded-lg shadow-md border">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Possible Diagnoses
        </h3>
        <ul className="space-y-2">
          {results.diagnosis_suggestions.map((diagnosis, index) => (
            <li key={index} className="flex items-start">
              <span className="text-blue-500 mr-2 mt-1">•</span>
              <span className="text-gray-700">{diagnosis}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Red Flags */}
      {results.red_flags.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-md">
          <h3 className="text-lg font-semibold text-yellow-800 mb-4">
            Warning Signs to Monitor
          </h3>
          <ul className="space-y-2">
            {results.red_flags.map((flag, index) => (
              <li key={index} className="flex items-start">
                <span className="text-yellow-600 mr-2 mt-1">•</span>
                <span className="text-yellow-800">{flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Clinical Explanation (Collapsible) */}
      <div className="bg-gray-50 rounded-lg shadow-md border">
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-100 transition-colors"
        >
          <h3 className="text-lg font-semibold text-gray-800">
            Clinical Explanation
          </h3>
          <span className={`transform transition-transform ${showExplanation ? 'rotate-180' : ''}`}>
            ⌄
          </span>
        </button>
        {showExplanation && (
          <div className="px-6 pb-6 border-t border-gray-200">
            <p className="text-gray-700 leading-relaxed mt-4">
              {results.clinical_explanation}
            </p>
          </div>
        )}
      </div>

      {/* Medical Disclaimer */}
      <div className="bg-gray-100 p-6 rounded-lg border">
        <h4 className="font-semibold text-gray-800 mb-2">
          Medical Disclaimer
        </h4>
        <p className="text-sm text-gray-600 leading-relaxed">
          This AI assessment is for educational purposes only and should not replace professional medical advice. 
          Always consult with qualified healthcare providers for proper diagnosis and treatment.
        </p>
      </div>

      {/* Smart Doctor Recommendation */}
      <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-md">
        <h3 className="text-lg font-semibold text-green-800 mb-3">
          🏥 Smart Doctor Recommendation
        </h3>
        <p className="text-green-700 mb-4">
          Based on your symptoms, we recommend finding a {feverAnalysis.recommendedSpecialties[0]?.specialty?.replace('_', ' ') || 'general practitioner'}.
          <span className="block text-sm mt-1">
            Detected fever type: <strong>{feverAnalysis.feverType.replace('_', ' ')}</strong> (Confidence: {Math.round(feverAnalysis.confidence * 100)}%)
          </span>
        </p>
        <button
          onClick={handleFindSpecializedDoctors}
          className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 px-6 rounded-md font-medium hover:bg-green-700 transition-colors"
        >
          <Search className="w-5 h-5" />
          <MapPin className="w-5 h-5" />
          Find Specialized Doctors Near Me
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4 pt-4">
        <button
          onClick={onStartNewAssessment}
          className="bg-blue-600 text-white py-3 px-8 rounded-md font-medium hover:bg-blue-700 transition-colors"
        >
          Start New Assessment
        </button>
      </div>
    </div>
  );
}
