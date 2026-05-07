import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { dbService } from '../services/db';
import { sosService } from '../services/sos';
import { CheckIn } from '../types';
import { where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { cn } from '../lib/utils';

export default function CheckInPage() {
  const { user } = useAuth();
  const [activeCheckIn, setActiveCheckIn]     = useState<CheckIn | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(15);
  const [timeRemaining, setTimeRemaining]     = useState<string | null>(null);
  const [triggering, setTriggering]           = useState(false);

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
        handleExpiry();
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeRemaining(`${mins}:${secs.toString().padStart(2, '0')}`);
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
    setTriggering(true);
    try {
      await sosService.trigger(user);
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

  return (
    <div className="pb-32 space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-light text-white tracking-tight">
          Safety <span className="text-accent font-medium">Registry</span>
        </h2>
        <p className="text-white/40 text-[11px] uppercase tracking-[0.2em] font-bold">
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
            "glass-panel rounded-3xl p-8 relative overflow-hidden transition-all duration-500",
            activeCheckIn ? "border-accent/30 shadow-[0_0_30px_rgba(34,211,238,0.1)]" : "opacity-60"
          )}>
            {activeCheckIn && (
              <div className="absolute top-0 right-0 p-6">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></div>
                  <span className="text-[9px] font-bold text-accent uppercase tracking-widest">Monitoring</span>
                </div>
              </div>
            )}

            <div className="flex flex-col items-center text-center py-6">
              <p className="text-white/30 text-[10px] font-bold uppercase tracking-[0.4em] mb-4">
                {activeCheckIn ? 'Time to Auto-SOS' : 'System Standby'}
              </p>
              <div className={cn(
                "text-7xl font-light text-white tracking-tighter mb-4 font-mono",
                timeRemaining === 'EXPIRED' && "text-red-500"
              )}>
                {timeRemaining || '00:00'}
              </div>

              {activeCheckIn ? (
                <div className="flex gap-3 mt-4 w-full max-w-sm">
                  <button
                    onClick={confirmSafe}
                    className="flex-1 h-14 bg-white/[0.05] border border-accent/30 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-accent/10 group"
                  >
                    <span className="material-symbols-outlined text-accent text-sm group-hover:scale-110 transition-transform">verified_user</span>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">I'm Safe</span>
                  </button>
                  <button
                    onClick={cancelCheckIn}
                    className="h-14 w-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white/40 hover:text-red-400 hover:border-red-500/20 transition-all active:scale-95"
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
              <h3 className="text-xs font-bold text-white/30 uppercase tracking-[0.3em] ml-1">
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
                        : "border-white/5 bg-white/[0.02] text-white/40 hover:bg-white/[0.05]"
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

              <button
                onClick={startCheckIn}
                className="w-full py-5 bg-accent text-black rounded-2xl font-bold text-xs flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all uppercase tracking-[0.2em] shadow-accent/20"
              >
                <span className="material-symbols-outlined text-sm">radar</span>
                Begin Active Watch
              </button>
            </section>
          )}

          {/* How it works */}
          <section className="glass-panel rounded-2xl p-6 space-y-5">
            <h4 className="text-[10px] font-bold text-white/60 uppercase tracking-[0.3em]">How It Works</h4>
            <div className="space-y-4">
              {[
                { step: '01', text: 'Set a safety window (15 min – 2 hours).' },
                { step: '02', text: 'Confirm "I\'m Safe" before the timer ends.' },
                { step: '03', color: 'text-red-500', text: 'If the timer expires — SOS is automatically triggered and your contacts are alerted.' },
              ].map(({ step, text, color }) => (
                <div key={step} className="flex gap-4 items-start">
                  <div className="w-6 h-6 rounded bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-accent shrink-0">{step}</div>
                  <p className={cn("text-[11px] text-white/40 font-medium leading-relaxed uppercase tracking-tighter", color)}>{text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

