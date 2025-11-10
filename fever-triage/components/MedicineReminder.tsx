'use client';

import { useState, useEffect } from 'react';

interface MedicineReminder {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  nextDue: Date;
  isActive: boolean;
}

export default function MedicineReminder() {
  const [reminders, setReminders] = useState<MedicineReminder[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMedicine, setNewMedicine] = useState({
    name: '',
    dosage: '',
    frequency: '8' // hours
  });

  // Load reminders from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('medicine_reminders');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setReminders(parsed.map((r: any) => ({
          ...r,
          nextDue: new Date(r.nextDue)
        })));
      } catch (e) {
        console.error('Error loading reminders:', e);
      }
    }
  }, []);

  // Save reminders to localStorage
  useEffect(() => {
    if (reminders.length > 0) {
      localStorage.setItem('medicine_reminders', JSON.stringify(reminders));
    }
  }, [reminders]);

  // Check for due reminders
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      reminders.forEach(reminder => {
        if (reminder.isActive && reminder.nextDue <= now) {
          showNotification(reminder);
          // Update next due time
          const nextDue = new Date(reminder.nextDue.getTime() + parseInt(reminder.frequency) * 60 * 60 * 1000);
          setReminders(prev => prev.map(r => 
            r.id === reminder.id ? { ...r, nextDue } : r
          ));
        }
      });
    };

    const interval = setInterval(checkReminders, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [reminders]);

  const showNotification = (reminder: MedicineReminder) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Medicine Reminder', {
        body: `Time to take ${reminder.name} (${reminder.dosage})`,
        icon: '/favicon.ico'
      });
    } else {
      alert(`Medicine Reminder: Time to take ${reminder.name} (${reminder.dosage})`);
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  const addReminder = () => {
    if (!newMedicine.name.trim() || !newMedicine.dosage.trim()) {
      alert('Please fill in medicine name and dosage');
      return;
    }

    const now = new Date();
    const nextDue = new Date(now.getTime() + parseInt(newMedicine.frequency) * 60 * 60 * 1000);

    const reminder: MedicineReminder = {
      id: Date.now().toString(),
      name: newMedicine.name.trim(),
      dosage: newMedicine.dosage.trim(),
      frequency: newMedicine.frequency,
      nextDue,
      isActive: true
    };

    setReminders(prev => [...prev, reminder]);
    setNewMedicine({ name: '', dosage: '', frequency: '8' });
    setShowAddForm(false);

    // Request notification permission
    requestNotificationPermission();
  };

  const toggleReminder = (id: string) => {
    setReminders(prev => prev.map(r => 
      r.id === id ? { ...r, isActive: !r.isActive } : r
    ));
  };

  const deleteReminder = (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
  };

  const getTimeUntilNext = (nextDue: Date) => {
    const now = new Date();
    const diff = nextDue.getTime() - now.getTime();
    
    if (diff <= 0) return 'Due now!';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          Medicine Reminders
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-green-500 text-white px-4 py-2 rounded-md text-sm hover:bg-green-600 transition-colors"
        >
          {showAddForm ? 'Cancel' : 'Add Reminder'}
        </button>
      </div>

      {/* Add Reminder Form */}
      {showAddForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Medicine Name
              </label>
              <input
                type="text"
                value={newMedicine.name}
                onChange={(e) => setNewMedicine(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Paracetamol, Ibuprofen, etc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dosage
              </label>
              <input
                type="text"
                value={newMedicine.dosage}
                onChange={(e) => setNewMedicine(prev => ({ ...prev, dosage: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="500mg, 1 tablet, etc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Frequency (hours)
              </label>
              <select
                value={newMedicine.frequency}
                onChange={(e) => setNewMedicine(prev => ({ ...prev, frequency: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="4">Every 4 hours</option>
                <option value="6">Every 6 hours</option>
                <option value="8">Every 8 hours</option>
                <option value="12">Every 12 hours</option>
                <option value="24">Once daily</option>
              </select>
            </div>
          </div>
          <button
            onClick={addReminder}
            className="mt-4 bg-green-500 text-white px-6 py-2 rounded-md hover:bg-green-600 transition-colors"
          >
            Add Reminder
          </button>
        </div>
      )}

      {/* Active Reminders */}
      {reminders.length > 0 ? (
        <div className="space-y-3">
          {reminders.map((reminder) => (
            <div
              key={reminder.id}
              className={`p-4 rounded-lg border ${
                reminder.isActive ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h4 className={`font-medium ${reminder.isActive ? 'text-green-800' : 'text-gray-500'}`}>
                      {reminder.name}
                    </h4>
                    <span className={`text-sm ${reminder.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                      {reminder.dosage}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className="text-sm text-gray-600">
                      Every {reminder.frequency} hours
                    </span>
                    {reminder.isActive && (
                      <span className={`text-sm font-medium ${
                        getTimeUntilNext(reminder.nextDue) === 'Due now!' 
                          ? 'text-red-600' 
                          : 'text-blue-600'
                      }`}>
                        Next: {getTimeUntilNext(reminder.nextDue)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleReminder(reminder.id)}
                    className={`px-3 py-1 rounded-md text-sm ${
                      reminder.isActive
                        ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                        : 'bg-green-500 text-white hover:bg-green-600'
                    }`}
                  >
                    {reminder.isActive ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={() => deleteReminder(reminder.id)}
                    className="px-3 py-1 bg-red-500 text-white rounded-md text-sm hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>No medicine reminders set.</p>
          <p className="text-sm mt-2">Add reminders to never miss your medication.</p>
        </div>
      )}

      {/* Notification Info */}
      {reminders.some(r => r.isActive) && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            Browser notifications are enabled for medicine reminders. 
            Keep this tab open for timely alerts.
          </p>
        </div>
      )}
    </div>
  );
}
