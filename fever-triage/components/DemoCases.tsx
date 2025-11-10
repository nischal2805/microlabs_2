'use client';

import { PatientData } from '@/lib/api';

interface DemoCase {
  name: string;
  description: string;
  data: PatientData;
  color: string;
}

const demoCases: DemoCase[] = [
  {
    name: 'Common Cold',
    description: 'Mild viral infection',
    data: {
      temperature: 99.8,
      duration_hours: 24,
      age: 28,
      symptoms: ['sore throat', 'runny nose'],
      medical_history: 'No significant medical history'
    },
    color: 'bg-green-500 hover:bg-green-600'
  },
  {
    name: 'Flu',
    description: 'Moderate flu symptoms',
    data: {
      temperature: 102.5,
      duration_hours: 18,
      age: 45,
      symptoms: ['body aches', 'chills', 'headache', 'fatigue'],
      medical_history: 'Healthy adult'
    },
    color: 'bg-yellow-500 hover:bg-yellow-600'
  },
  {
    name: 'Pneumonia',
    description: 'Possible bacterial pneumonia',
    data: {
      temperature: 103.8,
      duration_hours: 48,
      age: 67,
      symptoms: ['chest pain', 'cough', 'difficulty breathing'],
      medical_history: 'History of COPD, current smoker'
    },
    color: 'bg-orange-500 hover:bg-orange-600'
  },
  {
    name: 'Critical Sepsis',
    description: 'Potential sepsis - emergency',
    data: {
      temperature: 105.0,
      duration_hours: 8,
      age: 55,
      symptoms: ['confusion', 'rapid heartbeat', 'chills', 'dizziness'],
      medical_history: 'Diabetes, recent UTI'
    },
    color: 'bg-red-500 hover:bg-red-600 animate-pulse'
  }
];

interface DemoCasesProps {
  onSelectCase: (data: PatientData) => void;
  disabled?: boolean;
}

export default function DemoCases({ onSelectCase, disabled = false }: DemoCasesProps) {
  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        Quick Demo Cases
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {demoCases.map((demoCase, index) => (
          <button
            key={index}
            onClick={() => onSelectCase(demoCase.data)}
            disabled={disabled}
            className={`
              ${demoCase.color}
              text-white p-4 rounded-lg shadow-md transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              hover:shadow-lg hover:scale-105 active:scale-95
              text-left
            `}
          >
            <div className="font-bold text-sm mb-1">{demoCase.name}</div>
            <div className="text-xs opacity-90 mb-2">{demoCase.description}</div>
            <div className="text-xs opacity-75">
              {demoCase.data.temperature}°F • {demoCase.data.age}y • {demoCase.data.duration_hours}h
            </div>
          </button>
        ))}
      </div>
      <p className="text-sm text-gray-600 mt-3">
        Click any demo case to quickly populate the form with sample data
      </p>
    </div>
  );
}
