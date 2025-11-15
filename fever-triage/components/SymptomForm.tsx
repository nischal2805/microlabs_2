'use client';

import { useState, useEffect } from 'react';
import { PatientData } from '@/lib/api';
import PhotoUpload from './PhotoUpload';

const AVAILABLE_SYMPTOMS = [
  'Headache', 'Cough', 'Sore Throat', 'Body Aches',
  'Chills', 'Fatigue', 'Nausea', 'Vomiting',
  'Diarrhea', 'Rash', 'Difficulty Breathing', 'Chest Pain',
  'Stiff Neck', 'Confusion', 'Rapid Heartbeat', 'Dizziness',
  'Abdominal Pain', 'Ear Pain', 'Joint Pain', 'Loss of Taste/Smell'
];

const FOOD_OPTIONS = [
  'No appetite', 'Normal appetite', 'Increased appetite',
  'Ate spicy food', 'Ate dairy products', 'Ate raw/undercooked food',
  'Ate street food', 'Drank contaminated water', 'Had alcohol',
  'Skipped meals', 'Only liquids', 'Solid foods'
];

const INDIAN_CITIES = [
  'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata',
  'Hyderabad', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow',
  'Surat', 'Kanpur', 'Nagpur', 'Indore', 'Bhopal'
];

interface SymptomFormProps {
  onSubmit: (data: PatientData) => void;
  loading?: boolean;
  initialData?: Partial<PatientData>;
}

export default function SymptomForm({ onSubmit, loading = false, initialData }: SymptomFormProps) {
  const [formData, setFormData] = useState<PatientData>({
    temperature: initialData?.temperature || 0,
    duration_hours: initialData?.duration_hours || 0,
    age: initialData?.age || 0,
    symptoms: initialData?.symptoms || [],
    medical_history: initialData?.medical_history || '',
    location: initialData?.location || '',
    photo_base64: initialData?.photo_base64 || '',
    photo_url: initialData?.photo_url || ''
  });

  const [foodHistory, setFoodHistory] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleFoodHistory = (food: string) => {
    if (foodHistory.includes(food)) {
      setFoodHistory(foodHistory.filter(f => f !== food));
    } else {
      setFoodHistory([...foodHistory, food]);
    }
  };

  const handlePhotoUploaded = (photoUrl: string, photoData: string) => {
    setFormData({
      ...formData,
      photo_url: photoUrl,
      photo_base64: photoData
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.temperature || formData.temperature < 95 || formData.temperature > 110) {
      newErrors.temperature = 'Temperature must be between 95°F and 110°F';
    }

    if (!formData.duration_hours || formData.duration_hours < 1 || formData.duration_hours > 720) {
      newErrors.duration_hours = 'Duration must be between 1 and 720 hours';
    }

    if (!formData.age || formData.age < 0 || formData.age > 120) {
      newErrors.age = 'Age must be between 0 and 120 years';
    }

    if (formData.symptoms.length === 0) {
      newErrors.symptoms = 'Please select at least one symptom';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      // Include food history in medical history if any selected
      const enhancedData = {
        ...formData,
        medical_history: formData.medical_history + 
          (foodHistory.length > 0 ? `\n\nFood/Diet History: ${foodHistory.join(', ')}` : '')
      };
      onSubmit(enhancedData);
    }
  };

  const toggleSymptom = (symptom: string) => {
    const currentSymptoms = formData.symptoms;
    const symptomLower = symptom.toLowerCase();
    
    if (currentSymptoms.includes(symptomLower)) {
      setFormData({
        ...formData,
        symptoms: currentSymptoms.filter(s => s !== symptomLower)
      });
    } else {
      setFormData({
        ...formData,
        symptoms: [...currentSymptoms, symptomLower]
      });
    }
  };

  // Update form when initialData changes (for demo cases)
  useEffect(() => {
    if (initialData) {
      setFormData({
        temperature: initialData.temperature || 0,
        duration_hours: initialData.duration_hours || 0,
        age: initialData.age || 0,
        symptoms: initialData.symptoms || [],
        medical_history: initialData.medical_history || '',
        location: initialData.location || '',
        photo_base64: initialData.photo_base64 || '',
        photo_url: initialData.photo_url || ''
      });
    }
  }, [initialData]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Temperature Input */}
      <div>
        <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 mb-2">
          Temperature (°F)
        </label>
        <input
          type="number"
          id="temperature"
          step="0.1"
          min="95"
          max="110"
          value={formData.temperature}
          onChange={(e) => setFormData({ ...formData, temperature: e.target.value ? parseFloat(e.target.value) : 0 })}
          className={`
            w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500
            ${errors.temperature ? 'border-red-500' : 'border-gray-300'}
          `}
          disabled={loading}
        />
        {errors.temperature && <p className="mt-1 text-sm text-red-600">{errors.temperature}</p>}
      </div>

      {/* Duration Input */}
      <div>
        <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
          Duration (hours)
        </label>
        <input
          type="number"
          id="duration"
          min="1"
          max="720"
          value={formData.duration_hours}
          onChange={(e) => setFormData({ ...formData, duration_hours: e.target.value ? parseInt(e.target.value) : 0 })}
          className={`
            w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500
            ${errors.duration_hours ? 'border-red-500' : 'border-gray-300'}
          `}
          disabled={loading}
        />
        {errors.duration_hours && <p className="mt-1 text-sm text-red-600">{errors.duration_hours}</p>}
      </div>

      {/* Age Input */}
      <div>
        <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-2">
          Age (years)
        </label>
        <input
          type="number"
          id="age"
          min="0"
          max="120"
          value={formData.age}
          onChange={(e) => setFormData({ ...formData, age: e.target.value ? parseInt(e.target.value) : 0 })}
          className={`
            w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500
            ${errors.age ? 'border-red-500' : 'border-gray-300'}
          `}
          disabled={loading}
        />
        {errors.age && <p className="mt-1 text-sm text-red-600">{errors.age}</p>}
      </div>

      {/* Location Input */}
      <div>
        <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
          Location (City, State)
        </label>
        <input
          type="text"
          id="location"
          list="indian-cities"
          value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          placeholder="e.g., Mumbai, Maharashtra"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        <datalist id="indian-cities">
          {INDIAN_CITIES.map(city => (
            <option key={city} value={city} />
          ))}
        </datalist>
        <p className="mt-1 text-xs text-gray-500">
          For nearby doctor recommendations and emergency contacts
        </p>
      </div>

      {/* Photo Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Patient Photo (Optional)
        </label>
        <PhotoUpload 
          onPhotoUploaded={handlePhotoUploaded}
          currentPhoto={formData.photo_url}
        />
      </div>

      {/* Symptoms Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Symptoms ({formData.symptoms.length} selected)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {AVAILABLE_SYMPTOMS.map((symptom) => {
            const isSelected = formData.symptoms.includes(symptom.toLowerCase());
            return (
              <button
                key={symptom}
                type="button"
                onClick={() => toggleSymptom(symptom)}
                disabled={loading}
                className={`
                  px-3 py-2 rounded-md text-sm font-medium transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${isSelected 
                    ? 'bg-blue-500 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                {symptom}
              </button>
            );
          })}
        </div>
        {errors.symptoms && <p className="mt-2 text-sm text-red-600">{errors.symptoms}</p>}
      </div>

      {/* Food History */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Recent Food/Diet History ({foodHistory.length} selected)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {FOOD_OPTIONS.map((food) => {
            const isSelected = foodHistory.includes(food);
            return (
              <button
                key={food}
                type="button"
                onClick={() => toggleFoodHistory(food)}
                disabled={loading}
                className={`
                  px-3 py-2 rounded-md text-sm font-medium transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${isSelected 
                    ? 'bg-green-500 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                {food}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Select recent eating patterns or specific foods that might be relevant to symptoms
        </p>
      </div>

      {/* Medical History */}
      <div>
        <label htmlFor="medical_history" className="block text-sm font-medium text-gray-700 mb-2">
          Medical History (optional)
        </label>
        <textarea
          id="medical_history"
          rows={3}
          value={formData.medical_history}
          onChange={(e) => setFormData({ ...formData, medical_history: e.target.value })}
          placeholder="Any relevant medical conditions, medications, or recent illnesses..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className={`
          w-full py-3 px-4 rounded-md font-medium text-white transition-all duration-200
          ${loading 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 hover:shadow-lg'
          }
        `}
      >
        {loading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            Analyzing...
          </div>
        ) : (
          'Get AI Diagnosis Assessment'
        )}
      </button>
    </form>
  );
}
