import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { dbService } from '../services/db';
import { emailService } from '../services/email';
import { cn } from '../lib/utils';

const STEPS = [
  {
    num: '01',
    title: 'Create free EmailJS account',
    desc: 'Go to emailjs.com → Sign Up (free, 200 emails/month)',
    link: 'https://www.emailjs.com/',
    linkLabel: 'Open EmailJS →',
  },
  {
    num: '02',
    title: 'Connect your Gmail / Outlook',
    desc: 'Dashboard → Email Services → Add New Service → Choose Gmail → Connect account. Copy the Service ID.',
  },
  {
    num: '03',
    title: 'Create an email template',
    desc: 'Email Templates → Create New Template. Use the template below. Copy the Template ID.',
  },
  {
    num: '04',
    title: 'Get your Public Key',
    desc: 'Account → General → Public Key. Copy it.',
  },
  {
    num: '05',
    title: 'Add keys to your .env file',
    desc: 'Create a .env file in your project root with the three lines shown below.',
  },
];

const TEMPLATE_CODE = `Subject: 🚨 SOS Alert — {{from_name}} needs help!

Hi {{to_name}},

{{from_name}} has triggered an emergency SOS alert at {{timestamp}}.

📍 View their LIVE location here:
{{tracking_url}}

This is a {{priority_level}} alert. Please respond immediately.

— GuardianOS`;

const ENV_CODE = `VITE_EMAILJS_PUBLIC_KEY=your_public_key_here
VITE_EMAILJS_SERVICE_ID=your_service_id_here
VITE_EMAILJS_TEMPLATE_ID=your_template_id_here`;

interface UserProfileData {
  displayName?: string;
  phoneNumber?: string;
  email?: string;
}

export default function Profile() {
  const { user, logout } = useAuth();
  const configured = emailService.isConfigured();
  
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({ 
    name: user?.displayName || '', 
    phone: '+91 ', 
    email: user?.email || '' 
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    window.dispatchEvent(new Event('themeChange'));
  };

  useEffect(() => {
    if (user) {
      dbService.getDocument('users', user.uid).then(data => {
        if (data) {
          setProfileData(data);
          setEditForm({ 
            name: data.displayName || user.displayName || '', 
            phone: data.phoneNumber || '+91 ',
            email: data.email || user.email || ''
          });
        }
      });
    }
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    if (!editForm.name.trim()) return alert('Name cannot be empty.');
    if (!editForm.email.trim()) return alert('Email cannot be empty.');
    if (!/^\+91 [0-9]{10}$/.test(editForm.phone)) return alert('Please enter a valid 10-digit phone number after +91 ');
    
    setSavingProfile(true);
    try {
      await dbService.updateDocument('users', user.uid, { 
        displayName: editForm.name.trim(),
        phoneNumber: editForm.phone,
        email: editForm.email.trim()
      });
      setProfileData({ 
        ...profileData, 
        displayName: editForm.name.trim(), 
        phoneNumber: editForm.phone,
        email: editForm.email.trim()
      });
      setIsEditingProfile(false);
    } catch (error) {
      console.error(error);
      alert('Failed to save profile');
    }
    setSavingProfile(false);
  };

  return (
    <div className="pb-32 space-y-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-light text-on-background tracking-tight">
          My <span className="text-accent font-medium">Profile</span>
        </h2>
        <p className="text-on-surface-variant text-[11px] uppercase tracking-[0.2em] font-bold">Account &amp; notification setup</p>
      </div>

      {/* ── Desktop 2-col ── */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* Left column: account info */}
        <div className="w-full lg:w-72 xl:w-80 shrink-0 space-y-4">
          {/* User Card */}
          <div className="glass-panel rounded-2xl p-6 flex items-start gap-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-blue-600 flex items-center justify-center text-black font-bold text-2xl shrink-0 mt-1">
              {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-on-surface font-semibold text-lg truncate">{profileData?.displayName || user?.displayName || 'Anonymous'}</p>
              <p className="text-on-surface-variant text-sm truncate">{user?.email}</p>
              
              <div className="mt-2 flex items-center gap-2">
                <span className="text-accent text-xs font-mono">{profileData?.phoneNumber || 'No phone added'}</span>
              </div>

              <p className="text-[10px] text-on-surface-variant/30 uppercase tracking-widest mt-2">
                UID: {user?.uid?.slice(0, 16)}…
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              onClick={() => setIsEditingProfile(true)}
              className="flex-1 py-3.5 rounded-2xl bg-on-background/5 border border-outline text-xs font-bold uppercase tracking-widest hover:bg-on-background/10 transition-all active:scale-95 flex items-center justify-center gap-2 text-on-background"
            >
              <span className="material-symbols-outlined text-sm">edit</span>
              Edit Profile
            </button>
            <button 
              onClick={logout}
              className="flex-1 py-3.5 rounded-2xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-widest hover:bg-red-500/10 hover:shadow-[0_0_15px_rgba(239,68,68,0.1)] transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              Logout
            </button>
          </div>
          
          <div className="glass-panel rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-accent">
                {theme === 'dark' ? 'dark_mode' : 'light_mode'}
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase text-on-surface-variant tracking-widest">Display Theme</p>
                <p className="text-xs text-on-surface font-medium capitalize">{theme} Mode</p>
              </div>
            </div>
            <button 
              onClick={toggleTheme}
              className="w-10 h-6 bg-on-background/10 rounded-full relative transition-all"
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 rounded-full transition-all duration-300",
                theme === 'dark' ? "right-1 bg-accent" : "left-1 bg-on-background/40"
              )} />
            </button>
          </div>

          {/* Email Config Status */}
          <div className={cn(
            "p-5 rounded-2xl border flex items-start gap-4",
            configured
              ? "border-green-500/20 bg-green-500/5"
              : "border-yellow-500/20 bg-yellow-500/5"
          )}>
            <span className={cn(
              "material-symbols-outlined text-xl shrink-0 mt-0.5",
              configured ? "text-green-400" : "text-yellow-400"
            )}>
              {configured ? 'check_circle' : 'warning'}
            </span>
            <div>
              <p className={cn("font-bold text-sm", configured ? "text-green-300" : "text-yellow-300")}>
                {configured ? 'Email Notifications Active' : 'Email Notifications Not Configured'}
              </p>
              <p className="text-[11px] text-on-surface-variant/40 mt-1">
                {configured
                  ? 'Your contacts will receive SOS alert emails automatically.'
                  : 'Follow the steps below to enable automatic email alerts to your guardian contacts.'}
              </p>
            </div>
          </div>

          {/* Footer removed: redundant information */}
        </div>

        {/* Right column: setup guide */}
        <div className="flex-1 space-y-4">
          {/* Setup Guide */}
          {!configured && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-[0.3em]">EmailJS Setup Guide</h3>

              {STEPS.map(({ num, title, desc, link, linkLabel }) => (
                <div key={num} className="glass-panel rounded-2xl p-5 flex gap-4">
                  <div className="w-7 h-7 rounded bg-on-background/5 border border-outline flex items-center justify-center text-[10px] font-bold text-accent shrink-0">{num}</div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-on-surface">{title}</p>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">{desc}</p>
                    {link && (
                      <a href={link} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] text-accent hover:underline inline-flex items-center gap-1 mt-1">
                        {linkLabel}
                        <span className="material-symbols-outlined text-xs">open_in_new</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}

              {/* Template */}
              <div className="glass-panel rounded-2xl p-5 space-y-3">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">EmailJS Template Content</p>
                <p className="text-[10px] text-on-surface-variant/70">Paste this into your EmailJS template body:</p>
                <pre className="bg-on-surface/5 rounded-xl p-4 text-[11px] font-mono text-accent/80 whitespace-pre-wrap overflow-x-auto border border-outline-variant">
                  {TEMPLATE_CODE}
                </pre>
                <p className="text-[10px] text-on-surface-variant/50">
                  ⚠ Make sure your template has <code className="text-accent">To Email</code> field set to <code className="text-accent">{'{{to_email}}'}</code>
                </p>
              </div>

              {/* .env snippet */}
              <div className="glass-panel rounded-2xl p-5 space-y-3">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">.env file (project root)</p>
                <pre className="bg-on-surface/5 rounded-xl p-4 text-[11px] font-mono text-green-400 whitespace-pre-wrap overflow-x-auto border border-outline-variant">
                  {ENV_CODE}
                </pre>
                <p className="text-[10px] text-on-surface-variant/50">
                  After saving .env, restart the dev server with <code className="text-accent">npm run dev</code>
                </p>
              </div>
            </div>
          )}

          {configured && (
            <div className="glass-panel rounded-2xl p-8 text-center space-y-3">
              <span className="material-symbols-outlined text-4xl text-green-400">check_circle</span>
              <p className="text-on-surface font-semibold">All systems go!</p>
              <p className="text-[11px] text-on-surface-variant">Email notifications are configured and ready. Your guardians will be alerted automatically when SOS is triggered.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Profile Modal ── */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 md:pb-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !savingProfile && setIsEditingProfile(false)} />
          <div className="relative w-full max-w-md glass-panel rounded-2xl p-6 shadow-2xl border border-outline max-h-[85vh] overflow-y-auto hide-scrollbar animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-[0.3em]">Edit Profile</h3>
              <button onClick={() => !savingProfile && setIsEditingProfile(false)} className="w-8 h-8 rounded-lg hover:bg-on-background/10 flex items-center justify-center text-on-surface-variant transition-all">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase text-on-surface-variant/60 tracking-widest ml-1">Display Name</label>
                <input 
                  type="text" 
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full h-12 px-4 bg-on-background/5 border border-outline rounded-xl text-sm focus:border-accent/40 outline-none transition-all text-on-surface"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase text-on-surface-variant/60 tracking-widest ml-1">Email Address</label>
                <input 
                  type="email" 
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full h-12 px-4 bg-on-background/5 border border-outline rounded-xl text-sm focus:border-accent/40 outline-none transition-all text-on-surface"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase text-on-surface-variant/60 tracking-widest ml-1">Phone Number</label>
                <input 
                  type="tel" 
                  value={editForm.phone}
                  onChange={e => {
                    const val = e.target.value;
                    if (!val.startsWith('+91 ')) { setEditForm({ ...editForm, phone: '+91 ' }); return; }
                    if (val.length <= 14) setEditForm({ ...editForm, phone: val });
                  }}
                  className="w-full h-12 px-4 bg-on-background/5 border border-outline rounded-xl text-sm focus:border-accent/40 outline-none transition-all text-on-surface"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setIsEditingProfile(false)} 
                disabled={savingProfile}
                className="flex-1 h-12 rounded-xl bg-on-background/5 text-xs font-bold border border-outline uppercase tracking-widest text-on-surface hover:bg-on-background/10 active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={saveProfile} 
                disabled={savingProfile}
                className="flex-1 h-12 bg-accent text-black rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-accent/20 active:scale-95 transition-all"
              >
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

