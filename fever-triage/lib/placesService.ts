import { GOOGLE_MAPS_CONFIG, Location, Doctor, DirectionsResult } from './googleMaps';

declare global {
  interface Window {
    google: any;
  }
}

export class PlacesService {
  private static service: any = null;

  static async initialize(): Promise<void> {
    console.log('Initializing Places service...');
    
    if (typeof window !== 'undefined' && window.google && window.google.maps) {
      console.log('Google Maps is available, creating Places service...');
      this.service = new window.google.maps.places.PlacesService(
        document.createElement('div')
      );
      console.log('Places service created successfully');
    } else {
      console.error('Google Maps is not available');
      throw new Error('Google Maps is not loaded');
    }
  }

  static async findNearbyDoctors(location: Location, customKeyword?: string): Promise<Doctor[]> {
    console.log('Finding nearby doctors for location:', location, 'custom keyword:', customKeyword);
    
    if (!this.service) {
      console.log('Initializing Places service...');
      await this.initialize();
    }

    if (!this.service) {
      throw new Error('Google Places service not available');
    }

    return new Promise((resolve, reject) => {
      const request = {
        location,
        radius: GOOGLE_MAPS_CONFIG.defaultRadius,
        types: GOOGLE_MAPS_CONFIG.doctorTypes,
        keyword: customKeyword || 'doctor hospital clinic medical pharmacy'
      };

      console.log('Making Places API request:', request);

      this.service.nearbySearch(request, (results: any[], status: string) => {
        console.log('Places API response - status:', status, 'results count:', results?.length);
        
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          const doctors: Doctor[] = results.map(place => ({
            place_id: place.place_id,
            name: place.name,
            vicinity: place.vicinity,
            geometry: {
              location: {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng()
              }
            },
            rating: place.rating,
            user_ratings_total: place.user_ratings_total,
            types: place.types
          }));
          console.log('Processed doctors:', doctors.length);
          resolve(doctors);
        } else {
          console.error('Places search failed with status:', status);
          reject(new Error(`Places search failed: ${status}`));
        }
      });
    });
  }

  static async getDirections(origin: Location, destination: Location): Promise<DirectionsResult> {
    if (!window.google || !window.google.maps) {
      throw new Error('Google Maps not loaded');
    }

    const directionsService = new window.google.maps.DirectionsService();

    return new Promise((resolve, reject) => {
      const request = {
        origin,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING
      };

      directionsService.route(request, (result: any, status: string) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          const route = result.routes[0].legs[0];
          resolve({
            distance: route.distance.text,
            duration: route.duration.text,
            distanceInMeters: route.distance.value
          });
        } else {
          reject(new Error(`Directions request failed: ${status}`));
        }
      });
    });
  }

  static async getDirectionsForMultiplePlaces(
    origin: Location,
    destinations: Doctor[]
  ): Promise<Doctor[]> {
    const doctorsWithDirections = await Promise.all(
      destinations.map(async (doctor) => {
        try {
          const directions = await this.getDirections(origin, doctor.geometry.location);
          return {
            ...doctor,
            distance: directions.distance,
            duration: directions.duration
          };
        } catch (error) {
          console.warn(`Failed to get directions for ${doctor.name}:`, error);
          return doctor;
        }
      })
    );

    return doctorsWithDirections;
  }
}
