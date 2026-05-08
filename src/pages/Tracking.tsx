import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { dbService } from '../services/db';
import { Alert, LiveLocation } from '../types';
import { orderBy, limit } from 'firebase/firestore';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { cn } from '../lib/utils';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || (typeof process !== 'undefined' ? (process.env as any).GOOGLE_MAPS_PLATFORM_KEY : '') || '';

export default function Tracking() {
  const [searchParams] = useSearchParams();
  const alertId = searchParams.get('alertId');

  const [alert, setAlert]             = useState<Alert | null>(null);
  const [lastLocation, setLastLocation] = useState<LiveLocation | null>(null);
  const [elapsed, setElapsed]         = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  // Subscribe directly to the alert document
  useEffect(() => {
    if (!alertId) return;
    const unsub = dbService.subscribeToDocument<Alert>('alerts', alertId, setAlert);
    return unsub;
  }, [alertId]);

  // Subscribe to the latest location
  useEffect(() => {
    if (!alertId) return;
    const unsub = dbService.subscribeToCollection<LiveLocation>(
      `alerts/${alertId}/locations`,
      [orderBy('timestamp', 'desc'), limit(1)],
      (locs) => setLastLocation(locs[0] || null)
    );
    return unsub;
  }, [alertId]);

  // Elapsed time since SOS was triggered
  useEffect(() => {
    if (!alert?.timestamp) return;
    const tick = () => {
      const start = alert.timestamp?.toDate?.() ?? new Date(alert.timestamp);
      const diff  = Date.now() - start.getTime();
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [alert]);

  if (!alertId) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold text-on-background mb-2">Invalid Tracking Link</h1>
        <p className="text-on-surface-variant">Please ask the sender for a valid SOS alert URL.</p>
      </div>
    </div>
  );

  const lat = lastLocation?.lat ?? alert?.lastLocation?.lat ?? 0;
  const lng = lastLocation?.lng ?? alert?.lastLocation?.lng ?? 0;
  const accuracy = lastLocation?.accuracy ?? alert?.lastLocation?.accuracy ?? 0;
  const hasLocation = lat !== 0 || lng !== 0;
  const isLive = !!lastLocation;
  const [isStale, setIsStale] = useState(false);

  // Check if location is stale (> 60s)
  useEffect(() => {
    if (!lastLocation?.timestamp) return;
    const interval = setInterval(() => {
      const ts = lastLocation.timestamp.toDate?.() ?? new Date(lastLocation.timestamp);
      const diff = Date.now() - ts.getTime();
      setIsStale(diff > 60000);
    }, 5000);
    return () => clearInterval(interval);
  }, [lastLocation]);

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <div className="h-screen w-full bg-background flex flex-col relative overflow-hidden font-sans">

        {/* Header */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-black/60 backdrop-blur-xl z-50 shrink-0">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-red-500 font-fill animate-pulse">warning</span>
            <div>
              <h1 className="text-sm font-bold text-white tracking-widest uppercase">
                SOS Alert Active
              </h1>
              <span className="text-[9px] text-white/40 uppercase tracking-[0.2em]">
                {alert?.userName || 'User'} · ID: {alertId.slice(0, 8).toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest">
              {alert?.status === 'active' ? 'Active' : alert?.status ?? 'Loading'}
            </span>
          </div>
        </header>

        {/* Map */}
        <main className="flex-1 relative">
          {API_KEY && hasLocation ? (
            <Map
              defaultCenter={{ lat, lng }}
              defaultZoom={15}
              center={{ lat, lng }}
              mapId="DEMO_MAP_ID"
              className="w-full h-full"
              disableDefaultUI={true}
              gestureHandling="greedy"
            >
              <AdvancedMarker position={{ lat, lng }}>
                <div className="relative">
                  {/* Accuracy circle */}
                  {accuracy > 0 && (
                    <div 
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-accent/10 border border-accent/20 rounded-full pointer-events-none"
                      style={{ 
                        width: `${Math.max(40, accuracy * 2)}px`, 
                        height: `${Math.max(40, accuracy * 2)}px` 
                      }}
                    />
                  )}
                  <div className={cn("absolute -inset-4 bg-accent/20 rounded-full", isLive && "animate-ping")}></div>
                  <div className="w-6 h-6 bg-accent rounded-full border-2 border-white shadow-lg flex items-center justify-center relative z-10">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
              </AdvancedMarker>
            </Map>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-on-background/[0.02] p-10 text-center gap-6">
              <div className="relative">
                <div className="absolute -inset-8 bg-accent/5 rounded-full animate-pulse"></div>
                <span className="material-symbols-outlined text-6xl text-on-surface-variant/20">
                  {hasLocation ? 'map_off' : 'location_searching'}
                </span>
              </div>
              <div className="max-w-xs space-y-3">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                  {hasLocation ? 'Maps Config Issue' : 'Waiting for Signal'}
                </p>
                <p className="text-[10px] text-on-surface-variant/40 leading-relaxed uppercase tracking-wider">
                  {hasLocation 
                    ? 'The Google Maps API key is missing or invalid. Check the console for details.' 
                    : 'We are waiting for the sender\'s device to share its GPS coordinates. This may take a moment if they are indoors or have a weak signal.'}
                </p>
                {!hasLocation && (
                  <div className="pt-4 flex flex-col items-center gap-2">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 bg-accent/40 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Telemetry Overlay */}
          {hasLocation && (
            <div className="absolute top-4 left-4 z-10 space-y-2 pointer-events-none">
              <div className="bg-black/70 backdrop-blur-md border border-white/10 rounded-2xl p-4 min-w-[180px]">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Target Telemetry</p>
                  <div className={cn(
                    "px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-tighter",
                    isLive && !isStale ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  )}>
                    {isLive && !isStale ? 'Live' : 'Signal Lost'}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-accent text-xs">my_location</span>
                    <span className="text-[10px] font-mono text-white/60">
                      {lat.toFixed(5)}, {lng.toFixed(5)}
                    </span>
                  </div>
                  {accuracy > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-accent text-xs">radar</span>
                      <span className="text-[10px] font-mono text-white/60">
                        ±{Math.round(accuracy)}m accuracy
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Bottom Control Bar */}
        <div className="bg-black/80 backdrop-blur-xl border-t border-white/5 p-4 shrink-0 z-20">
          <div className="grid grid-cols-2 gap-3 w-full max-w-sm mx-auto">
            <a
              href={hasLocation ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setAcknowledged(true)}
              className={`border flex items-center justify-center gap-2 h-14 rounded-2xl text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                acknowledged ? 'border-green-500/40 text-green-400 bg-green-500/10' : 'border-white/10 text-white hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-sm md:text-base text-accent">directions</span>
              {acknowledged ? 'Routing...' : 'En Route'}
            </a>
            <a
              href={alert?.userPhone ? `tel:${alert.userPhone}` : '#'}
              className="border border-white/10 text-white flex items-center justify-center gap-2 h-14 rounded-2xl text-[10px] md:text-xs font-bold uppercase tracking-wider hover:bg-white/5 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-sm md:text-base text-accent">call</span>
              Call User
            </a>
          </div>
        </div>

        {/* Footer */}
        <footer className="h-8 border-t border-white/5 flex items-center justify-center bg-black shrink-0">
          <p className="text-[8px] font-mono text-white/20 uppercase tracking-[0.4em]">
            Live · Updates every 5s · Powered by GuardianOS
          </p>
        </footer>
      </div>
    </APIProvider>
  );
}
