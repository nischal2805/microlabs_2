'use client';

import { useState } from 'react';
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
  const confidencePercentage = Math.round(results.confidence_score * 100);

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

      {/* Facial Analysis Results */}
      {results.facial_analysis && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-100 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-2xl">📸</span>
            <h3 className="text-xl font-bold text-purple-900">AI Facial Analysis Results</h3>
          </div>

          <div className="space-y-4">
            {/* Confidence Score */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-700 flex items-center space-x-1">
                  <span>🎯</span>
                  <span>Analysis Confidence:</span>
                </span>
                <span className="text-lg font-bold text-purple-600">
                  {Math.round(results.facial_analysis.confidence_score * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round(results.facial_analysis.confidence_score * 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Overall Appearance */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center space-x-2 mb-3">
                <span className="text-lg">👁️</span>
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
                  <span className="text-lg">🌡️</span>
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
                  <span className="text-lg">💡</span>
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
                <span className="text-lg">🤖</span>
                <span className="text-sm font-bold text-gray-700">AI Combined Assessment:</span>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3 border-l-4 border-purple-500">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {results.combined_reasoning}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center pt-4">
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
