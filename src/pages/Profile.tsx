import { useAuth } from '../hooks/useAuth';
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

export default function Profile() {
  const { user, logout } = useAuth();
  const configured = emailService.isConfigured();

  return (
    <div className="pb-32 space-y-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-light text-white tracking-tight">
          My <span className="text-accent font-medium">Profile</span>
        </h2>
        <p className="text-white/40 text-[11px] uppercase tracking-[0.2em] font-bold">Account & notification setup</p>
      </div>

      {/* User Card */}
      <div className="glass-panel rounded-2xl p-6 flex items-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-blue-600 flex items-center justify-center text-black font-bold text-2xl shrink-0">
          {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-lg truncate">{user?.displayName || 'Anonymous'}</p>
          <p className="text-white/40 text-sm truncate">{user?.email}</p>
          <p className="text-[10px] text-white/20 uppercase tracking-widest mt-1">
            UID: {user?.uid?.slice(0, 16)}…
          </p>
        </div>
        <button
          onClick={logout}
          className="shrink-0 flex flex-col items-center gap-1 px-4 py-3 rounded-xl border border-white/10 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 text-white/30 transition-all"
        >
          <span className="material-symbols-outlined text-sm">logout</span>
          <span className="text-[8px] uppercase tracking-widest font-bold">Logout</span>
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
          <p className="text-[11px] text-white/40 mt-1">
            {configured
              ? 'Your contacts will receive SOS alert emails automatically.'
              : 'Follow the steps below to enable automatic email alerts to your guardian contacts.'}
          </p>
        </div>
      </div>

      {/* Setup Guide */}
      {!configured && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-white/40 uppercase tracking-[0.3em]">EmailJS Setup Guide</h3>

          {STEPS.map(({ num, title, desc, link, linkLabel }) => (
            <div key={num} className="glass-panel rounded-2xl p-5 flex gap-4">
              <div className="w-7 h-7 rounded bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-accent shrink-0">{num}</div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="text-[11px] text-white/40 leading-relaxed">{desc}</p>
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
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">EmailJS Template Content</p>
            <p className="text-[10px] text-white/30">Paste this into your EmailJS template body:</p>
            <pre className="bg-black/40 rounded-xl p-4 text-[11px] font-mono text-accent/80 whitespace-pre-wrap overflow-x-auto border border-white/5">
              {TEMPLATE_CODE}
            </pre>
            <p className="text-[10px] text-white/20">
              ⚠ Make sure your template has <code className="text-accent">To Email</code> field set to <code className="text-accent">{'{{to_email}}'}</code>
            </p>
          </div>

          {/* .env snippet */}
          <div className="glass-panel rounded-2xl p-5 space-y-3">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">.env file (project root)</p>
            <pre className="bg-black/40 rounded-xl p-4 text-[11px] font-mono text-green-400 whitespace-pre-wrap overflow-x-auto border border-white/5">
              {ENV_CODE}
            </pre>
            <p className="text-[10px] text-white/20">
              After saving .env, restart the dev server with <code className="text-accent">npm run dev</code>
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-6 rounded-2xl border border-white/5 text-center">
        <p className="text-[9px] font-mono text-white/20 uppercase tracking-widest">GuardianOS · Spark Plan · Frontend-only escalation</p>
      </div>
    </div>
  );
}
