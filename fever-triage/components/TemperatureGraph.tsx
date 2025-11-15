'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Activity } from 'lucide-react';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TemperatureData {
  date: string;
  temperature: number;
  timestamp?: number;
  time?: string;
}

interface TemperatureGraphProps {
  data: TemperatureData[];
  height?: number;
}

export default function TemperatureGraph({ data, height = 400 }: TemperatureGraphProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [chartKey, setChartKey] = useState(0); // Force re-render when data changes
  const chartRef = useRef<any>(null);

  useEffect(() => {
    console.log('TemperatureGraph: useEffect triggered with data:', data);
    console.log('TemperatureGraph: data.length:', data.length);
    console.log('TemperatureGraph: data sample:', data.slice(0, 3));
    
    if (data.length === 0) {
      setIsGenerating(false);
      return;
    }
    
    setIsGenerating(true);
    console.log('TemperatureGraph: Data received, preparing chart...', data);
    
    // Force chart re-render by updating key
    setChartKey(prev => prev + 1);
    
    // Small delay to show loading state and allow chart to render
    const timer = setTimeout(() => {
      setIsGenerating(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <Activity className="mx-auto mb-2" size={48} />
            <p>No temperature data available</p>
            <p className="text-sm mt-1">Start recording your temperature to see the trend</p>
          </div>
        </div>
      </div>
    );
  }

  // Prepare data for Chart.js
  // Format labels to show date and time for each reading
  const labels = data.map(d => {
    try {
      // If we have time, show date and time
      if (d.time) {
        // Format: "MM/DD HH:MM" for today, or "MM/DD/YYYY HH:MM" for other days
        const parts = d.date.split('/');
        if (parts.length === 3) {
          const today = new Date();
          const recordDate = new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
          const isToday = today.toDateString() === recordDate.toDateString();
          
          if (isToday) {
            // For today, just show time: "HH:MM"
            return d.time;
          } else {
            // For other days, show "MM/DD HH:MM"
            return `${parts[0]}/${parts[1]} ${d.time}`;
          }
        }
        return `${d.date} ${d.time}`;
      }
      // Fallback to just date if time not available
      const parts = d.date.split('/');
      if (parts.length === 3) {
        return `${parts[0]}/${parts[1]}`;
      }
      return d.date;
    } catch {
      return d.date;
    }
  });
  const temperatures = data.map(d => d.temperature);
  
  // Calculate min/max for better Y-axis scaling
  const tempMin = temperatures.length > 0 ? Math.min(...temperatures) : 97;
  const tempMax = temperatures.length > 0 ? Math.max(...temperatures) : 104;
  const tempRange = tempMax - tempMin || 1; // Avoid division by zero
  const yAxisMin = Math.max(95, tempMin - tempRange * 0.2);
  const yAxisMax = Math.min(105, tempMax + tempRange * 0.2);
  
  // Create fever threshold line (100.4°F)
  const feverThreshold = data.map(() => 100.4);

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: 'Temperature (°F)',
        data: temperatures,
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 6, // Slightly larger to see individual points
        pointHoverRadius: 8,
        pointBackgroundColor: 'rgb(239, 68, 68)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHitRadius: 10 // Larger hit area for easier hovering
      },
      {
        label: 'Fever Threshold (100.4°F)',
        data: feverThreshold,
        borderColor: 'rgb(251, 146, 60)',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 0
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Temperature Readings Over Time (All Data Points)',
        font: {
          size: 16,
          weight: 'bold' as const
        }
      },
      legend: {
        display: true,
        position: 'top' as const
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          title: function(context: any) {
            // Show full date and time in tooltip title
            const index = context[0].dataIndex;
            const dataPoint = data[index];
            if (dataPoint && dataPoint.date && dataPoint.time) {
              return `${dataPoint.date} at ${dataPoint.time}`;
            }
            return context[0].label || '';
          },
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            label += context.parsed.y.toFixed(1) + '°F';
            
            // Add fever warning
            if (context.datasetIndex === 0 && context.parsed.y >= 100.4) {
              label += ' ⚠️ Fever';
            }
            
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        min: yAxisMin,
        max: yAxisMax,
        title: {
          display: true,
          text: 'Temperature (°F)'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          stepSize: 0.5
        }
      },
      x: {
        title: {
          display: true,
          text: 'Date & Time'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          autoSkip: true,
          maxTicksLimit: 10 // Limit number of labels to avoid crowding
        }
      }
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {isGenerating && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">Generating chart...</p>
          </div>
        </div>
      )}
      
      <div style={{ height: `${height}px`, display: isGenerating ? 'none' : 'block' }}>
        <Line 
          key={chartKey}
          ref={chartRef} 
          data={chartData} 
          options={chartOptions}
          redraw={true}
        />
      </div>
    </div>
  );
}