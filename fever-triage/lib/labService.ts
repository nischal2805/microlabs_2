import { Location } from './googleMaps';
import { PlacesService } from './placesService';

export interface Lab {
  place_id: string;
  name: string;
  vicinity: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  types: string[];
  distance?: string;
  duration?: string;
}

class LabService {
  /**
   * Find nearby labs and diagnostic centers
   */
  static async findNearbyLabs(location: Location): Promise<Lab[]> {
    const labKeywords = [
      'laboratory', 'diagnostic center', 'medical lab', 
      'pathology lab', 'blood test center', 'diagnostic',
      'medical testing', 'clinical laboratory', 'pathology'
    ].join(' ');

    try {
      console.log('Finding nearby labs with keywords:', labKeywords);
      const nearbyLabs = await PlacesService.findNearbyDoctors(location, labKeywords);
      
      // Filter for lab-specific types
      const labTypes = ['laboratory', 'doctor', 'health', 'hospital', 'clinic'];
      const filteredLabs = nearbyLabs.filter((place: any) => 
        place.types.some((type: any) => 
          labTypes.some(labType => 
            type.toLowerCase().includes(labType.toLowerCase())
          )
        ) ||
        place.name.toLowerCase().includes('lab') ||
        place.name.toLowerCase().includes('diagnostic') ||
        place.name.toLowerCase().includes('pathology')
      );

      console.log(`Found ${filteredLabs.length} labs near location`);
      return filteredLabs as Lab[];
    } catch (error) {
      console.error('Error finding labs:', error);
      throw error;
    }
  }

  /**
   * Get directions to multiple labs
   */
  static async getDirectionsForMultipleLabs(
    userLocation: Location,
    labs: Lab[]
  ): Promise<Lab[]> {
    try {
      const labsWithDirections = await PlacesService.getDirectionsForMultiplePlaces(
        userLocation,
        labs
      );
      return labsWithDirections as Lab[];
    } catch (error) {
      console.error('Error getting lab directions:', error);
      throw error;
    }
  }

  /**
   * Get directions to a specific lab
   */
  static async getDirectionsToLab(
    userLocation: Location,
    lab: Lab
  ): Promise<any> {
    try {
      return await PlacesService.getDirections(userLocation, lab.geometry.location);
    } catch (error) {
      console.error('Error getting directions to lab:', error);
      throw error;
    }
  }

  /**
   * Generate Google Maps URL for a lab
   */
  static generateMapsUrl(lab: Lab): string {
    const { lat, lng } = lab.geometry.location;
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${lab.place_id}`;
  }

  /**
   * Sort labs by distance
   */
  static sortLabsByDistance(labs: Lab[]): Lab[] {
    return labs.sort((a, b) => {
      const aDistance = a.distance ? parseInt(a.distance.split(' ')[0]) : Infinity;
      const bDistance = b.distance ? parseInt(b.distance.split(' ')[0]) : Infinity;
      return aDistance - bDistance;
    });
  }

  /**
   * Filter labs by rating
   */
  static filterLabsByRating(labs: Lab[], minRating: number = 4): Lab[] {
    return labs.filter(lab => 
      lab.rating && lab.rating >= minRating
    );
  }

  /**
   * Get top rated labs
   */
  static getTopRatedLabs(labs: Lab[], count: number = 5): Lab[] {
    return labs
      .filter(lab => lab.rating)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, count);
  }
}

export default LabService;
