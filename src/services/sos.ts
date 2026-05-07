import { serverTimestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { dbService } from './db';

const TRACKING_INTERVAL_KEY = 'sos_tracking_interval';
const ACTIVE_ALERT_KEY      = 'sos_active_alert_id';

export const sosService = {
  /** Trigger an SOS alert: get GPS, write to Firestore, start location tracking */
  trigger(user: User): Promise<string | undefined> {
    return new Promise((resolve) => {
      const onPosition = async (pos?: GeolocationPosition) => {
        const baseData: Record<string, any> = {
          userId:       user.uid,
          userName:     user.displayName || user.email || 'User',
          status:       'active',
          currentLevel: 1,
          timestamp:    serverTimestamp(),
        };

        if (pos) {
          baseData.lastLocation = {
            lat:     pos.coords.latitude,
            lng:     pos.coords.longitude,
            address: 'Current Location',
          };
        }

        const alertId = await dbService.createDocument('alerts', baseData);
        if (alertId) {
          localStorage.setItem(ACTIVE_ALERT_KEY, alertId);
          this.startTracking(alertId, user.uid);
        }
        resolve(alertId);
      };

      navigator.geolocation.getCurrentPosition(
        (pos) => onPosition(pos),
        ()    => { console.warn('[SOS] Geolocation unavailable'); onPosition(undefined); },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  },

  /** Start writing GPS updates to Firestore every 5 seconds */
  startTracking(alertId: string, userId: string) {
    this.stopTracking(); // Ensure no duplicate intervals

    const writeLocation = () => {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const location = {
          userId,
          alertId,
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: serverTimestamp(),
        };
        // Write to locations subcollection (history)
        await dbService.createDocument(`alerts/${alertId}/locations`, location);
        // Keep alert doc's lastLocation fresh
        await dbService.updateDocument('alerts', alertId, {
          lastLocation: { lat: location.lat, lng: location.lng, address: 'Current Location' },
        });
      });
    };

    writeLocation(); // Immediate first update
    const id = window.setInterval(writeLocation, 5000);
    localStorage.setItem(TRACKING_INTERVAL_KEY, String(id));
  },

  /** Stop the location tracking interval */
  stopTracking() {
    const id = localStorage.getItem(TRACKING_INTERVAL_KEY);
    if (id) {
      clearInterval(parseInt(id));
      localStorage.removeItem(TRACKING_INTERVAL_KEY);
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
