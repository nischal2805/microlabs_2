export interface HealthRecord {
  id: string;
  date: string;
  time: string;
  temperature: number;
  symptoms: string[];
  notes?: string;
  timestamp: number;
}

export interface TemperatureTrend {
  isIncreasing: boolean;
  consecutiveDays: number;
  trendPercentage: number;
}

export interface SymptomFrequency {
  symptom: string;
  count: number;
  lastOccurrence: string;
}

class HealthAnalyticsService {
  private static readonly STORAGE_KEY = 'healthRecords';
  
  /**
   * Format date consistently (YYYY-MM-DD)
   */
  private static formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Format date for display (MM/DD/YYYY)
   */
  private static formatDateDisplay(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }

  /**
   * Add a new health record
   */
  static addHealthRecord(temperature: number, symptoms: string[], notes?: string): HealthRecord {
    const now = new Date();
    const record: HealthRecord = {
      id: this.generateId(),
      date: this.formatDateDisplay(now), // Display format for UI
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      temperature,
      symptoms,
      notes,
      timestamp: now.getTime()
    };

    const records = this.getHealthRecords();
    records.push(record);
    this.saveHealthRecords(records);
    
    return record;
  }

  /**
   * Get all health records
   */
  static getHealthRecords(): HealthRecord[] {
    if (typeof window === 'undefined') return [];
    
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  /**
   * Get records for the last N days
   */
  static getRecordsForLastDays(days: number): HealthRecord[] {
    const records = this.getHealthRecords();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return records.filter(record => record.timestamp >= cutoffDate.getTime());
  }

  /**
   * Analyze temperature trend
   */
  static analyzeTemperatureTrend(): TemperatureTrend {
    const records = this.getRecordsForLastDays(7);
    if (records.length < 2) {
      return { isIncreasing: false, consecutiveDays: 0, trendPercentage: 0 };
    }

    // Sort by timestamp
    records.sort((a, b) => a.timestamp - b.timestamp);
    
    // Get last 2 days of records
    const recentRecords = records.slice(-2);
    const olderRecords = records.slice(0, -2);

    // Calculate average temperatures
    const recentAvg = recentRecords.reduce((sum, r) => sum + r.temperature, 0) / recentRecords.length;
    const olderAvg = olderRecords.length > 0 
      ? olderRecords.reduce((sum, r) => sum + r.temperature, 0) / olderRecords.length 
      : recentAvg;

    const isIncreasing = recentAvg > olderAvg;
    const trendPercentage = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

    // Count consecutive increasing days
    let consecutiveDays = 0;
    for (let i = records.length - 1; i > 0; i--) {
      if (records[i].temperature > records[i - 1].temperature) {
        consecutiveDays++;
      } else {
        break;
      }
    }

    return {
      isIncreasing,
      consecutiveDays,
      trendPercentage
    };
  }

  /**
   * Get symptom frequency analysis
   */
  static getSymptomFrequency(): SymptomFrequency[] {
    const records = this.getHealthRecords();
    const symptomMap = new Map<string, { count: number; lastTime: number }>();

    records.forEach(record => {
      record.symptoms.forEach(symptom => {
        const existing = symptomMap.get(symptom) || { count: 0, lastTime: 0 };
        symptomMap.set(symptom, {
          count: existing.count + 1,
          lastTime: Math.max(existing.lastTime, record.timestamp)
        });
      });
    });

    return Array.from(symptomMap.entries())
      .map(([symptom, data]) => ({
        symptom,
        count: data.count,
        lastOccurrence: new Date(data.lastTime).toLocaleDateString()
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get temperature data for graph - returns all individual readings with timestamps
   */
  static getTemperatureData(days: number = 7): { date: string; temperature: number; timestamp: number; time: string }[] {
    const records = this.getRecordsForLastDays(days);
    
    console.log('getTemperatureData: Found records:', records.length);
    console.log('getTemperatureData: Records:', records);
    
    if (records.length === 0) {
      console.log('getTemperatureData: No records found, returning empty array');
      return [];
    }
    
    // Return all individual records sorted by timestamp (oldest first)
    const result = records
      .map(record => ({
        date: record.date, // MM/DD/YYYY format
        temperature: record.temperature,
        timestamp: record.timestamp,
        time: record.time // HH:MM format
      }))
      .sort((a, b) => a.timestamp - b.timestamp); // Sort by timestamp ascending
    
    console.log('getTemperatureData: Final result:', result);
    console.log('getTemperatureData: Result length:', result.length);
    return result;
  }

  /**
   * Check if lab testing is recommended
   */
  static isLabTestingRecommended(): boolean {
    const trend = this.analyzeTemperatureTrend();
    return trend.isIncreasing && trend.consecutiveDays >= 2;
  }

  /**
   * Add sample data for testing
   */
  static addSampleData(): void {
    const sampleData = [
      { temp: 98.6, symptoms: ['headache', 'fatigue'], daysAgo: 6 },
      { temp: 99.2, symptoms: ['headache', 'body ache'], daysAgo: 5 },
      { temp: 99.5, symptoms: ['headache', 'fatigue', 'sore throat'], daysAgo: 4 },
      { temp: 100.1, symptoms: ['fever', 'fatigue', 'chills'], daysAgo: 3 },
      { temp: 100.8, symptoms: ['fever', 'body ache', 'sweating'], daysAgo: 2 },
      { temp: 101.2, symptoms: ['high fever', 'fatigue', 'dizziness'], daysAgo: 1 },
      { temp: 101.8, symptoms: ['high fever', 'severe headache', 'weakness'], daysAgo: 0 },
    ];

    sampleData.forEach(({ temp, symptoms, daysAgo }) => {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      
      const record: HealthRecord = {
        id: this.generateId(),
        date: this.formatDateDisplay(date),
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        temperature: temp,
        symptoms,
        timestamp: date.getTime()
      };

      const records = this.getHealthRecords();
      records.push(record);
      this.saveHealthRecords(records);
    });
  }

  /**
   * Simulate temperature changes
   */
  static simulateTemperatureChange(direction: 'high' | 'low'): void {
    const records = this.getHealthRecords();
    if (records.length === 0) return;

    const lastRecord = records[records.length - 1];
    const baseTemp = lastRecord.temperature;
    
    let newTemp: number;
    if (direction === 'high') {
      newTemp = baseTemp + (Math.random() * 2 + 0.5); // Increase by 0.5-2.5 degrees
    } else {
      newTemp = baseTemp - (Math.random() * 1.5 + 0.3); // Decrease by 0.3-1.8 degrees
    }

    // Keep temperature in realistic range
    newTemp = Math.max(97, Math.min(104, newTemp));

    this.addHealthRecord(
      newTemp,
      lastRecord.symptoms.slice(0, -1), // Keep most symptoms
      `Simulated ${direction} temperature`
    );
  }

  /**
   * Clear all health records
   */
  static clearAllRecords(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  private static saveHealthRecords(records: HealthRecord[]): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));
    }
  }

  private static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

export default HealthAnalyticsService;
