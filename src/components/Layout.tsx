import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { emailService } from '../services/email';
import { cn } from '../lib/utils';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', icon: 'grid_view',  path: '/' },
    { label: 'Contacts',  icon: 'group',      path: '/contacts' },
    { label: 'Check-in',  icon: 'timer',      path: '/checkin' },
    { label: 'Profile',   icon: 'person',     path: '/profile' },
  ];

  const emailOk = emailService.isConfigured();

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col md:flex-row">

      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 fixed top-0 left-0 h-screen z-50 border-r border-outline-variant bg-surface/60 backdrop-blur-xl">
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-outline-variant">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white shadow-lg text-sm">S</div>
          <h1 className="text-lg font-semibold tracking-tight text-on-background">
            GUARDIAN<span className="text-red-500">OS</span>
          </h1>
        </div>

        {/* User chip */}
        {user && (
          <div className="mx-4 mt-4 flex items-center gap-3 p-3 rounded-xl bg-on-background/[0.03] border border-outline-variant">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-black font-bold text-xs shrink-0">
              {(user.displayName || user.email || 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-on-surface truncate">{user.displayName || 'User'}</p>
              <p className="text-[9px] text-on-surface-variant truncate">{user.email}</p>
            </div>
            {!emailOk && (
              <span className="w-2 h-2 bg-yellow-400 rounded-full shrink-0" title="Email not configured" />
            )}
          </div>
        )}

        {/* Status indicator */}
        <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[9px] font-mono uppercase tracking-widest text-on-surface-variant">Encrypted Link</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 flex flex-col gap-1 px-3 mt-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 group relative",
                  isActive
                    ? "bg-on-background/10 text-on-background"
                    : "text-on-surface-variant hover:text-on-background hover:bg-on-background/5"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-red-500 rounded-r-full" />
                )}
                <span className={cn("material-symbols-outlined text-xl", isActive && "font-fill")}>
                  {item.icon}
                </span>
                <span className="text-xs font-semibold uppercase tracking-widest">{item.label}</span>
                {item.path === '/profile' && !emailOk && (
                  <span className="ml-auto w-2 h-2 bg-yellow-400 rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom of sidebar */}
        <div className="px-6 py-5 border-t border-outline-variant">
          <p className="text-[8px] font-mono text-on-surface-variant uppercase tracking-widest">GuardianOS · v2.4.0</p>
        </div>
      </aside>

      {/* ── Mobile Top Header ───────────────────────────────────── */}
      <header className="md:hidden fixed top-0 left-0 w-full z-50 flex justify-between items-center px-5 h-14 bg-surface/60 backdrop-blur-md border-b border-outline-variant">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white text-xs shadow-lg">S</div>
          <h1 className="text-lg font-semibold tracking-tight text-on-background">
            GUARDIAN<span className="text-red-500">OS</span>
          </h1>
        </div>
        <Link
          to="/profile"
          className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-on-background/5 transition-colors text-on-surface-variant"
          title="Profile"
        >
          <span className="material-symbols-outlined text-lg">person</span>
          {!emailOk && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-yellow-400 rounded-full border border-background" />
          )}
        </Link>
      </header>

      {/* ── Main Content ────────────────────────────────────────── */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <main className="flex-grow pt-20 md:pt-10 px-6 md:px-10 pb-28 md:pb-10 w-full max-w-5xl mx-auto">
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Nav ───────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 pb-4 pt-2 bg-surface/90 border-t border-outline-variant backdrop-blur-xl">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center px-4 py-1 transition-all duration-150 rounded-xl relative",
                isActive ? "text-accent scale-95" : "text-white/40 hover:text-white"
              )}
            >
              <span className={cn("material-symbols-outlined h-5 w-5 flex items-center justify-center text-xl", isActive && "font-fill")}>
                {item.icon}
              </span>
              <span className="text-[9px] uppercase tracking-widest font-bold mt-1">{item.label}</span>
              {item.path === '/profile' && !emailOk && (
                <span className="absolute top-0 right-2 w-2 h-2 bg-yellow-400 rounded-full border border-background" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
