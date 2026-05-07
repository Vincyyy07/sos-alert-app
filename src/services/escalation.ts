import { Contact } from '../types';
import { emailService } from './email';
import { dbService } from './db';

export interface EscalationStatus {
  level: number;                  // Current active escalation level (1 | 2 | 3)
  notifiedIds: string[];          // Contact IDs already notified
  nextLevelIn: number | null;     // Seconds until next level fires (null = done)
}

class EscalationEngine {
  private timers:   number[] = [];
  private alertId:  string | null = null;
  private status:   EscalationStatus = { level: 1, notifiedIds: [], nextLevelIn: null };
  private onUpdate: ((s: EscalationStatus) => void) | null = null;

  /**
   * Start the escalation sequence.
   * P1 contacts → immediate
   * P2 contacts → after 2 minutes
   * P3 contacts → after 5 minutes (from start)
   */
  start(
    alertId:  string,
    contacts: Contact[],
    userName: string,
    onUpdate: (s: EscalationStatus) => void
  ) {
    this.stop();
    this.alertId  = alertId;
    this.onUpdate = onUpdate;

    const p1 = contacts.filter(c => c.priority === 1 && c.receiveEscalations !== false);
    const p2 = contacts.filter(c => c.priority === 2 && c.receiveEscalations !== false);
    const p3 = contacts.filter(c => c.priority === 3 && c.receiveEscalations !== false);

    const trackingUrl = `${window.location.origin}/track?alertId=${alertId}`;
    const timestamp   = new Date().toLocaleString();

    // ── Level 1 (immediate) ───────────────────────────────────────────────
    this.notifyContacts(p1, trackingUrl, userName, timestamp, 1);
    this.setStatus({
      level:       1,
      notifiedIds: p1.map(c => c.id),
      nextLevelIn: p2.length ? 120 : (p3.length ? 300 : null),
    });

    // ── Level 2 (2 min) ──────────────────────────────────────────────────
    if (p2.length) {
      this.startCountdown(120, () => {
        this.notifyContacts(p2, trackingUrl, userName, timestamp, 2);
        dbService.updateDocument('alerts', alertId, { currentLevel: 2 });
        this.setStatus({
          level:       2,
          notifiedIds: [...this.status.notifiedIds, ...p2.map(c => c.id)],
          nextLevelIn: p3.length ? 180 : null,
        });

        // ── Level 3 (3 more min after L2) ──────────────────────────────
        if (p3.length) {
          this.startCountdown(180, () => {
            this.notifyContacts(p3, trackingUrl, userName, timestamp, 3);
            dbService.updateDocument('alerts', alertId, { currentLevel: 3 });
            this.setStatus({
              level:       3,
              notifiedIds: [...this.status.notifiedIds, ...p3.map(c => c.id)],
              nextLevelIn: null,
            });
          });
        }
      });
    } else if (p3.length) {
      // No P2 — go directly to P3 after 5 min
      this.startCountdown(300, () => {
        this.notifyContacts(p3, trackingUrl, userName, timestamp, 3);
        dbService.updateDocument('alerts', alertId, { currentLevel: 3 });
        this.setStatus({
          level:       3,
          notifiedIds: [...this.status.notifiedIds, ...p3.map(c => c.id)],
          nextLevelIn: null,
        });
      });
    }
  }

  stop() {
    this.timers.forEach(id => { clearTimeout(id); clearInterval(id); });
    this.timers = [];
  }

  getStatus(): EscalationStatus {
    return this.status;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async notifyContacts(
    contacts:    Contact[],
    trackingUrl: string,
    userName:    string,
    timestamp:   string,
    level:       number
  ) {
    for (const contact of contacts) {
      if (contact.email) {
        await emailService.sendSOSAlert({
          toName:        contact.name,
          toEmail:       contact.email,
          fromName:      userName,
          trackingUrl,
          timestamp,
          priorityLevel: level,
        });
      }
    }
  }

  /**
   * Run a 1-second countdown and call `onDone` when it reaches 0.
   * Keeps `status.nextLevelIn` updated so the UI can show a live timer.
   */
  private startCountdown(seconds: number, onDone: () => void) {
    let remaining = seconds;

    const tick = window.setInterval(() => {
      remaining--;
      this.setStatus({ ...this.status, nextLevelIn: remaining });
      if (remaining <= 0) {
        clearInterval(tick);
        onDone();
      }
    }, 1000);
    this.timers.push(tick);
  }

  private setStatus(s: EscalationStatus) {
    this.status = s;
    this.onUpdate?.(s);
  }
}

// Singleton — one engine per browser session
export const escalationEngine = new EscalationEngine();
