import { serverTimestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { dbService } from './db';

const TRACKING_WATCH_ID_KEY = 'sos_tracking_watch_id';
const ACTIVE_ALERT_KEY      = 'sos_active_alert_id';
let wakeLock: any = null;

export const sosService = {
  /** Request wake lock to keep browser active during SOS */
  async requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await (navigator as any).wakeLock.request('screen');
        console.log('[SOS] Wake Lock active');
      } catch (err: any) {
        console.warn('[SOS] Wake Lock failed:', err.message);
      }
    }
  },

  /** Release wake lock */
  releaseWakeLock() {
    if (wakeLock) {
      wakeLock.release().then(() => {
        wakeLock = null;
        console.log('[SOS] Wake Lock released');
      });
    }
  },

  /** Trigger an SOS alert: get GPS, write to Firestore, start location tracking */
  trigger(user: User): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
      // Start wake lock immediately
      this.requestWakeLock();

      const onPosition = async (pos: GeolocationPosition | undefined) => {
        if (!pos) {
          this.releaseWakeLock();
          resolve(undefined);
          return;
        }

        console.log('[SOS] Initial position captured:', pos.coords.latitude, pos.coords.longitude);
        try {
          const profile = await dbService.getDocument('users', user.uid);
          const baseData: Record<string, any> = {
            userId:       user.uid,
            userName:     user.displayName || user.email || 'User',
            userPhone:    profile?.phoneNumber || '',
            status:       'active',
            currentLevel: 1,
            timestamp:    serverTimestamp(),
            lastLocation: {
              lat:      pos.coords.latitude,
              lng:      pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              address:  'Current Location',
            },
          };

          const alertId = await dbService.createDocument('alerts', baseData);
          if (alertId) {
            localStorage.setItem(ACTIVE_ALERT_KEY, alertId);
            this.startTracking(alertId, user.uid);
          }
          resolve(alertId);
        } catch (error) {
          console.error('[SOS] Failed to create alert document:', error);
          this.releaseWakeLock();
          reject(error);
        }
      };

      // Force a location lock BEFORE creating the alert
      navigator.geolocation.getCurrentPosition(
        (pos) => onPosition(pos),
        (err) => { 
          console.error('[SOS] Geolocation error:', err.code, err.message);
          let msg = 'Unknown GPS Error';
          if (err.code === 1) msg = 'Location Permission Denied. Please enable GPS.';
          if (err.code === 2) msg = 'GPS Signal Unavailable. Move near a window.';
          if (err.code === 3) msg = 'GPS Timeout. Try again.';
          
          this.releaseWakeLock();
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
      );
    });
  },

  /** Start writing GPS updates to Firestore using watchPosition */
  startTracking(alertId: string, userId: string) {
    this.stopTracking(); // Ensure no duplicate watchers

    console.log('[SOS] Starting live tracking for alert:', alertId);

    const onUpdate = async (pos: GeolocationPosition) => {
      console.log('[SOS] Location update:', pos.coords.latitude, pos.coords.longitude);
      const location = {
        userId,
        alertId,
        lat:      pos.coords.latitude,
        lng:      pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: serverTimestamp(),
      };

      try {
        // Write to locations subcollection (history)
        await dbService.createDocument(`alerts/${alertId}/locations`, location);
        
        // Keep alert doc's lastLocation fresh
        await dbService.updateDocument('alerts', alertId, {
          lastLocation: { 
            lat: location.lat, 
            lng: location.lng, 
            accuracy: location.accuracy,
            address: 'Current Location' 
          },
        });
      } catch (error) {
        console.error('[SOS] Failed to update location in Firestore:', error);
      }
    };

    const onError = (err: GeolocationPositionError) => {
      console.error('[SOS] watchPosition error:', err.code, err.message);
    };

    const watchId = navigator.geolocation.watchPosition(onUpdate, onError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });

    localStorage.setItem(TRACKING_WATCH_ID_KEY, String(watchId));
  },

  /** Stop the location tracking watcher */
  stopTracking() {
    this.releaseWakeLock();
    const id = localStorage.getItem(TRACKING_WATCH_ID_KEY);
    if (id) {
      navigator.geolocation.clearWatch(parseInt(id));
      localStorage.removeItem(TRACKING_WATCH_ID_KEY);
      console.log('[SOS] Tracking stopped. Watcher cleared:', id);
    }
  },

  /** Cancel an active SOS alert */
  async cancel(alertId: string) {
    this.stopTracking();
    await dbService.updateDocument('alerts', alertId, { status: 'cancelled' });
    localStorage.removeItem(ACTIVE_ALERT_KEY);
  },

  getStoredAlertId(): string | null {
    return localStorage.getItem(ACTIVE_ALERT_KEY);
  },
};
