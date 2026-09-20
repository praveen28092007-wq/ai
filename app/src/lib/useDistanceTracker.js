import { useRef, useState, useCallback } from 'react';
import * as Location from 'expo-location';

// Haversine distance in km between two lat/lon points.
function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function useDistanceTracker() {
  const [distanceKm, setDistanceKm] = useState(0);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState(null);
  const lastPoint = useRef(null);
  const subscription = useRef(null);

  const start = useCallback(async () => {
    setError(null);
    setDistanceKm(0);
    lastPoint.current = null;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setError('Location permission denied — distance will stay at 0.');
      setTracking(true); // still let the trip "run" for the demo, just without GPS
      return;
    }

    subscription.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 2000 },
      (loc) => {
        const point = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        if (lastPoint.current) {
          setDistanceKm((prev) => prev + haversineKm(lastPoint.current, point));
        }
        lastPoint.current = point;
      }
    );
    setTracking(true);
  }, []);

  const stop = useCallback(() => {
    subscription.current?.remove?.();
    subscription.current = null;
    setTracking(false);
  }, []);

  return { distanceKm, tracking, error, start, stop };
}
