import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { dbService } from '../services/db';
import { Alert, LiveLocation } from '../types';
import { orderBy, limit } from 'firebase/firestore';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';

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
  const hasLocation = lat !== 0 || lng !== 0;

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
                  <div className="absolute -inset-4 bg-accent/20 rounded-full animate-ping"></div>
                  <div className="w-6 h-6 bg-accent rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
              </AdvancedMarker>
            </Map>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-on-background/[0.02] text-on-surface-variant/20 p-10 text-center gap-4">
              <span className="material-symbols-outlined text-4xl">
                {hasLocation ? 'map_off' : 'location_searching'}
              </span>
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  {hasLocation ? 'Maps API key not set' : 'Waiting for location…'}
                </p>
                {hasLocation && (
                  <p className="text-[10px] font-mono text-on-surface-variant/40">
                    Set VITE_GOOGLE_MAPS_KEY in .env
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Telemetry Overlay */}
          {lastLocation && (
            <div className="absolute top-4 left-4 z-10 space-y-2 pointer-events-none">
              <div className="bg-black/70 backdrop-blur-md border border-white/10 rounded-2xl p-4 min-w-[180px]">
                <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest mb-3">Target Telemetry</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-accent text-xs">my_location</span>
                    <span className="text-[10px] font-mono text-white/60">
                      {lastLocation.lat.toFixed(5)}, {lastLocation.lng.toFixed(5)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-accent text-xs">radar</span>
                    <span className="text-[10px] font-mono text-white/60">
                      ±{Math.round(lastLocation.accuracy)}m accuracy
                    </span>
                  </div>
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
