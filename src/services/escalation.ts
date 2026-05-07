import { Contact } from '../types';
import { emailService } from './email';
import { dbService } from './db';

export interface EscalationStatus {
  level: number;                  // Current highest priority group being notified
  notifiedIds: string[];          // Contact IDs already notified
  nextLevelIn: number | null;     // Seconds until next group fires (null = done)
}

/**
 * Returns the delay in seconds for a given priority level.
 * P1 → 0s (immediate)
 * P2 → 60s  (+1 min)
 * P3 → 120s (+2 mins)
 * P4 → 240s (+4 mins)
 * P5 → 300s (+5 mins)
 * Pn → (n-1) * 60s
 */
function getDelaySeconds(priority: number): number {
  if (priority <= 1) return 0;
  const delays: Record<number, number> = { 2: 60, 3: 120, 4: 240, 5: 300 };
  return delays[priority] ?? (priority - 1) * 60;
}

class EscalationEngine {
  private timers:   number[] = [];
  private alertId:  string | null = null;
  private status:   EscalationStatus = { level: 1, notifiedIds: [], nextLevelIn: null };
  private onUpdate: ((s: EscalationStatus) => void) | null = null;

  /**
   * Start the escalation sequence.
   * Groups contacts by priority number.
   * All contacts in the same group are notified at the same time.
   * Timing is calculated relative to SOS start using getDelaySeconds().
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

    const trackingUrl = `${window.location.origin}/track?alertId=${alertId}`;
    const timestamp   = new Date().toLocaleString();

    // Group contacts by priority, filter those that receive escalations
    const eligible = contacts.filter(c => c.receiveEscalations !== false && c.email);
    const groups = new Map<number, Contact[]>();
    for (const contact of eligible) {
      const p = contact.priority;
      if (!groups.has(p)) groups.set(p, []);
      groups.get(p)!.push(contact);
    }

    // Sort groups ascending by priority number
    const sortedPriorities = [...groups.keys()].sort((a, b) => a - b);
    if (sortedPriorities.length === 0) return;

    let notifiedIds: string[] = [];

    sortedPriorities.forEach((priority, idx) => {
      const group = groups.get(priority)!;
      const delaySec = getDelaySeconds(priority);
      const nextPriority = sortedPriorities[idx + 1];
      const nextDelaySec = nextPriority !== undefined ? getDelaySeconds(nextPriority) : null;

      if (delaySec === 0) {
        // Fire immediately
        this.notifyContacts(group, trackingUrl, userName, timestamp, priority);
        notifiedIds = [...notifiedIds, ...group.map(c => c.id)];
        dbService.updateDocument('alerts', alertId, { currentLevel: priority });
        this.setStatus({
          level: priority,
          notifiedIds,
          nextLevelIn: nextDelaySec !== null ? nextDelaySec : null,
        });
      } else {
        // Schedule this group
        const capturedNotifiedIds = [...notifiedIds];
        this.scheduleAt(delaySec, () => {
          this.notifyContacts(group, trackingUrl, userName, timestamp, priority);
          const newNotified = [...capturedNotifiedIds, ...group.map(c => c.id)];
          dbService.updateDocument('alerts', alertId, { currentLevel: priority });
          this.setStatus({
            level: priority,
            notifiedIds: newNotified,
            nextLevelIn: nextDelaySec !== null ? (nextDelaySec - delaySec) : null,
          });
        });
      }
    });

    // Kick off the live countdown to the next group
    if (sortedPriorities.length > 1) {
      const firstNextDelay = getDelaySeconds(sortedPriorities[1]);
      this.startCountdown(firstNextDelay);
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

  /** Schedule a one-shot callback after `seconds` seconds. */
  private scheduleAt(seconds: number, onDone: () => void) {
    const id = window.setTimeout(onDone, seconds * 1000);
    this.timers.push(id);
  }

  /**
   * Run a 1-second countdown and keep `status.nextLevelIn` updated.
   * This is display-only — actual firing is handled by scheduleAt.
   */
  private startCountdown(totalSeconds: number) {
    let remaining = totalSeconds;
    const tick = window.setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(tick);
        return;
      }
      this.setStatus({ ...this.status, nextLevelIn: remaining });
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
