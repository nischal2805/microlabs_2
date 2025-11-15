'use client';

import { useState } from 'react';
import { TriageResponse } from '@/lib/api';
import { DoctorSpecialtyService } from '@/lib/doctorSpecialtyService';
import { MapPin, Search } from 'lucide-react';
import { ComprehensiveTriageResponse } from '@/lib/api';

interface ResultsDisplayProps {
  results: ComprehensiveTriageResponse;
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

      {/* Location-Based Fever Analysis */}
      {results.likely_fever_types && results.likely_fever_types.length > 0 && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-md">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">
            Most Likely Fever Types in Your Area
          </h3>
          <div className="space-y-3">
            {results.likely_fever_types.map((fever, index) => (
              <div key={index} className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-red-500' : index === 1 ? 'bg-orange-500' : 'bg-yellow-500'}`}></div>
                  <span className="font-medium text-gray-800">{fever.type}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-blue-600">
                    {Math.round(fever.likelihood * 100)}% likely
                  </div>
                  <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round(fever.likelihood * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {results.location_context && (
            <div className="mt-4 p-3 bg-blue-100 rounded-lg">
              <p className="text-sm text-blue-800">{results.location_context}</p>
            </div>
          )}
        </div>
      )}

      {/* Home Remedies */}
      {results.home_remedies && results.home_remedies.length > 0 && (
        <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-md">
          <h3 className="text-lg font-semibold text-green-800 mb-4">
            Recommended Home Care (Low-Risk Cases Only)
          </h3>
          <ul className="space-y-2">
            {results.home_remedies.map((remedy, index) => (
              <li key={index} className="flex items-start">
                <span className="text-green-600 mr-2 mt-1">•</span>
                <span className="text-green-800 text-sm">{remedy}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
          Smart Doctor Recommendation
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
      {/* Facial Analysis Results */}
      {results.facial_analysis && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-100 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center space-x-2 mb-4">
            
            <h3 className="text-xl font-bold text-purple-900">AI Facial Analysis Results</h3>
          </div>

          <div className="space-y-4">
            {/* Overall Appearance */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center space-x-2 mb-3">

                <span className="text-sm font-bold text-gray-700">Overall Health Appearance:</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border-l-4 border-purple-500">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {results.facial_analysis.overall_health_appearance}
                </p>
              </div>
            </div>

            {/* Fatigue Indicators */}
            {results.facial_analysis.fatigue_indicators.length > 0 && (
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-lg">😴</span>
                  <span className="text-sm font-bold text-gray-700">Detected Fatigue Signs:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {results.facial_analysis.fatigue_indicators.map((indicator: string, index: number) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 bg-yellow-50 border border-yellow-200 rounded-lg p-2"
                    >
                      <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                      <span className="text-sm text-yellow-800 font-medium">{indicator}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fever Indicators */}
            {results.facial_analysis.fever_indicators.length > 0 && (
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center space-x-2 mb-3">

                  <span className="text-sm font-bold text-gray-700">Detected Fever Signs:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {results.facial_analysis.fever_indicators.map((indicator: string, index: number) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 bg-red-50 border border-red-200 rounded-lg p-2"
                    >
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      <span className="text-sm text-red-800 font-medium">{indicator}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Recommendations */}
            {results.facial_analysis.recommendations.length > 0 && (
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center space-x-2 mb-3">

                  <span className="text-sm font-bold text-gray-700">Photo-Based Recommendations:</span>
                </div>
                <div className="space-y-2">
                  {results.facial_analysis.recommendations.map((rec: string, index: number) => (
                    <div key={index} className="flex items-start space-x-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mt-0.5">
                        {index + 1}
                      </div>
                      <p className="text-sm text-blue-800 leading-relaxed flex-1">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Combined Reasoning */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center space-x-2 mb-3">
                <span className="text-sm font-bold text-gray-700">AI Combined Assessment:</span>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {results.combined_reasoning}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location Context */}
      {results.location_context && (
        <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl p-6 border border-brown-200 mt-6">
          <div className="text-center mb-4">
            <div className="flex items-center justify-center space-x-2 text-brown-400">
              <span className="font-bold text-lg">Location-Based Health Insights</span>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center space-x-2 mb-3">

              <span className="text-sm font-bold text-gray-700">Local Health Context:</span>
            </div>
            <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
              <p className="text-sm text-gray-700 leading-relaxed">
                {results.location_context}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Seasonal/Time Context */}
      {results.seasonal_context && (
        <div className="bg-gradient-to-br from-yellow-50 to-orange-100 rounded-xl p-6 border border-yellow-200 mt-6">
          <div className="text-center mb-4">
            <div className="flex items-center justify-center space-x-2 text-orange-600">
              <span className="font-bold text-lg">Timing & Seasonal Insights</span>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center space-x-2 mb-3">

              <span className="text-sm font-bold text-gray-700">Time-Based Health Context:</span>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 border-l-4 border-yellow-500">
              <p className="text-sm text-gray-700 leading-relaxed">
                {results.seasonal_context}
              </p>
            </div>
          </div>
        </div>
      )}

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
