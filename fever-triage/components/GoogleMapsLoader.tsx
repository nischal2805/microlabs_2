'use client';

import { useState, useEffect } from 'react';
import { GOOGLE_MAPS_CONFIG } from '../lib/googleMaps';

interface GoogleMapsLoaderProps {
  children: (loaded: boolean) => React.ReactNode;
}

export default function GoogleMapsLoader({ children }: GoogleMapsLoaderProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!GOOGLE_MAPS_CONFIG.apiKey) {
      setError('Google Maps API key is missing. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your environment variables.');
      return;
    }

    // Check if Google Maps is already loaded
    if (window.google && window.google.maps) {
      setLoaded(true);
      return;
    }

    // Load Google Maps script
    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_CONFIG.apiKey}&libraries=${GOOGLE_MAPS_CONFIG.libraries.join(',')}&callback=initGoogleMaps`;
    
    // Global callback function
    window.initGoogleMaps = () => {
      setLoaded(true);
    };

    script.onerror = () => {
      setError('Failed to load Google Maps. Please check your API key and network connection.');
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup
      delete window.initGoogleMaps;
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800">
            <p className="font-semibold">Google Maps Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children(loaded)}</>;
}

// Add global type declaration
declare global {
  interface Window {
    initGoogleMaps?: () => void;
    google: any;
  }
}
