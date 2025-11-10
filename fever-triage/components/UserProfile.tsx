'use client';

import { useState, useEffect } from 'react';

interface UserProfile {
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  location: string;
  medicalConditions: string[];
  allergies: string[];
  currentMedications: string[];
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  preferredLanguage: string;
}

interface UserProfileProps {
  onProfileComplete: (profile: UserProfile) => void;
  onSkip: () => void;
}

const MEDICAL_CONDITIONS = [
  'Diabetes', 'Hypertension', 'Asthma', 'Heart Disease', 'COPD',
  'Kidney Disease', 'Liver Disease', 'Cancer', 'Autoimmune Disorder',
  'Mental Health Condition', 'Thyroid Disorder', 'Arthritis'
];

const COMMON_ALLERGIES = [
  'Penicillin', 'Sulfa Drugs', 'Aspirin', 'NSAIDs', 'Codeine',
  'Peanuts', 'Tree Nuts', 'Shellfish', 'Eggs', 'Milk', 'Soy',
  'Latex', 'Pollen', 'Dust Mites'
];

export default function UserProfile({ onProfileComplete, onSkip }: UserProfileProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    age: 0,
    gender: 'other',
    location: '',
    medicalConditions: [],
    allergies: [],
    currentMedications: [],
    emergencyContact: {
      name: '',
      phone: '',
      relationship: ''
    },
    preferredLanguage: 'English'
  });

  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    // Check if user profile exists in localStorage
    const savedProfile = localStorage.getItem('userProfile');
    if (!savedProfile) {
      setShowProfile(true);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      // Save profile and complete
      localStorage.setItem('userProfile', JSON.stringify(profile));
      onProfileComplete(profile);
      setShowProfile(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('profileSkipped', 'true');
    onSkip();
    setShowProfile(false);
  };

  const toggleCondition = (condition: string) => {
    setProfile(prev => ({
      ...prev,
      medicalConditions: prev.medicalConditions.includes(condition)
        ? prev.medicalConditions.filter(c => c !== condition)
        : [...prev.medicalConditions, condition]
    }));
  };

  const toggleAllergy = (allergy: string) => {
    setProfile(prev => ({
      ...prev,
      allergies: prev.allergies.includes(allergy)
        ? prev.allergies.filter(a => a !== allergy)
        : [...prev.allergies, allergy]
    }));
  };

  if (!showProfile) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-blue-600 text-white p-6 rounded-t-lg">
          <h2 className="text-2xl font-bold">Medical Profile Setup</h2>
          <p className="text-blue-100 mt-2">
            Help us provide better personalized care (Step {currentStep} of 4)
          </p>
        </div>

        <div className="p-6">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Basic Information</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({...profile, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your full name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Age</label>
                  <input
                    type="number"
                    value={profile.age || ''}
                    onChange={(e) => setProfile({...profile, age: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Age"
                    min="0"
                    max="120"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                  <select
                    value={profile.gender}
                    onChange={(e) => setProfile({...profile, gender: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other/Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location (City/State)</label>
                <input
                  type="text"
                  value={profile.location}
                  onChange={(e) => setProfile({...profile, location: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., San Francisco, CA"
                />
              </div>
            </div>
          )}

          {/* Step 2: Medical Conditions */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Medical Conditions</h3>
              <p className="text-sm text-gray-600 mb-4">Select any conditions that apply to you:</p>
              
              <div className="grid grid-cols-2 gap-2">
                {MEDICAL_CONDITIONS.map((condition) => (
                  <button
                    key={condition}
                    onClick={() => toggleCondition(condition)}
                    className={`p-3 rounded-md text-sm font-medium transition-all ${
                      profile.medicalConditions.includes(condition)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {condition}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Other conditions (optional)</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="List any other medical conditions..."
                />
              </div>
            </div>
          )}

          {/* Step 3: Allergies & Medications */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Allergies</h3>
                <p className="text-sm text-gray-600 mb-4">Select any known allergies:</p>
                
                <div className="grid grid-cols-2 gap-2">
                  {COMMON_ALLERGIES.map((allergy) => (
                    <button
                      key={allergy}
                      onClick={() => toggleAllergy(allergy)}
                      className={`p-2 rounded-md text-sm font-medium transition-all ${
                        profile.allergies.includes(allergy)
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {allergy}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Medications</label>
                <textarea
                  value={profile.currentMedications.join(', ')}
                  onChange={(e) => setProfile({
                    ...profile, 
                    currentMedications: e.target.value.split(',').map(m => m.trim()).filter(Boolean)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="List current medications (comma separated)..."
                />
              </div>
            </div>
          )}

          {/* Step 4: Emergency Contact */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Emergency Contact</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact Name</label>
                <input
                  type="text"
                  value={profile.emergencyContact.name}
                  onChange={(e) => setProfile({
                    ...profile, 
                    emergencyContact: {...profile.emergencyContact, name: e.target.value}
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Emergency contact name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={profile.emergencyContact.phone}
                  onChange={(e) => setProfile({
                    ...profile, 
                    emergencyContact: {...profile.emergencyContact, phone: e.target.value}
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Relationship</label>
                <input
                  type="text"
                  value={profile.emergencyContact.relationship}
                  onChange={(e) => setProfile({
                    ...profile, 
                    emergencyContact: {...profile.emergencyContact, relationship: e.target.value}
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Spouse, Parent, Sibling"
                />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t">
            <button
              onClick={handleSkip}
              className="text-gray-500 hover:text-gray-700 font-medium"
            >
              Skip for now
            </button>

            <div className="flex space-x-3">
              {currentStep > 1 && (
                <button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Previous
                </button>
              )}
              
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                {currentStep === 4 ? 'Complete Setup' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
