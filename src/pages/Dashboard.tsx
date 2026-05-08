import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { dbService } from '../services/db';
import { sosService } from '../services/sos';
import { escalationEngine, EscalationStatus } from '../services/escalation';
import { emailService } from '../services/email';
import { Alert, Contact, CheckIn } from '../types';
import { where, orderBy, limit } from 'firebase/firestore';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { cn } from '../lib/utils';

const PRIORITY_CONFIG: Record<number, { avatar: string; nameColor: string }> = {
  1: { avatar: 'bg-gradient-to-br from-rose-400 to-[#E11D48] text-white', nameColor: 'text-[#E11D48]' },
  2: { avatar: 'bg-gradient-to-br from-amber-300 to-[#F59E0B] text-white', nameColor: 'text-[#F59E0B]' },
  3: { avatar: 'bg-gradient-to-br from-blue-400 to-[#2563EB] text-white', nameColor: 'text-[#2563EB]' },
  4: { avatar: 'bg-gradient-to-br from-emerald-400 to-[#10B981] text-white', nameColor: 'text-[#10B981]' },
  5: { avatar: 'bg-gradient-to-br from-violet-400 to-[#8B5CF6] text-white', nameColor: 'text-[#8B5CF6]' },
};
const getPC = (p: number) => PRIORITY_CONFIG[p] || { avatar: 'bg-on-background/10 text-on-surface-variant', nameColor: 'text-on-surface/70' };

export default function Dashboard() {
  const { user } = useAuth();
  const [isHolding, setIsHolding]         = useState(false);
  const [holdProgress, setHoldProgress]   = useState(0);
  const [activeAlert, setActiveAlert]     = useState<Alert | null>(null);
  const [contacts, setContacts]           = useState<Contact[]>([]);
  const [nextCheckIn, setNextCheckIn]     = useState<CheckIn | null>(null);
  const [escalation, setEscalation]       = useState<EscalationStatus | null>(null);
  const [triggering, setTriggering]       = useState(false);
  const [locationStatus, setLocationStatus] = useState<'checking' | 'granted' | 'denied' | 'prompt'>('checking');
  const [gpsAccuracy, setGpsAccuracy]     = useState<number | null>(null);
  const [coords, setCoords]               = useState<{lat: number, lng: number} | null>(null);
  const [lastError, setLastError]         = useState<string | null>(null);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const holdTimerRef = useRef<any>(null);

  // Check for location permissions on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setLocationStatus(result.state as any);
        result.onchange = () => setLocationStatus(result.state as any);
      });
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLocationStatus('granted');
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        // Only update state if accuracy change is > 5 meters to prevent UI flickering glitches
        setGpsAccuracy(prev => {
          if (prev === null || Math.abs(prev - pos.coords.accuracy) > 5) {
            return pos.coords.accuracy;
          }
          return prev;
        });
      },
      (err) => {
        console.warn('[Dashboard] GPS watch error:', err.message);
        if (err.code === 1) setLocationStatus('denied');
        setGpsAccuracy(null);
      },
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubAlert = dbService.subscribeToCollection<Alert>(
      'alerts',
      [where('userId', '==', user.uid), where('status', '==', 'active'), limit(1)],
      (alerts) => {
        const alert = alerts[0];
        if (alert) {
          // Auto-cleanup: If an alert is older than 2 hours, it's likely stale
          const alertTime = (alert.timestamp as any)?.toDate?.()?.getTime() || Date.now();
          const isStale = (Date.now() - alertTime) > 2 * 60 * 60 * 1000;
          
          if (isStale) {
            console.log('[Dashboard] Auto-cancelling stale alert:', alert.id);
            sosService.cancel(alert.id);
            setActiveAlert(null);
          } else {
            setActiveAlert(alert);
          }
        } else {
          setActiveAlert(null);
        }
      }
    );
    const unsubContacts = dbService.subscribeToCollection<Contact>(
      `users/${user.uid}/contacts`,
      [orderBy('priority', 'asc')],
      setContacts
    );
    const unsubCheckIn = dbService.subscribeToCollection<CheckIn>(
      `users/${user.uid}/checkins`,
      [where('status', '==', 'pending'), orderBy('deadline', 'asc'), limit(1)],
      (checkins) => setNextCheckIn(checkins[0] || null)
    );

    return () => { unsubAlert(); unsubContacts(); unsubCheckIn(); };
  }, [user]);

  // ── Auto-Trigger Escalation Logic ───────────────────────────────────────
  useEffect(() => {
    if (activeAlert && searchParams.get('autoTrigger') === 'true' && contacts.length > 0 && !escalation) {
      escalationEngine.start(
        activeAlert.id,
        contacts,
        user?.displayName || user?.email || 'User',
        setEscalation
      );
      // Remove query param to prevent re-triggering on refresh
      navigate('/', { replace: true });
    }
  }, [activeAlert, searchParams, contacts, escalation, user, navigate]);

  // ── SOS Button Hold Logic ───────────────────────────────────────────────
  const handleStartHold = () => {
    if (triggering) return;
    setIsHolding(true);
    setHoldProgress(0);
    const startTime = Date.now();
    const duration  = 2000;

    holdTimerRef.current = setInterval(() => {
      const progress = Math.min(((Date.now() - startTime) / duration) * 100, 100);
      setHoldProgress(progress);
      if (progress >= 100) {
        clearInterval(holdTimerRef.current);
        triggerSOS();
      }
    }, 50);
  };

  const handleEndHold = () => {
    setIsHolding(false);
    setHoldProgress(0);
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
  };

  const triggerSOS = async () => {
    if (!user || triggering) return;
    setLastError(null);

    if (contacts.length === 0) {
      setLastError('No Guardians Found: You must add at least one emergency contact before you can trigger an SOS alert.');
      return;
    }

    const hasEnabledGuardians = contacts.some(c => c.receiveEscalations);
    if (!hasEnabledGuardians) {
      setLastError('Escalations Disabled: None of your guardians are currently enabled to receive alerts. Please enable at least one guardian in the "Manage Guardians" section.');
      return;
    }

    if (locationStatus === 'denied') {
      setLastError('Location access is denied. Please enable location permissions.');
      return;
    }

    setTriggering(true);
    setIsHolding(false);
    setHoldProgress(0);

    try {
      const alertId = await sosService.trigger(user);
      if (alertId) {
        escalationEngine.start(alertId, contacts, user.displayName || user.email || 'User', setEscalation);
      } else {
        setLastError('GPS Lock Failed: Your phone could not get a clear signal. Please move outside.');
      }
    } catch (error: any) {
      console.error('[Dashboard] SOS Error:', error);
      let msg = error.message || 'Unknown error occurred.';
      if (msg.includes('Permission denied')) msg = 'Location Permission Denied.';
      setLastError(msg);
    } finally {
      setTriggering(false);
    }
  };

  const cancelSOS = async () => {
    if (!activeAlert) return;
    escalationEngine.stop();
    await sosService.cancel(activeAlert.id);
    setEscalation(null);
  };

  // Dynamic style for radar rings based on hold progress (exponential curve for dramatic slow-to-fast)
  const getRadarStyle = () => {
    const progressFactor = Math.pow(holdProgress / 100, 2); // squares the progress (0 to 1 curve)
    return {
      animationDuration: isHolding ? `${Math.max(0.2, 6 - progressFactor * 5.8)}s` : '6s',
    };
  };

  // ── Active alert view ───────────────────────────────────────────────────
  if (activeAlert) {
    return (
      <AlertActiveView
        alert={activeAlert}
        contacts={contacts}
        escalation={escalation}
        emailConfigured={emailService.isConfigured()}
        onCancel={cancelSOS}
      />
    );
  }

  // ── Normal dashboard ────────────────────────────────────────────────────
  return (
    <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_KEY}>
      <div className="space-y-8">
        {/* Error Banner */}
        {lastError && (
          <div className="flex items-start gap-3 p-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-400">
            <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">error</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1">System Error</p>
              <p className="text-[11px] leading-relaxed break-words">{lastError}</p>
              <button onClick={() => setLastError(null)} className="mt-2 text-[10px] underline uppercase tracking-widest font-black">Dismiss</button>
            </div>
          </div>
        )}

        {/* Email config warning */}
        {!emailService.isConfigured() && (
          <div className="flex items-start gap-3 p-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 text-yellow-400">
            <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">warning</span>
            <p className="text-[11px] font-medium leading-relaxed">
              <strong>Email alerts not configured.</strong> Contacts won't be emailed when you trigger SOS.{' '}
              <a href="/profile" className="underline hover:text-yellow-300">Set up EmailJS →</a>
            </p>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            MOBILE LAYOUT (hidden on lg+)
            ════════════════════════════════════════════════ */}
        <div className="lg:hidden">
          {/* Hero SOS Section */}
          <section className="flex flex-col items-center justify-center py-8 relative overflow-hidden min-h-[400px]">
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30">
              <div className="radar-ring w-[280px] h-[280px]" style={getRadarStyle()}></div>
              <div className="radar-ring w-[440px] h-[440px]" style={getRadarStyle()}></div>
              <div className="radar-ring w-[600px] h-[600px]" style={getRadarStyle()}></div>
            </div>

            <div className="z-10 flex flex-col items-center">
              <button
                onMouseDown={handleStartHold}
                onMouseUp={handleEndHold}
                onMouseLeave={handleEndHold}
                onTouchStart={handleStartHold}
                onTouchEnd={handleEndHold}
                disabled={triggering}
                className={cn(
                  "w-64 h-64 rounded-full sos-glow bg-red-600/90 text-white flex flex-col items-center justify-center relative active:scale-95 transition-transform overflow-hidden",
                  triggering && "animate-pulse cursor-not-allowed"
                )}
              >
                <div
                  className="absolute bottom-0 left-0 w-full bg-white/20 transition-all duration-75"
                  style={{ height: `${holdProgress}%` }}
                />
                <div className="text-6xl font-black italic mb-1 tracking-tighter z-10">
                  {triggering ? '...' : 'SOS'}
                </div>
                <div className="text-[10px] font-bold tracking-[0.2em] opacity-80 uppercase z-10">
                  {triggering ? 'Triggering...' : 'Hold to Trigger'}
                </div>
              </button>

              <div className="mt-12 text-center">
                <h2 className="text-2xl font-light text-on-background/80">
                  Everything is currently <span className="text-accent font-medium">safe</span>.
                </h2>
                <div className="mt-2 flex flex-col items-center gap-2">
                  <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold">
                    Guardian monitoring active
                  </p>
                  <div className={cn(
                    "flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[8px] font-bold uppercase tracking-widest",
                    locationStatus === 'granted' ? "border-green-500/20 bg-green-500/5 text-green-400" :
                    locationStatus === 'denied' ? "border-red-500/20 bg-red-500/5 text-red-400" :
                    "border-yellow-500/20 bg-yellow-500/5 text-yellow-400"
                  )}>
                    <span className="material-symbols-outlined text-[10px]">
                      {locationStatus === 'granted' ? 'location_on' : locationStatus === 'denied' ? 'location_off' : 'location_searching'}
                    </span>
                    {locationStatus === 'granted' 
                      ? `GPS READY ${gpsAccuracy ? `(±${Math.round(gpsAccuracy)}m)` : ''}` 
                      : locationStatus === 'denied' ? 'GPS DENIED' : 'GPS CHECKING...'}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Bento Grid (Mobile) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4">
              <div className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-1">Safety Check-in</div>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-light text-on-background">
                  {nextCheckIn ? `${nextCheckIn.durationSeconds / 60}:00` : '00:00'}
                </span>
                <span className="text-[10px] px-2 py-1 rounded bg-on-background/10 text-on-surface-variant">
                  {nextCheckIn ? 'MONITORING' : 'IDLE'}
                </span>
              </div>
              <div className="w-full bg-on-background/5 h-1 rounded-full overflow-hidden">
                <div className="bg-accent h-full transition-all duration-500" style={{ width: nextCheckIn ? '70%' : '0%' }}></div>
              </div>
              <a href="/checkin" className="w-full py-3 rounded-xl bg-on-background/5 border border-outline text-xs font-semibold hover:bg-on-background/10 transition-colors uppercase tracking-widest mt-2 text-center block text-on-background">
                {nextCheckIn ? 'Manage Check-in' : 'Start Check-in'}
              </a>
            </div>

            <div className="glass-panel rounded-2xl overflow-hidden flex flex-col h-[240px] border border-outline relative">
              {coords ? (
                <Map
                  defaultCenter={coords}
                  center={coords}
                  defaultZoom={15}
                  mapId="DEMO_MAP_ID"
                  className="w-full h-full"
                  disableDefaultUI={true}
                  gestureHandling="greedy"
                  style={{ filter: 'invert(90%) hue-rotate(180deg) brightness(1.2)' }}
                >
                  <AdvancedMarker position={coords}>
                    <div className="relative">
                      <div className="absolute -inset-2 bg-accent/20 rounded-full animate-ping"></div>
                      <div className="w-4 h-4 bg-accent rounded-full border-2 border-white shadow-lg"></div>
                    </div>
                  </AdvancedMarker>
                </Map>
              ) : (
                <div className="relative h-full bg-zinc-900 overflow-hidden flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 opacity-30">
                    <span className="material-symbols-outlined text-4xl">my_location</span>
                    <p className="text-[10px] font-bold uppercase tracking-widest">GPS Ready</p>
                  </div>
                  <div className="absolute bottom-3 left-3">
                    <div className="bg-black/60 px-2 py-1 rounded text-[8px] border border-white/10 font-mono text-white/80 uppercase">Standby</div>
                  </div>
                </div>
              )}
              <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-t from-black/20 to-transparent" />
            </div>

            <div className="glass-panel rounded-2xl p-6 flex flex-col">
              <div className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-4">Guardians</div>
              <div className="space-y-3">
                {contacts.slice(0, 3).map((contact) => {
                  const pc = getPC(contact.priority);
                  return (
                    <div key={contact.id} className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-lg",
                        pc.avatar
                      )}>
                        {contact.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate text-on-surface">{contact.name}</div>
                        <div className={cn("text-[8px] uppercase tracking-tighter flex items-center gap-1 font-bold", pc.nameColor)}>
                          P{contact.priority}
                          {contact.email
                            ? <span className="text-green-400 opacity-80">• Email ✓</span>
                            : <span className="text-yellow-500 opacity-80">• No email</span>
                          }
                        </div>
                      </div>
                    </div>
                  );
                })}
                {contacts.length === 0 && (
                  <p className="text-[10px] text-on-surface-variant/40 italic">No guardians configured.</p>
                )}
              </div>
              <a href="/contacts" className="mt-5 w-full py-3.5 rounded-xl border border-outline bg-on-background/5 text-xs font-semibold hover:bg-on-background/10 transition-colors uppercase tracking-widest text-center block text-on-background">
                Manage Guardians
              </a>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════
            DESKTOP LAYOUT (hidden below lg)
            ════════════════════════════════════════════════ */}
        <div className="hidden lg:flex gap-6 items-start">
          {/* Left column: SOS Hero */}
          <div className="flex-1 flex flex-col items-center">
            <section className="w-full flex flex-col items-center justify-center py-10 relative overflow-hidden min-h-[500px] rounded-3xl glass-panel">
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30">
                <div className="radar-ring w-[240px] h-[240px]" style={getRadarStyle()}></div>
                <div className="radar-ring w-[380px] h-[380px]" style={getRadarStyle()}></div>
                <div className="radar-ring w-[520px] h-[520px]" style={getRadarStyle()}></div>
              </div>

              <div className="z-10 flex flex-col items-center px-6">
                <button
                  onMouseDown={handleStartHold}
                  onMouseUp={handleEndHold}
                  onMouseLeave={handleEndHold}
                  onTouchStart={handleStartHold}
                  onTouchEnd={handleEndHold}
                  disabled={triggering}
                  className={cn(
                    "w-56 h-56 xl:w-64 xl:h-64 rounded-full sos-glow bg-red-600/90 text-white flex flex-col items-center justify-center relative active:scale-95 transition-transform overflow-hidden cursor-pointer select-none",
                    triggering && "animate-pulse cursor-not-allowed"
                  )}
                >
                  <div
                    className="absolute bottom-0 left-0 w-full bg-white/20 transition-all duration-75"
                    style={{ height: `${holdProgress}%` }}
                  />
                  <div className="text-6xl font-black italic mb-1 tracking-tighter z-10">
                    {triggering ? '...' : 'SOS'}
                  </div>
                  <div className="text-[10px] font-bold tracking-[0.2em] opacity-80 uppercase z-10">
                    {triggering ? 'Triggering...' : 'Hold to Trigger'}
                  </div>
                </button>

                <div className="mt-12 text-center">
                  <h2 className="text-2xl font-light text-on-background/80">
                    Everything is currently <span className="text-accent font-medium">safe</span>.
                  </h2>
                  <div className="mt-2 flex flex-col items-center gap-2">
                    <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold">
                      Guardian monitoring active
                    </p>
                    <div className={cn(
                      "flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[8px] font-bold uppercase tracking-widest",
                      locationStatus === 'granted' ? "border-green-500/20 bg-green-500/5 text-green-400" :
                      locationStatus === 'denied' ? "border-red-500/20 bg-red-500/5 text-red-400" :
                      "border-yellow-500/20 bg-yellow-500/5 text-yellow-400"
                    )}>
                      <span className="material-symbols-outlined text-[10px]">
                        {locationStatus === 'granted' ? 'location_on' : locationStatus === 'denied' ? 'location_off' : 'location_searching'}
                      </span>
                      {locationStatus === 'granted' ? 'GPS READY' : locationStatus === 'denied' ? 'GPS DENIED' : 'GPS CHECKING...'}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right column: Cards */}
          <div className="w-80 xl:w-96 flex flex-col gap-4 shrink-0">
            <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4">
              <div className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Safety Check-in</div>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-light text-on-background">
                  {nextCheckIn ? `${nextCheckIn.durationSeconds / 60}:00` : '00:00'}
                </span>
                <span className="text-[10px] px-2 py-1 rounded bg-on-background/10 text-on-surface-variant">
                  {nextCheckIn ? 'MONITORING' : 'IDLE'}
                </span>
              </div>
              <div className="w-full bg-on-background/5 h-1 rounded-full overflow-hidden">
                <div className="bg-accent h-full transition-all duration-500" style={{ width: nextCheckIn ? '70%' : '0%' }}></div>
              </div>
              <a href="/checkin" className="w-full py-3 rounded-xl bg-on-background/5 border border-outline text-xs font-semibold hover:bg-on-background/10 transition-colors uppercase tracking-widest text-center block text-on-background">
                {nextCheckIn ? 'Manage Check-in' : 'Start Check-in'}
              </a>
            </div>

            <div className="glass-panel rounded-2xl p-6 flex flex-col">
              <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-4">Guardians</div>
              <div className="space-y-3">
                {contacts.slice(0, 3).map((contact) => {
                  const pc = getPC(contact.priority);
                  return (
                    <div key={contact.id} className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 shadow-lg",
                        pc.avatar
                      )}>
                        {contact.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{contact.name}</div>
                        <div className={cn("text-[8px] uppercase tracking-tighter flex items-center gap-1 font-bold", pc.nameColor)}>
                          P{contact.priority}
                          {contact.email
                            ? <span className="text-green-400 opacity-80">• Email ✓</span>
                            : <span className="text-yellow-500 opacity-80">• No email</span>
                          }
                        </div>
                      </div>
                    </div>
                  );
                })}
                {contacts.length === 0 && (
                  <p className="text-[10px] text-white/30 italic">No guardians configured.</p>
                )}
              </div>
              <a href="/contacts" className="mt-4 w-full py-3 rounded-xl border border-white/10 bg-white/5 text-xs font-semibold hover:bg-white/10 transition-colors uppercase tracking-widest text-center block">
                Manage Guardians
              </a>
            </div>

            <div className="glass-panel rounded-2xl overflow-hidden h-[180px] flex relative border border-outline">
              {coords ? (
                <Map
                  defaultCenter={coords}
                  center={coords}
                  defaultZoom={15}
                  mapId="DEMO_MAP_ID"
                  className="w-full h-full"
                  disableDefaultUI={true}
                  gestureHandling="greedy"
                  style={{ filter: 'invert(90%) hue-rotate(180deg) brightness(1.2)' }}
                >
                  <AdvancedMarker position={coords}>
                    <div className="relative">
                      <div className="absolute -inset-2 bg-accent/20 rounded-full animate-ping"></div>
                      <div className="w-3 h-3 bg-accent rounded-full border-2 border-white shadow-lg"></div>
                    </div>
                  </AdvancedMarker>
                </Map>
              ) : (
                <div className="relative flex-1 bg-zinc-900/60 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 opacity-30">
                    <span className="material-symbols-outlined text-3xl">my_location</span>
                    <p className="text-[10px] font-bold uppercase tracking-widest">GPS Ready</p>
                  </div>
                  <div className="absolute bottom-3 left-3">
                    <div className="bg-black/60 px-2 py-1 rounded text-[8px] border border-white/10 font-mono text-white/80 uppercase">Standby</div>
                  </div>
                </div>
              )}
              <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-t from-black/20 to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </APIProvider>
  );
}


// ── Alert Active Full-Screen View ──────────────────────────────────────────
function AlertActiveView({
  alert, contacts, escalation, emailConfigured, onCancel
}: {
  alert: Alert;
  contacts: Contact[];
  escalation: EscalationStatus | null;
  emailConfigured: boolean;
  onCancel: () => void;
}) {
  const trackingUrl = `${window.location.origin}/track?alertId=${alert.id}`;
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(trackingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col font-sans overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #b91a24 0%, #7f0e16 60%, #3a0508 100%)' }}>

      {/* Radial glow */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 flex justify-between items-center px-6 h-14 bg-white/5 backdrop-blur-md border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 text-white">
          <span className="material-symbols-outlined text-lg">emergency_share</span>
          <span className="text-base font-extrabold tracking-tight">GUARDIANOS</span>
        </div>
        <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
          <span className="text-[10px] font-bold text-white tracking-widest">LIVE</span>
        </div>
      </header>

      <main className="relative z-10 flex-grow flex flex-col items-center pt-6 pb-32 px-5 overflow-y-auto">
        <div className="w-full max-w-md space-y-4">

          {/* Hero title */}
          <div className="text-center py-2">
            <h1 className="text-2xl font-extrabold uppercase tracking-wide text-white mb-1">Emergency Alert</h1>
            <p className="text-sm text-white/70">SOS is active — location being shared</p>
          </div>

          {/* Pulsing Ring Animation */}
          <div className="flex items-center justify-center py-4">
            <div className="relative w-48 h-48 flex items-center justify-center">
              {/* Outer static ring */}
              <div className="absolute inset-0 rounded-full border-4 border-white/15" />
              {/* Pulsing ring */}
              <div className="animate-sos-pulse absolute inset-3 rounded-full border-2 border-white/30 text-white" />
              {/* Inner white circle */}
              <div className="w-32 h-32 bg-white rounded-full flex flex-col items-center justify-center shadow-2xl z-10">
                <span className="material-symbols-outlined text-4xl text-red-600" style={{ fontVariationSettings: "'FILL' 1" }}>emergency_share</span>
                <span className="text-[10px] font-black text-red-600 uppercase tracking-widest mt-1">Active</span>
              </div>
            </div>
          </div>

          {/* Escalation Status Card */}
          <div className="bg-black/20 backdrop-blur-md rounded-2xl p-5 border border-white/10 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
              Escalation Status {escalation ? `— Level ${escalation.level}` : '— Starting…'}
            </p>

            {contacts.length === 0 && (
              <p className="text-xs text-white/50 italic">No guardian contacts configured. Add contacts to enable escalation.</p>
            )}

            <div className="space-y-2">
              {contacts.map((contact) => {
                const notified = escalation?.notifiedIds.includes(contact.id);
                const isCurrentLevel = escalation?.level === contact.priority;
                return (
                  <div
                    key={contact.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border transition-all",
                      notified
                        ? "bg-white/10 border-white/20"
                        : isCurrentLevel
                        ? "bg-white/5 border-white/20 animate-pulse"
                        : "bg-white/[0.03] border-white/5 opacity-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white",
                        notified ? "bg-green-500/30" : "bg-white/10"
                      )}>
                        {contact.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-white">P{contact.priority}: {contact.name}</p>
                        <p className="text-[10px] text-white/50">
                          {contact.email ? contact.email : <span className="text-yellow-400">No email set</span>}
                        </p>
                      </div>
                    </div>
                    {notified ? (
                      <span className="material-symbols-outlined text-green-400 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    ) : isCurrentLevel ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span className="material-symbols-outlined text-white/30 text-base">schedule</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Next escalation countdown */}
            {escalation?.nextLevelIn != null && escalation.nextLevelIn > 0 && (
              <div className="flex items-center gap-2 pt-3 border-t border-white/10">
                <span className="material-symbols-outlined text-yellow-400 text-sm">timer</span>
                <p className="text-[11px] font-bold text-yellow-300">
                  Next escalation in {formatCountdown(escalation.nextLevelIn)}
                </p>
              </div>
            )}

            {!emailConfigured && (
              <p className="text-[10px] text-yellow-400 border-t border-white/10 pt-3">
                ⚠ Email not configured. Contacts won't receive emails. Share the link manually below.
              </p>
            )}
          </div>

          {/* Tracking Link Card */}
          <div className="bg-black/20 backdrop-blur-md rounded-2xl p-5 border border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50 mb-2">Live Tracking Link</p>
            <p className="text-[10px] font-mono text-white/40 break-all mb-4">{trackingUrl}</p>
            <button
              onClick={copyLink}
              className={cn(
                "w-full h-11 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-200",
                copied
                  ? "bg-green-500/80 text-white"
                  : "bg-white/10 text-white hover:bg-white/20 active:scale-95"
              )}
            >
              <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'content_copy'}</span>
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>

          {/* Location status */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 bg-black/20 backdrop-blur-md rounded-2xl border border-white/10">
              <span className="material-symbols-outlined text-blue-300 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
              <div>
                <p className="font-bold text-sm text-white">Location sharing active</p>
                <p className="text-[10px] text-white/50">Updating in real-time</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-yellow-500/10 backdrop-blur-md rounded-2xl border border-yellow-500/20 text-yellow-200">
              <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">error</span>
              <p className="text-[10px] font-medium leading-relaxed">
                <strong>IMPORTANT:</strong> Keep this page open and your screen ON. If you switch apps or lock your phone, your live location tracking will pause.
              </p>
            </div>
          </div>

        </div>
      </main>

      {/* Cancel Button */}
      <footer className="fixed bottom-0 left-0 w-full px-5 pb-10 pt-6 bg-gradient-to-t from-black/50 to-transparent flex justify-center z-10">
        <button
          onClick={onCancel}
          className="w-full max-w-md h-14 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-full flex items-center justify-center gap-3 active:scale-95 transition-all duration-150 shadow-xl hover:bg-white/15 group"
        >
          <span className="material-symbols-outlined group-active:rotate-90 transition-transform text-base">close</span>
          <span className="font-bold text-sm uppercase tracking-widest">Cancel SOS Alert</span>
        </button>
      </footer>
    </div>
  );
}
