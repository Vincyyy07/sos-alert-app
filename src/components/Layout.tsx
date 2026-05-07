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
    <div className="min-h-screen flex flex-col bg-background text-on-background pb-24">
      {/* Top Header */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 h-14 bg-black/40 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white shadow-lg">S</div>
          <h1 className="text-xl font-semibold tracking-tight">
            GUARDIAN<span className="text-red-500">OS</span>
          </h1>
        </div>

        <div className="hidden md:flex items-center gap-4 text-[10px] font-mono uppercase tracking-widest text-white/40">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
            ENCRYPTED LINK
          </div>
          {user && <span className="text-accent/60 truncate max-w-[180px]">{user.email}</span>}
        </div>

        <Link
          to="/profile"
          className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors text-white/60"
          title="Profile"
        >
          <span className="material-symbols-outlined">person</span>
          {/* Red dot if email not configured */}
          {!emailOk && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-yellow-400 rounded-full border border-background"></span>
          )}
        </Link>
      </header>

      <main className="pt-20 px-6 max-w-4xl mx-auto w-full flex-grow">
        {children}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 pb-4 pt-2 bg-black border-t border-white/5">
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
              {/* Badge for profile when email not configured */}
              {item.path === '/profile' && !emailOk && (
                <span className="absolute top-0 right-2 w-2 h-2 bg-yellow-400 rounded-full border border-background"></span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
