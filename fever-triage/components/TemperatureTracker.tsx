'use client';

import { useState, useEffect } from 'react';

interface TemperatureReading {
  date: string;
  time: string;
  temperature: number;
  notes?: string;
}

interface TemperatureTrackerProps {
  currentTemp?: number;
  onTemperatureAdd?: (reading: TemperatureReading) => void;
}

export default function TemperatureTracker({ currentTemp, onTemperatureAdd }: TemperatureTrackerProps) {
  const [readings, setReadings] = useState<TemperatureReading[]>([]);
  const [newTemp, setNewTemp] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Load temperature history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('temperature_history');
    if (saved) {
      try {
        setReadings(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading temperature history:', e);
      }
    }
  }, []);

  // Save temperature history to localStorage
  useEffect(() => {
    if (readings.length > 0) {
      localStorage.setItem('temperature_history', JSON.stringify(readings));
    }
  }, [readings]);

  const addReading = () => {
    if (!newTemp || parseFloat(newTemp) < 95 || parseFloat(newTemp) > 110) {
      alert('Please enter a valid temperature between 95°F and 110°F');
      return;
    }

    const now = new Date();
    const reading: TemperatureReading = {
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      temperature: parseFloat(newTemp),
      notes: notes.trim() || undefined
    };

    const updatedReadings = [reading, ...readings].slice(0, 10); // Keep last 10 readings
    setReadings(updatedReadings);
    
    if (onTemperatureAdd) {
      onTemperatureAdd(reading);
    }

    // Reset form
    setNewTemp('');
    setNotes('');
    setShowAddForm(false);
  };

  const getTrendIcon = (index: number) => {
    if (index === readings.length - 1) return ''; // No trend for last reading
    
    const current = readings[index].temperature;
    const previous = readings[index + 1].temperature;
    
    if (current > previous) return '↗️';
    if (current < previous) return '↘️';
    return '➡️';
  };

  const getTemperatureColor = (temp: number) => {
    if (temp < 99) return 'text-green-600';
    if (temp < 101) return 'text-yellow-600';
    if (temp < 103) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          Temperature Tracking
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-600 transition-colors"
        >
          {showAddForm ? 'Cancel' : 'Add Reading'}
        </button>
      </div>

      {/* Add Temperature Form */}
      {showAddForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Temperature (°F)
              </label>
              <input
                type="number"
                step="0.1"
                min="95"
                max="110"
                value={newTemp}
                onChange={(e) => setNewTemp(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="98.6"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="After medication, morning reading..."
              />
            </div>
          </div>
          <button
            onClick={addReading}
            className="mt-4 bg-green-500 text-white px-6 py-2 rounded-md hover:bg-green-600 transition-colors"
          >
            Add Reading
          </button>
        </div>
      )}

      {/* Temperature History */}
      {readings.length > 0 ? (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700">Recent Readings</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {readings.map((reading, index) => (
              <div
                key={`${reading.date}-${reading.time}`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="text-sm text-gray-500">
                    {reading.date} {reading.time}
                  </div>
                  <div className={`font-semibold ${getTemperatureColor(reading.temperature)}`}>
                    {reading.temperature}°F
                  </div>
                  <span className="text-lg">{getTrendIcon(index)}</span>
                </div>
                {reading.notes && (
                  <div className="text-sm text-gray-600 italic">
                    {reading.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Simple trend analysis */}
          {readings.length >= 2 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <h5 className="font-medium text-blue-800 mb-2">Trend Analysis</h5>
              <div className="text-sm text-blue-700">
                {readings[0].temperature > readings[1].temperature ? (
                  <span>Temperature is rising. Monitor closely and consider medical consultation.</span>
                ) : readings[0].temperature < readings[1].temperature ? (
                  <span>Temperature is decreasing. This is a positive sign.</span>
                ) : (
                  <span>Temperature is stable.</span>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>No temperature readings recorded yet.</p>
          <p className="text-sm mt-2">Add your first reading to start tracking your fever.</p>
        </div>
      )}
    </div>
  );
}
