'use client';

import { useState } from 'react';
import { TriageResponse } from '@/lib/api';
import { Phone, MapPin, Pill, AlertTriangle } from 'lucide-react';

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
  const [showMedications, setShowMedications] = useState(true);
  const [showDoctors, setShowDoctors] = useState(true);
  
  const config = severityConfig[results.severity];
  const confidencePercentage = Math.round(results.confidence_score * 100);

  return (
    <div className="space-y-6">
      {/* Critical Condition Notice */}
      {results.severity === 'CRITICAL' && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <div className="flex items-center">
            <AlertTriangle className="w-6 h-6 text-red-600 mr-3" />
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

      {/* Emergency Contacts */}
      {results.emergency_contacts && results.emergency_contacts.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-md">
          <div className="flex items-center mb-3">
            <Phone className="w-5 h-5 text-red-700 mr-2" />
            <h3 className="text-lg font-semibold text-red-800">
              Emergency Contacts
            </h3>
          </div>
          <ul className="space-y-2">
            {results.emergency_contacts.map((contact, index) => (
              <li key={index} className="text-red-700 font-medium">
                {contact}
              </li>
            ))}
          </ul>
        </div>
      )}

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

      {/* Photo Analysis (if available) */}
      {results.photo_analysis && (
        <div className="bg-purple-50 border-l-4 border-purple-500 p-6 rounded-md">
          <h3 className="text-lg font-semibold text-purple-800 mb-3">
            Visual Analysis
          </h3>
          <p className="text-purple-700 leading-relaxed">
            {results.photo_analysis}
          </p>
        </div>
      )}

      {/* Microlabs Medications */}
      {results.medications && results.medications.length > 0 && (
        <div className="bg-white rounded-lg shadow-md border">
          <button
            onClick={() => setShowMedications(!showMedications)}
            className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <Pill className="w-5 h-5 text-blue-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-800">
                Recommended Medications (Microlabs)
              </h3>
            </div>
            <span className={`transform transition-transform ${showMedications ? 'rotate-180' : ''}`}>
              ⌄
            </span>
          </button>
          {showMedications && (
            <div className="px-6 pb-6 border-t border-gray-200">
              <div className="mt-4 space-y-4">
                {results.medications.map((med, index) => (
                  <div key={index} className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">{med.name}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Manufacturer:</span>
                        <span className="text-gray-600 ml-2">{med.manufacturer}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Dosage:</span>
                        <span className="text-gray-600 ml-2">{med.dosage}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Frequency:</span>
                        <span className="text-gray-600 ml-2">{med.frequency}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Purpose:</span>
                        <span className="text-gray-600 ml-2">{med.purpose}</span>
                      </div>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-gray-500 mt-2">
                  <strong>Note:</strong> Consult a healthcare provider before taking any medication. Prescription medications require doctor approval.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Nearby Doctors */}
      {results.doctors && results.doctors.length > 0 && (
        <div className="bg-white rounded-lg shadow-md border">
          <button
            onClick={() => setShowDoctors(!showDoctors)}
            className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <MapPin className="w-5 h-5 text-green-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-800">
                Nearby Doctors & Healthcare Providers
              </h3>
            </div>
            <span className={`transform transition-transform ${showDoctors ? 'rotate-180' : ''}`}>
              ⌄
            </span>
          </button>
          {showDoctors && (
            <div className="px-6 pb-6 border-t border-gray-200">
              <div className="mt-4 space-y-4">
                {results.doctors.map((doctor, index) => (
                  <div key={index} className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-2">{doctor.name}</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center">
                        <span className="font-medium text-gray-700 w-24">Specialty:</span>
                        <span className="text-gray-600">{doctor.specialty}</span>
                      </div>
                      <div className="flex items-center">
                        <Phone className="w-4 h-4 text-green-600 mr-2" />
                        <span className="font-medium text-gray-700 w-20">Phone:</span>
                        <a href={`tel:${doctor.phone}`} className="text-blue-600 hover:underline">
                          {doctor.phone}
                        </a>
                      </div>
                      <div className="flex items-start">
                        <MapPin className="w-4 h-4 text-green-600 mr-2 mt-1" />
                        <span className="font-medium text-gray-700 w-20">Address:</span>
                        <span className="text-gray-600 flex-1">{doctor.address}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
                <span className="text-yellow-600 mr-2 mt-1">⚠</span>
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
          Always consult with qualified healthcare providers for proper diagnosis and treatment. Medication recommendations 
          require physician approval before use.
        </p>
      </div>

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
