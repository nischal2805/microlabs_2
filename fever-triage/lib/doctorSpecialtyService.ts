import { TriageResponse } from './api';

export interface DoctorSpecialty {
  specialty: string;
  keywords: string[];
  priority: number; // 1 = highest priority
}

export interface SpecialtyMapping {
  feverType: string;
  specialties: DoctorSpecialty[];
  emergencyKeywords: string[];
}

// Mapping of fever types to appropriate doctor specialties
const FEVER_SPECIALTY_MAPPING: SpecialtyMapping[] = [
  {
    feverType: 'viral_fever',
    specialties: [
      { specialty: 'general_practitioner', keywords: ['general', 'family', 'primary'], priority: 1 },
      { specialty: 'internal_medicine', keywords: ['internal', 'medicine'], priority: 2 },
      { specialty: 'infectious_disease', keywords: ['infectious', 'virus'], priority: 3 }
    ],
    emergencyKeywords: ['high fever', 'severe', 'emergency']
  },
  {
    feverType: 'bacterial_infection',
    specialties: [
      { specialty: 'general_practitioner', keywords: ['general', 'family', 'primary'], priority: 1 },
      { specialty: 'internal_medicine', keywords: ['internal', 'medicine'], priority: 2 },
      { specialty: 'infectious_disease', keywords: ['infectious', 'bacterial'], priority: 3 }
    ],
    emergencyKeywords: ['severe infection', 'antibiotics needed', 'emergency']
  },
  {
    feverType: 'dengue',
    specialties: [
      { specialty: 'infectious_disease', keywords: ['infectious', 'tropical'], priority: 1 },
      { specialty: 'general_practitioner', keywords: ['general', 'family'], priority: 2 },
      { specialty: 'emergency_medicine', keywords: ['emergency', 'urgent'], priority: 3 }
    ],
    emergencyKeywords: ['dengue', 'severe', 'platelets', 'emergency']
  },
  {
    feverType: 'malaria',
    specialties: [
      { specialty: 'infectious_disease', keywords: ['infectious', 'tropical'], priority: 1 },
      { specialty: 'general_practitioner', keywords: ['general', 'family'], priority: 2 },
      { specialty: 'emergency_medicine', keywords: ['emergency', 'urgent'], priority: 3 }
    ],
    emergencyKeywords: ['malaria', 'severe', 'emergency']
  },
  {
    feverType: 'typhoid',
    specialties: [
      { specialty: 'general_practitioner', keywords: ['general', 'family'], priority: 1 },
      { specialty: 'internal_medicine', keywords: ['internal', 'medicine'], priority: 2 },
      { specialty: 'gastroenterologist', keywords: ['gastro', 'digestive'], priority: 3 }
    ],
    emergencyKeywords: ['typhoid', 'severe', 'emergency']
  },
  {
    feverType: 'respiratory_infection',
    specialties: [
      { specialty: 'pulmonologist', keywords: ['pulmonary', 'lung', 'respiratory'], priority: 1 },
      { specialty: 'general_practitioner', keywords: ['general', 'family'], priority: 2 },
      { specialty: 'internal_medicine', keywords: ['internal', 'medicine'], priority: 3 }
    ],
    emergencyKeywords: ['breathing difficulty', 'severe cough', 'emergency']
  },
  {
    feverType: 'urinary_tract_infection',
    specialties: [
      { specialty: 'urologist', keywords: ['urology', 'urinary'], priority: 1 },
      { specialty: 'general_practitioner', keywords: ['general', 'family'], priority: 2 },
      { specialty: 'internal_medicine', keywords: ['internal', 'medicine'], priority: 3 }
    ],
    emergencyKeywords: ['severe UTI', 'kidney infection', 'emergency']
  },
  {
    feverType: 'gastrointestinal',
    specialties: [
      { specialty: 'gastroenterologist', keywords: ['gastro', 'digestive', 'stomach'], priority: 1 },
      { specialty: 'general_practitioner', keywords: ['general', 'family'], priority: 2 },
      { specialty: 'internal_medicine', keywords: ['internal', 'medicine'], priority: 3 }
    ],
    emergencyKeywords: ['severe dehydration', 'emergency']
  },
  {
    feverType: 'unknown',
    specialties: [
      { specialty: 'general_practitioner', keywords: ['general', 'family', 'primary'], priority: 1 },
      { specialty: 'internal_medicine', keywords: ['internal', 'medicine'], priority: 2 },
      { specialty: 'emergency_medicine', keywords: ['emergency', 'urgent'], priority: 3 }
    ],
    emergencyKeywords: ['unknown fever', 'emergency']
  }
];

export class DoctorSpecialtyService {
  /**
   * Analyze triage response to determine fever type and recommended specialties
   */
  static analyzeFeverType(triageResponse: TriageResponse): {
    feverType: string;
    recommendedSpecialties: DoctorSpecialty[];
    isEmergency: boolean;
    confidence: number;
  } {
    const { diagnosis_suggestions, severity, recommended_action } = triageResponse;
    
    // Determine fever type based on diagnosis suggestions
    let feverType = 'unknown';
    let confidence = 0.5;
    
    // Check for specific fever types in diagnosis suggestions
    for (const mapping of FEVER_SPECIALTY_MAPPING) {
      if (mapping.feverType === 'unknown') continue;
      
      const feverKeywords = this.getFeverKeywords(mapping.feverType);
      const matchCount = feverKeywords.filter(keyword => 
        diagnosis_suggestions.some(diagnosis => 
          diagnosis.toLowerCase().includes(keyword.toLowerCase())
        )
      ).length;
      
      if (matchCount > 0) {
        feverType = mapping.feverType;
        confidence = Math.min(0.9, 0.5 + (matchCount * 0.2));
        break;
      }
    }
    
    // Check if emergency based on severity and keywords
    const isEmergency = severity === 'CRITICAL' || 
      severity === 'HIGH' ||
      diagnosis_suggestions.some(diagnosis => 
        FEVER_SPECIALTY_MAPPING.some(mapping =>
          mapping.emergencyKeywords.some(keyword =>
            diagnosis.toLowerCase().includes(keyword.toLowerCase())
          )
        )
      );
    
    // Get recommended specialties
    const mapping = FEVER_SPECIALTY_MAPPING.find(m => m.feverType === feverType);
    const recommendedSpecialties = mapping?.specialties || FEVER_SPECIALTY_MAPPING.find(m => m.feverType === 'unknown')?.specialties || [];
    
    return {
      feverType,
      recommendedSpecialties,
      isEmergency,
      confidence
    };
  }
  
  /**
   * Get search keywords for Places API based on fever type
   */
  static getSearchKeywords(feverType: string, isEmergency: boolean = false): string {
    const mapping = FEVER_SPECIALTY_MAPPING.find(m => m.feverType === feverType);
    if (!mapping) return 'doctor hospital clinic medical';
    
    const baseKeywords = ['doctor', 'hospital', 'clinic', 'medical'];
    const specialtyKeywords = mapping.specialties[0]?.keywords || [];
    const emergencyKeywords = isEmergency ? ['emergency', 'urgent'] : [];
    
    return [...baseKeywords, ...specialtyKeywords, ...emergencyKeywords].join(' ');
  }
  
  /**
   * Get keywords for identifying specific fever types
   */
  private static getFeverKeywords(feverType: string): string[] {
    const keywordMap: Record<string, string[]> = {
      'viral_fever': ['viral', 'virus', 'flu', 'influenza'],
      'bacterial_infection': ['bacterial', 'infection', 'bacteria'],
      'dengue': ['dengue', 'breakbone fever'],
      'malaria': ['malaria', 'plasmodium'],
      'typhoid': ['typhoid', 'salmonella'],
      'respiratory_infection': ['respiratory', 'lung', 'pneumonia', 'bronchitis'],
      'urinary_tract_infection': ['urinary', 'uti', 'bladder', 'kidney'],
      'gastrointestinal': ['gastro', 'stomach', 'digestive', 'diarrhea']
    };
    
    return keywordMap[feverType] || [];
  }
  
  /**
   * Filter doctors based on recommended specialties
   */
  static filterDoctorsBySpecialty(
    doctors: any[], 
    recommendedSpecialties: DoctorSpecialty[]
  ): any[] {
    if (!doctors.length) return [];
    
    // Score doctors based on specialty match
    const scoredDoctors = doctors.map(doctor => {
      let score = 0;
      const doctorName = doctor.name.toLowerCase();
      const doctorTypes = doctor.types || [];
      
      for (const specialty of recommendedSpecialties) {
        // Check name and types for specialty keywords
        const nameMatch = specialty.keywords.some(keyword => 
          doctorName.includes(keyword.toLowerCase())
        );
        
        const typeMatch = doctorTypes.some((type: string) => 
          specialty.keywords.some(keyword => 
            type.toLowerCase().includes(keyword.toLowerCase())
          )
        );
        
        if (nameMatch || typeMatch) {
          score += (4 - specialty.priority); // Higher priority gets higher score
        }
      }
      
      return { ...doctor, specialtyScore: score };
    });
    
    // Sort by specialty score (highest first) and return top results
    return scoredDoctors
      .sort((a, b) => b.specialtyScore - a.specialtyScore)
      .filter(doctor => doctor.specialtyScore > 0);
  }
}
