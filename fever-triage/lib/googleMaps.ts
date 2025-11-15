export const GOOGLE_MAPS_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  libraries: ['places'],
  defaultRadius: 3000, // 3 km in meters
  doctorTypes: [
    'hospital',
    'doctor',
    'clinic',
    'pharmacy',
    'health'
  ]
};

export interface Location {
  lat: number;
  lng: number;
}

export interface Doctor {
  place_id: string;
  name: string;
  vicinity: string;
  geometry: {
    location: Location;
  };
  rating?: number;
  user_ratings_total?: number;
  types: string[];
  distance?: string;
  duration?: string;
}

export interface DirectionsResult {
  distance: string;
  duration: string;
  distanceInMeters: number;
}
