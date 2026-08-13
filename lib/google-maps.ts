import axios from 'axios';

interface LatLng {
  lat: number;
  lng: number;
}

interface DistanceMatrixResponse {
  rows: Array<{
    elements: Array<{
      distance: { value: number };
      duration: { value: number };
      status: string;
    }>;
  }>;
  status: string;
}

interface DirectionsResponse {
  routes: Array<{
    legs: Array<{
      distance: { value: number; text: string };
      duration: { value: number; text: string };
    }>;
    overview_polyline: {
      points: string;
    };
  }>;
  status: string;
}

export async function calculateDistance(origin: LatLng, destination: LatLng): Promise<number> {
  try {
    const response = await axios.get<DistanceMatrixResponse>(
      'https://maps.googleapis.com/maps/api/distancematrix/json',
      {
        params: {
          origins: `${origin.lat},${origin.lng}`,
          destinations: `${destination.lat},${destination.lng}`,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
    );

    if (response.data.status !== 'OK') {
      throw new Error(`Google Maps API error: ${response.data.status}`);
    }

    const element = response.data.rows[0]?.elements[0];
    if (!element) {
      throw new Error('Google Maps API returned no distance data');
    }

    const distance = element.distance.value / 1000; // Convert to km
    return distance;
  } catch (error) {
    console.error('Distance calculation error:', error);
    throw error;
  }
}

export async function calculateRoute(
  waypoints: LatLng[],
  startPoint: LatLng = { lat: -23.5505, lng: -46.6333 }, // Default: São Paulo
): Promise<{
  distance: number;
  duration: number;
  polyline: string;
  legs: Array<{ distance: number; duration: number }>;
}> {
  try {
    if (waypoints.length === 0) {
      throw new Error('At least one waypoint is required');
    }

    const allPoints = [startPoint, ...waypoints];
    const waypointsStr = waypoints.slice(0, -1).map((p) => `${p.lat},${p.lng}`).join('|');
    const destination = waypoints[waypoints.length - 1];
    if (!destination) {
      throw new Error('At least one waypoint is required');
    }

    const response = await axios.get<DirectionsResponse>(
      'https://maps.googleapis.com/maps/api/directions/json',
      {
        params: {
          origin: `${startPoint.lat},${startPoint.lng}`,
          destination: `${destination.lat},${destination.lng}`,
          ...(waypointsStr && { waypoints: waypointsStr }),
          key: process.env.GOOGLE_MAPS_API_KEY,
          optimize: 'true',
        },
      },
    );

    if (response.data.status !== 'OK') {
      throw new Error(`Google Maps API error: ${response.data.status}`);
    }

    const route = response.data.routes[0];
    if (!route) {
      throw new Error('Google Maps API returned no route data');
    }
    const legs = route.legs;

    const totalDistance = legs.reduce((sum, leg) => sum + leg.distance.value, 0) / 1000; // km
    const totalDuration = legs.reduce((sum, leg) => sum + leg.duration.value, 0) / 60; // minutes

    return {
      distance: totalDistance,
      duration: Math.round(totalDuration),
      polyline: route.overview_polyline.points,
      legs: legs.map((leg) => ({
        distance: leg.distance.value / 1000,
        duration: Math.round(leg.duration.value / 60),
      })),
    };
  } catch (error) {
    console.error('Route calculation error:', error);
    throw error;
  }
}

export async function getAddressCoordinates(
  address: string,
): Promise<{ lat: number; lng: number; formatted_address: string }> {
  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          address,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
    );

    if (response.data.status !== 'OK' || response.data.results.length === 0) {
      throw new Error('Address not found');
    }

    const result = response.data.results[0];
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formatted_address: result.formatted_address,
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    throw error;
  }
}

export function calculateShippingCost(
  distance: number,
  shippingType: 'fixed' | 'per_km',
  fixedCost?: number,
  costPerKm?: number,
): number {
  if (shippingType === 'fixed') {
    return fixedCost || 0;
  }

  if (shippingType === 'per_km') {
    return Math.round((distance * (costPerKm || 1)) * 100) / 100;
  }

  return 0;
}

export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = (result & 1) ? ~(result >> 1) : result >> 1;
    lat += dlat;

    result = 0;
    shift = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = (result & 1) ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return points;
}
