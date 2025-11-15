'use client';

import { useState, useEffect } from 'react';
import { Search, MapPin, Thermometer, TrendingUp, Activity, AlertTriangle } from 'lucide-react';
import HealthAnalyticsService, { HealthRecord, TemperatureTrend, SymptomFrequency } from '@/lib/healthAnalyticsService';
import TemperatureGraph from '@/components/TemperatureGraph';
import LabService, { Lab } from '@/lib/labService';
import { LocationService } from '@/lib/locationService';
import { Location } from '@/lib/googleMaps';

interface DailyAnalyticsProps {
  googleMapsLoaded: boolean;
}

export default function DailyAnalytics({ googleMapsLoaded }: DailyAnalyticsProps) {
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [temperatureTrend, setTemperatureTrend] = useState<TemperatureTrend | null>(null);
  const [symptomFrequency, setSymptomFrequency] = useState<SymptomFrequency[]>([]);
  const [temperatureData, setTemperatureData] = useState<{ date: string; temperature: number; timestamp: number; time: string }[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Lab finding state
  const [showLabFinder, setShowLabFinder] = useState(false);
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [labLoading, setLabLoading] = useState(false);
  const [labError, setLabError] = useState<string | null>(null);
  
  // Form state
  const [newTemperature, setNewTemperature] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const commonSymptoms = [
    'None', 'headache', 'fatigue', 'body ache', 'sore throat', 'cough', 
    'chills', 'sweating', 'dizziness', 'nausea', 'weakness',
    'fever', 'severe headache', 'chest pain', 'difficulty breathing'
  ];

  useEffect(() => {
    loadData();
  }, []);

  // Auto-refresh every 30 seconds to check for new data
  useEffect(() => {
    const interval = setInterval(() => {
      const currentRecords = HealthAnalyticsService.getHealthRecords();
      const currentTempData = HealthAnalyticsService.getTemperatureData(7);
      
      // Only update if data has actually changed
      if (JSON.stringify(currentRecords) !== JSON.stringify(healthRecords) ||
          JSON.stringify(currentTempData) !== JSON.stringify(temperatureData)) {
        console.log('Auto-refreshing due to data changes...');
        loadData();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [healthRecords, temperatureData]);

  const loadData = () => {
    const records = HealthAnalyticsService.getHealthRecords();
    const trend = HealthAnalyticsService.analyzeTemperatureTrend();
    const symptoms = HealthAnalyticsService.getSymptomFrequency();
    const tempData = HealthAnalyticsService.getTemperatureData(7);

    // Debug: Log the loaded data
    console.log('Loaded records:', records);
    console.log('Temperature data for graph:', tempData);
    console.log('Temperature data length:', tempData.length);
    console.log('Sample temperature data:', tempData.slice(0, 3));

    setHealthRecords(records);
    setTemperatureTrend(trend);
    setSymptomFrequency(symptoms);
    setTemperatureData(tempData);
    setLastUpdated(new Date()); // Update the last updated timestamp

    // Check if lab testing should be recommended
    if (trend.isIncreasing && trend.consecutiveDays >= 2) {
      setShowLabFinder(true);
    }
  };

  const handleAddRecord = () => {
    const temp = parseFloat(newTemperature);
    if (isNaN(temp) || temp < 95 || temp > 107) {
      alert('Please enter a valid temperature between 95°F and 107°F');
      return;
    }

    // Filter out "None" and only include actual symptoms
    const actualSymptoms = selectedSymptoms.filter(symptom => symptom !== 'None');
    
    // Allow submission if either "None" is selected or there are actual symptoms
    if (selectedSymptoms.length === 0) {
      alert('Please select "None" or at least one symptom');
      return;
    }

    // Add the new record
    HealthAnalyticsService.addHealthRecord(temp, actualSymptoms, notes);
    
    // Clear form
    setNewTemperature('');
    setSelectedSymptoms([]);
    setNotes('');
    
    // Immediately reload data to trigger real-time chart update
    console.log('New record added, reloading data for real-time update...');
    loadData();
  };

  const handleSimulateTemperature = (direction: 'high' | 'low') => {
    console.log(`Simulating temperature going ${direction}...`);
    HealthAnalyticsService.simulateTemperatureChange(direction);
    // Immediately reload data to trigger real-time chart update
    loadData();
  };

  const handleFindLabs = async () => {
    if (!googleMapsLoaded) {
      setLabError('Google Maps is not loaded. Please check your API configuration.');
      return;
    }

    setLabLoading(true);
    setLabError(null);

    try {
      const location = userLocation || await LocationService.getCurrentLocation();
      setUserLocation(location);

      const nearbyLabs = await LabService.findNearbyLabs(location);
      const labsWithDirections = await LabService.getDirectionsForMultipleLabs(location, nearbyLabs);
      const sortedLabs = LabService.sortLabsByDistance(labsWithDirections);

      setLabs(sortedLabs);
    } catch (error) {
      console.error('Error finding labs:', error);
      setLabError('Failed to find labs. Please try again.');
    } finally {
      setLabLoading(false);
    }
  };

  const handleNavigateToLab = (lab: Lab) => {
    const mapsUrl = LabService.generateMapsUrl(lab);
    window.open(mapsUrl, '_blank');
  };

  const handleEnableLocation = async () => {
    try {
      const location = await LocationService.getCurrentLocation();
      setUserLocation(location);
    } catch (error) {
      console.error('Error getting location:', error);
      setLabError('Failed to get location. Please enable location services.');
    }
  };

  const getTemperatureColor = (temp: number) => {
    if (temp >= 100.4) return 'text-red-600';
    if (temp >= 99.5) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getTemperatureBgColor = (temp: number) => {
    if (temp >= 100.4) return 'bg-red-50 border-red-200';
    if (temp >= 99.5) return 'bg-yellow-50 border-yellow-200';
    return 'bg-green-50 border-green-200';
  };

  return (
    <div className="space-y-6">
      {/* Temperature Trend Alert */}
      {temperatureTrend?.isIncreasing && temperatureTrend.consecutiveDays >= 2 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <div className="flex items-start">
            <AlertTriangle className="text-red-500 mr-3 mt-1" size={20} />
            <div>
              <h3 className="text-lg font-semibold text-red-800">Temperature Rising</h3>
              <p className="text-red-700 mt-1">
                Your temperature has been increasing for {temperatureTrend.consecutiveDays} consecutive days. 
                Consider visiting a lab for testing.
              </p>
              <button
                onClick={() => setShowLabFinder(true)}
                className="mt-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
              >
                Find Testing Labs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Temperature Graph */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Temperature Trend Analysis</h3>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">Real-time updates</span>
            </div>
            {lastUpdated && (
              <span className="text-xs text-gray-500">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        {/* Debug info (remove in production) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
            Debug: {temperatureData.length} data points | 
            Records: {healthRecords.length} | 
            Data: {JSON.stringify(temperatureData.slice(0, 2))}
          </div>
        )}
        <TemperatureGraph data={temperatureData} />
      </div>

      {/* Add New Record */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Record Today's Health Data</h3>
        
        <div className="space-y-4">
          {/* Temperature Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Temperature (°F)
            </label>
            <input
              type="number"
              step="0.1"
              value={newTemperature}
              onChange={(e) => setNewTemperature(e.target.value)}
              placeholder="e.g., 98.6"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Symptoms Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Symptoms (select all that apply)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {commonSymptoms.map(symptom => (
                <label key={symptom} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedSymptoms.includes(symptom)}
                    onChange={(e) => {
                      if (symptom === 'None') {
                        // If "None" is selected, clear all other symptoms
                        if (e.target.checked) {
                          setSelectedSymptoms(['None']);
                        } else {
                          setSelectedSymptoms([]);
                        }
                      } else {
                        // If a regular symptom is selected, uncheck "None"
                        if (e.target.checked) {
                          const newSymptoms = selectedSymptoms.filter(s => s !== 'None');
                          setSelectedSymptoms([...newSymptoms, symptom]);
                        } else {
                          setSelectedSymptoms(selectedSymptoms.filter(s => s !== symptom));
                        }
                      }
                    }}
                    className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{symptom}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about your condition..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={handleAddRecord}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Record Health Data
          </button>
        </div>
      </div>

      {/* Simulation Controls */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Temperature Simulation (for testing)</h3>
        <div className="flex flex-col space-y-3">
          <div className="flex space-x-4">
            <button
              onClick={() => handleSimulateTemperature('high')}
              className="flex-1 bg-red-600 text-white py-2 rounded-md hover:bg-red-700 transition-colors"
            >
              Simulate Rising Temperature
            </button>
            <button
              onClick={() => handleSimulateTemperature('low')}
              className="flex-1 bg-green-600 text-white py-2 rounded-md hover:bg-green-700 transition-colors"
            >
              Simulate Falling Temperature
            </button>
          </div>
          <button
            onClick={() => {
              HealthAnalyticsService.addSampleData();
              loadData();
              alert('Sample data added! Check the graph above.');
            }}
            className="w-full bg-purple-600 text-white py-2 rounded-md hover:bg-purple-700 transition-colors"
          >
            Add Sample Data (7 days)
          </button>
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-red-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Management</h3>
        <div className="space-y-3">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Warning:</strong> Clearing all records will permanently delete all your health data and reset the graph.
            </p>
          </div>
          <button
            onClick={() => {
              const confirmed = window.confirm(
                'Are you sure you want to delete ALL health records?\n\n' +
                `This will delete ${healthRecords.length} record(s). This action cannot be undone.\n\n` +
                'Click OK to confirm, or Cancel to keep your data.'
              );
              
              if (confirmed) {
                HealthAnalyticsService.clearAllRecords();
                loadData();
                alert('All records have been deleted. The graph has been reset.');
              }
            }}
            className="w-full bg-red-600 text-white py-2 rounded-md hover:bg-red-700 transition-colors font-medium"
          >
            🗑️ Clear All Records
          </button>
          {healthRecords.length > 0 && (
            <p className="text-sm text-gray-600 text-center">
              Currently storing {healthRecords.length} record(s)
            </p>
          )}
        </div>
      </div>

      {/* Recent Records */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Health Records</h3>
        
        {healthRecords.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No health records yet. Start tracking your temperature and symptoms above.</p>
        ) : (
          <div className="space-y-3">
            {healthRecords.slice(-5).reverse().map(record => (
              <div key={record.id} className={`border rounded-lg p-4 ${getTemperatureBgColor(record.temperature)}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Thermometer size={16} className={getTemperatureColor(record.temperature)} />
                      <span className={`font-semibold ${getTemperatureColor(record.temperature)}`}>
                        {record.temperature.toFixed(1)}°F
                      </span>
                      <span className="text-sm text-gray-600">
                        {record.date} at {record.time}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {record.symptoms.length > 0 ? (
                        record.symptoms.map(symptom => (
                          <span key={symptom} className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                            {symptom}
                          </span>
                        ))
                      ) : (
                        <span className="inline-block bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded">
                          No symptoms
                        </span>
                      )}
                    </div>
                    {record.notes && (
                      <p className="text-sm text-gray-600 mt-2">{record.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lab Finder */}
      {showLabFinder && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Find Testing Labs Near You</h3>
          
          {!userLocation ? (
            <div className="text-center py-8">
              <MapPin className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-600 mb-4">Enable location to find nearby labs</p>
              <button
                onClick={handleEnableLocation}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Enable Location
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={handleFindLabs}
                disabled={labLoading}
                className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {labLoading ? 'Searching Labs...' : 'Search Labs'}
              </button>

              {labError && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                  <p className="text-red-700">{labError}</p>
                </div>
              )}

              {labs.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Found {labs.length} labs near you:</h4>
                  {labs.map(lab => (
                    <div key={lab.place_id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <h5 className="font-medium text-gray-900">{lab.name}</h5>
                          <p className="text-sm text-gray-600">{lab.vicinity}</p>
                          {lab.rating && (
                            <div className="flex items-center mt-1">
                              <span className="text-sm text-yellow-600">★</span>
                              <span className="text-sm text-gray-600 ml-1">
                                {lab.rating.toFixed(1)} ({lab.user_ratings_total} reviews)
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          {lab.distance && (
                            <p className="text-sm text-gray-600">{lab.distance}</p>
                          )}
                          {lab.duration && (
                            <p className="text-sm text-gray-600">{lab.duration}</p>
                          )}
                          <button
                            onClick={() => handleNavigateToLab(lab)}
                            className="mt-2 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                          >
                            Navigate
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
