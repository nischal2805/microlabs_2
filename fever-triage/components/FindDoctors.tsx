'use client';

import { useState, useEffect } from 'react';
import { MapPin, Navigation, Search, Loader2, AlertCircle, Star, Clock, ExternalLink } from 'lucide-react';
import { LocationService } from '../lib/locationService';
import { PlacesService } from '../lib/placesService';
import { DoctorSpecialtyService } from '../lib/doctorSpecialtyService';
import { Location, Doctor } from '../lib/googleMaps';

interface FindDoctorsProps {
  googleMapsLoaded: boolean;
}

export default function FindDoctors({ googleMapsLoaded }: FindDoctorsProps) {
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [feverAnalysis, setFeverAnalysis] = useState<any>(null);
  const [isSmartSearch, setIsSmartSearch] = useState(false);

  useEffect(() => {
    if (googleMapsLoaded) {
      PlacesService.initialize();
    }
  }, [googleMapsLoaded]);

  // Check for fever analysis from assessment results
  useEffect(() => {
    const storedAnalysis = localStorage.getItem('feverAnalysis');
    if (storedAnalysis) {
      const analysis = JSON.parse(storedAnalysis);
      setFeverAnalysis(analysis);
      setIsSmartSearch(true);
      // Clear the stored analysis after reading
      localStorage.removeItem('feverAnalysis');
    }
  }, []);

  // Auto-search for smart searches when location is enabled
  useEffect(() => {
    if (isSmartSearch && locationEnabled && userLocation && doctors.length === 0 && !loading) {
      console.log('Auto-searching for specialized doctors...');
      handleSearchDoctors();
    }
  }, [isSmartSearch, locationEnabled, userLocation, doctors.length, loading]);

  const handleEnableLocation = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const hasPermission = await LocationService.requestLocationPermission();
      if (!hasPermission) {
        setError('Location permission denied. Please enable location access in your browser settings.');
        setLoading(false);
        return;
      }

      const location = await LocationService.getCurrentLocation();
      setUserLocation(location);
      setLocationEnabled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get location');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchDoctors = async () => {
    if (!userLocation) {
      setError('Please enable location first');
      return;
    }

    if (!googleMapsLoaded) {
      setError('Google Maps is not loaded. Please check your API configuration.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Starting doctor search...');
      const searchKeyword = isSmartSearch && feverAnalysis?.searchKeywords 
        ? feverAnalysis.searchKeywords 
        : undefined;
      
      const nearbyDoctors = await PlacesService.findNearbyDoctors(userLocation, searchKeyword);
      console.log('Found nearby doctors:', nearbyDoctors.length);
      
      if (nearbyDoctors.length === 0) {
        setError('No doctors found in your area. Try expanding the search radius.');
        setDoctors([]);
        return;
      }

      // Apply smart filtering if this is a smart search
      let filteredDoctors = nearbyDoctors;
      if (isSmartSearch && feverAnalysis?.recommendedSpecialties) {
        console.log('Applying smart filtering for specialties:', feverAnalysis.recommendedSpecialties);
        filteredDoctors = DoctorSpecialtyService.filterDoctorsBySpecialty(
          nearbyDoctors, 
          feverAnalysis.recommendedSpecialties
        );
        console.log('Filtered doctors:', filteredDoctors.length);
        
        // If no specialized doctors found, fall back to all doctors
        if (filteredDoctors.length === 0) {
          console.log('No specialized doctors found, using all doctors');
          filteredDoctors = nearbyDoctors;
        }
      }

      console.log('Getting directions for doctors...');
      const doctorsWithDirections = await PlacesService.getDirectionsForMultiplePlaces(
        userLocation,
        filteredDoctors
      );
      
      // Sort by distance from nearest to farthest
      doctorsWithDirections.sort((a, b) => {
        const aDistance = a.distance ? parseInt(a.distance.split(' ')[0]) : Infinity;
        const bDistance = b.distance ? parseInt(b.distance.split(' ')[0]) : Infinity;
        
        // Always sort by distance (nearest to farthest)
        return aDistance - bDistance;
      });

      console.log('Final doctors list:', doctorsWithDirections.length);
      setDoctors(doctorsWithDirections);
    } catch (err) {
      console.error('Search error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to find doctors';
      
      // Provide more user-friendly error messages
      if (errorMessage.includes('ZERO_RESULTS')) {
        setError('No doctors found in your area. Try searching from a different location.');
      } else if (errorMessage.includes('REQUEST_DENIED')) {
        setError('Google Maps API access denied. Please check your API key configuration.');
      } else if (errorMessage.includes('OVER_QUERY_LIMIT')) {
        setError('API quota exceeded. Please try again later.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (doctor: Doctor) => {
    if (!userLocation) return;

    const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${doctor.geometry.location.lat},${doctor.geometry.location.lng}&destination_place_id=${doctor.place_id}`;
    window.open(url, '_blank');
  };

  const renderStars = (rating?: number) => {
    if (!rating) return null;
    
    return (
      <div className="flex items-center gap-1">
        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
        <span className="text-sm text-gray-600">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">
          {isSmartSearch ? 'Smart Doctor Recommendation' : 'Find Doctors Near Me'}
        </h1>
        <p className="text-gray-600">
          {isSmartSearch 
            ? `Finding specialized doctors for ${feverAnalysis?.feverType?.replace('_', ' ') || 'your condition'}`
            : 'Locate nearby doctors, clinics, and hospitals within 3km'
          }
        </p>
        {isSmartSearch && feverAnalysis && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 inline-block">
            <p className="text-sm text-green-800">
              Recommended: {feverAnalysis.recommendedSpecialties[0]?.specialty?.replace('_', ' ') || 'General Practitioner'}
              {feverAnalysis.isEmergency && ' • Emergency Priority'}
            </p>
          </div>
        )}
      </div>

      {!googleMapsLoaded && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <span className="text-yellow-800">Google Maps is loading. Please wait...</span>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
        <div className="space-y-4">
          {!locationEnabled ? (
            <button
              onClick={handleEnableLocation}
              disabled={loading || !googleMapsLoaded}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Getting Location...</span>
                </>
              ) : (
                <>
                  <MapPin className="w-5 h-5" />
                  <span>Enable Location</span>
                </>
              )}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-green-800">
                  <MapPin className="w-5 h-5" />
                  <span>Location enabled</span>
                </div>
                <div className="text-sm text-green-600 mt-1">
                  Lat: {userLocation?.lat.toFixed(6)}, Lng: {userLocation?.lng.toFixed(6)}
                </div>
              </div>

              <button
                onClick={handleSearchDoctors}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    <span>Search Doctors</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}
      </div>

      {doctors.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Found {doctors.length} doctors/clinics nearby
          </h2>
          
          <div className="grid gap-4">
            {doctors.map((doctor) => (
              <div key={doctor.place_id} className="bg-white rounded-lg shadow-md p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{doctor.name}</h3>
                    <p className="text-gray-600 mt-1">{doctor.vicinity}</p>
                    
                    <div className="flex items-center gap-4 mt-3">
                      {renderStars(doctor.rating)}
                      {doctor.user_ratings_total && (
                        <span className="text-sm text-gray-500">
                          ({doctor.user_ratings_total} reviews)
                        </span>
                      )}
                    </div>

                    {doctor.distance && doctor.duration && (
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <MapPin className="w-4 h-4" />
                          <span>{doctor.distance}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span>{doctor.duration}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleNavigate(doctor)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>Navigate</span>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {doctor.types.slice(0, 3).map((type) => (
                    <span
                      key={type}
                      className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                    >
                      {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
