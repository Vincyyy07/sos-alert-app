import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { dbService } from '../services/db';
import { sosService } from '../services/sos';
import { CheckIn } from '../types';
import { where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { cn } from '../lib/utils';

export default function CheckInPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeCheckIn, setActiveCheckIn]     = useState<CheckIn | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(15);
  const [timeRemaining, setTimeRemaining]     = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const [triggering, setTriggering]           = useState(false);
  const [locationStatus, setLocationStatus] = useState<'checking' | 'granted' | 'denied' | 'prompt'>('checking');
  const [gpsAccuracy, setGpsAccuracy]     = useState<number | null>(null);

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
        setGpsAccuracy(pos.coords.accuracy);
      },
      (err) => {
        if (err.code === 1) setLocationStatus('denied');
        setGpsAccuracy(null);
      },
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = dbService.subscribeToCollection<CheckIn>(
      `users/${user.uid}/checkins`,
      [where('status', '==', 'pending'), orderBy('deadline', 'asc'), limit(1)],
      (checkins) => setActiveCheckIn(checkins[0] || null)
    );
    return unsub;
  }, [user]);

  // Live countdown timer
  useEffect(() => {
    if (!activeCheckIn) { setTimeRemaining(null); return; }

    const tick = () => {
      const deadline = activeCheckIn.deadline.toDate();
      const diff = deadline.getTime() - Date.now();

      if (diff <= 0) {
        setTimeRemaining('EXPIRED');
        setProgressPercent(0);
        handleExpiry();
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeRemaining(`${mins}:${secs.toString().padStart(2, '0')}`);
        
        // Calculate percentage remaining for dynamic color
        const totalDurationMs = activeCheckIn.durationMinutes * 60000;
        const pct = Math.max(0, Math.min(100, (diff / totalDurationMs) * 100));
        setProgressPercent(pct);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeCheckIn]);

  const handleExpiry = async () => {
    if (!activeCheckIn || activeCheckIn.status !== 'pending' || !user) return;
    await dbService.updateDocument(`users/${user.uid}/checkins`, activeCheckIn.id, { status: 'expired' });

    // Auto-trigger SOS
    if (locationStatus === 'denied') {
      console.warn('[CheckIn] Location denied. SOS triggered without location.');
    }

    setTriggering(true);
    try {
      const alertId = await sosService.trigger(user);
      navigate('/?autoTrigger=true'); // Redirect to dashboard and start escalation
    } catch (error) {
      console.error('[CheckIn] Failed to auto-trigger SOS:', error);
    } finally {
      setTriggering(false);
    }
  };

  const startCheckIn = async () => {
    if (!user) return;
    const deadline = new Date();
    deadline.setMinutes(deadline.getMinutes() + selectedDuration);
    await dbService.createDocument(`users/${user.uid}/checkins`, {
      userId: user.uid,
      deadline: Timestamp.fromDate(deadline),
      durationMinutes: selectedDuration,
      status: 'pending',
    });
  };

  const confirmSafe = async () => {
    if (!activeCheckIn || !user) return;
    await dbService.updateDocument(`users/${user.uid}/checkins`, activeCheckIn.id, { status: 'confirmed' });
  };

  const cancelCheckIn = async () => {
    if (!activeCheckIn || !user) return;
    await dbService.updateDocument(`users/${user.uid}/checkins`, activeCheckIn.id, { status: 'confirmed' });
  };

  // Dynamic colors based on time remaining
  const getGlowClasses = () => {
    if (!activeCheckIn) return "opacity-60";
    if (progressPercent === null) return "border-accent/30 shadow-[0_0_30px_rgba(34,211,238,0.1)]"; // Fallback cyan
    
    if (progressPercent > 50) return "border-green-500/40 shadow-[0_0_30px_rgba(34,197,94,0.15)]";
    if (progressPercent > 15) return "border-yellow-500/40 shadow-[0_0_30px_rgba(234,179,8,0.15)]";
    return "border-red-500/60 shadow-[0_0_30px_rgba(239,68,68,0.25)] animate-pulse";
  };

  const getIndicatorColor = () => {
    if (progressPercent === null || progressPercent > 50) return "text-green-400 bg-green-500";
    if (progressPercent > 15) return "text-yellow-400 bg-yellow-500";
    return "text-red-400 bg-red-500";
  };

  return (
    <div className="pb-32 space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-light text-on-background tracking-tight">
          Safety <span className="text-accent font-medium">Registry</span>
        </h2>
        <p className="text-on-surface-variant text-[11px] uppercase tracking-[0.2em] font-bold">
          Automated pulse check protocol
        </p>
      </div>

      {/* Auto-SOS triggered banner */}
      {triggering && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 animate-pulse">
          <span className="material-symbols-outlined text-sm">emergency</span>
          <p className="text-[11px] font-bold uppercase tracking-widest">
            Check-in expired — SOS automatically triggered!
          </p>
        </div>
      )}

      {/* ── Desktop 2-col layout ── */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* Left: Timer Display */}
        <div className="w-full lg:flex-1">
          <section className={cn(
            "glass-panel rounded-2xl md:rounded-3xl p-6 md:p-8 relative overflow-hidden transition-colors duration-1000",
            getGlowClasses()
          )}>
            {activeCheckIn && (
              <div className="absolute top-0 right-0 p-4 md:p-6">
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1 rounded-full border bg-opacity-10 transition-colors duration-1000",
                  progressPercent !== null && progressPercent <= 15 ? "border-red-500/30 bg-red-500" :
                  progressPercent !== null && progressPercent <= 50 ? "border-yellow-500/30 bg-yellow-500" :
                  "border-green-500/30 bg-green-500"
                )}>
                  <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", getIndicatorColor().split(' ')[1])}></div>
                  <span className={cn("text-[9px] font-bold uppercase tracking-widest", getIndicatorColor().split(' ')[0])}>Monitoring</span>
                </div>
              </div>
            )}

            <div className="flex flex-col items-center text-center py-6">
              <p className="text-on-surface-variant/30 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.4em] mb-4">
                {activeCheckIn ? 'Time to Auto-SOS' : 'System Standby'}
              </p>
              <div className={cn(
                "text-5xl md:text-7xl font-light text-on-background tracking-tighter mb-4 font-mono",
                timeRemaining === 'EXPIRED' && "text-red-500"
              )}>
                {timeRemaining || '00:00'}
              </div>

              {activeCheckIn ? (
                <div className="flex gap-3 mt-4 w-full max-w-sm">
                  <button
                    onClick={confirmSafe}
                    className="flex-1 h-14 bg-on-background/[0.05] border border-accent/30 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-accent/10 group"
                  >
                    <span className="material-symbols-outlined text-accent text-sm group-hover:scale-110 transition-transform">verified_user</span>
                    <span className="text-xs font-bold text-on-background uppercase tracking-wider">I'm Safe</span>
                  </button>
                  <button
                    onClick={cancelCheckIn}
                    className="h-14 w-14 bg-on-background/5 border border-outline rounded-2xl flex items-center justify-center text-on-surface-variant hover:text-red-400 hover:border-red-500/20 transition-all active:scale-95"
                    title="Cancel check-in"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              ) : (
                <div className="h-16 w-full flex items-center justify-center text-white/20 italic text-[10px] uppercase tracking-widest mt-4">
                  Initialize protocol below
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right: Config + How it works */}
        <div className="w-full lg:w-80 xl:w-96 shrink-0 space-y-4">
          {/* Duration selector — only when no active check-in */}
          {!activeCheckIn && (
            <section className="space-y-4 animate-in slide-in-from-bottom-8 duration-500">
              <h3 className="text-xs font-bold text-on-surface-variant/30 uppercase tracking-[0.3em] ml-1">
                Protocol Configuration
              </h3>

              <div className="grid grid-cols-2 gap-3">
                {[15, 30, 60, 120].map((duration) => (
                  <button
                    key={duration}
                    onClick={() => setSelectedDuration(duration)}
                    className={cn(
                      "h-20 flex flex-col items-center justify-center border rounded-2xl transition-all active:scale-95 relative overflow-hidden",
                      selectedDuration === duration
                        ? "border-accent/50 bg-accent/5 text-accent shadow-[0_0_15px_rgba(34,211,238,0.1)]"
                        : "border-outline bg-on-background/[0.02] text-on-surface-variant/40 hover:bg-on-background/[0.05]"
                    )}
                  >
                    <span className="text-xs font-bold tracking-widest uppercase mb-1">Window</span>
                    <span className="text-xl font-light">{duration >= 60 ? `${duration / 60}h` : `${duration}m`}</span>
                    {selectedDuration === duration && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"></div>
                    )}
                  </button>
                ))}
              </div>

              {/* Custom Time Input */}
              <div className="flex items-center gap-3 bg-on-background/[0.02] border border-outline rounded-2xl px-5 h-14 focus-within:border-accent/50 focus-within:bg-accent/5 focus-within:shadow-[0_0_15px_rgba(34,211,238,0.1)] transition-all">
                <span className="material-symbols-outlined text-on-surface-variant/30 text-lg">timer</span>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  placeholder="Custom time"
                  className="bg-transparent border-none outline-none text-on-surface text-lg font-light w-full placeholder:text-on-surface-variant/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={selectedDuration || ''}
                  onChange={(e) => setSelectedDuration(parseInt(e.target.value) || 0)}
                />
                <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest shrink-0">Minutes</span>
              </div>

              <button
                onClick={startCheckIn}
                disabled={selectedDuration <= 0}
                className={cn(
                  "w-full py-5 rounded-2xl font-bold text-xs flex items-center justify-center gap-3 shadow-xl transition-all uppercase tracking-[0.2em]",
                  selectedDuration > 0 
                    ? "bg-accent text-black active:scale-95 shadow-accent/20 cursor-pointer" 
                    : "bg-on-background/5 text-on-surface-variant/20 cursor-not-allowed border border-outline"
                )}
              >
                <span className="material-symbols-outlined text-sm">radar</span>
                Begin Active Watch
              </button>
              
              {/* Location Status Indicator */}
              <div className={cn(
                "flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border text-[10px] font-bold uppercase tracking-[0.2em]",
                locationStatus === 'granted' ? "border-green-500/20 bg-green-500/5 text-green-400" :
                locationStatus === 'denied' ? "border-red-500/20 bg-red-500/5 text-red-400" :
                "border-yellow-500/20 bg-yellow-500/5 text-yellow-400"
              )}>
                <span className="material-symbols-outlined text-base">
                  {locationStatus === 'granted' ? 'location_on' : locationStatus === 'denied' ? 'location_off' : 'location_searching'}
                </span>
                {locationStatus === 'granted' 
                  ? `GPS READY ${gpsAccuracy ? `(±${Math.round(gpsAccuracy)}m)` : ''}` 
                  : locationStatus === 'denied' ? 'GPS DENIED - SOS WILL BE LOCATIONLESS' : 'CHECKING GPS STATUS...'}
              </div>
            </section>
          )}

          {/* How it works */}
          <section className="glass-panel rounded-2xl p-6 space-y-5">
            <h4 className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-[0.3em]">How It Works</h4>
            <div className="space-y-4">
              {[
                { step: '01', text: 'Set a safety window (15 min – 2 hours).' },
                { step: '02', text: 'Confirm "I\'m Safe" before the timer ends.' },
                { step: '03', color: 'text-red-500', text: 'If the timer expires — SOS is automatically triggered and your contacts are alerted.' },
              ].map(({ step, text, color }) => (
                <div key={step} className="flex gap-4 items-start">
                  <div className="w-6 h-6 rounded bg-on-background/5 border border-outline flex items-center justify-center text-[10px] font-bold text-accent shrink-0">{step}</div>
                  <p className={cn("text-[11px] text-on-surface-variant/40 font-medium leading-relaxed uppercase tracking-tighter", color)}>{text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

