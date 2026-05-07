import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { dbService } from '../services/db';
import { Contact } from '../types';
import { orderBy } from 'firebase/firestore';
import { cn } from '../lib/utils';

export default function Contacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: '',
    relationship: '',
    priority: 1 as 1 | 2 | 3,
    receiveEscalations: true,
    delayMinutes: 0,
  });

  useEffect(() => {
    if (!user) return;
    const unsub = dbService.subscribeToCollection<Contact>(
      `users/${user.uid}/contacts`,
      [orderBy('priority', 'asc')],
      setContacts
    );
    return unsub;
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    await dbService.createDocument(`users/${user.uid}/contacts`, {
      ...newContact,
      userId: user.uid,
    });
    setIsAdding(false);
    setNewContact({ name: '', phone: '', email: '', relationship: '', priority: 1, receiveEscalations: true, delayMinutes: 0 });
  };

  const deleteContact = async (id: string) => {
    if (!user) return;
    await dbService.deleteDocument(`users/${user.uid}/contacts`, id);
  };

  return (
    <div className="pb-32 space-y-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-light text-white tracking-tight">
          Security <span className="text-accent font-medium">Chain</span>
        </h2>
        <p className="text-white/40 text-[11px] uppercase tracking-[0.2em] font-bold">
          Escalation protocol management
        </p>
      </div>

      {/* Status Bar */}
      <div className="glass-panel p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent animate-pulse"></div>
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-accent font-fill">security</span>
        </div>
        <div>
          <h3 className="text-xs font-bold text-white/80 uppercase tracking-widest">Active Monitoring</h3>
          <p className="text-[10px] text-white/30 uppercase tracking-tighter">
            {contacts.length} guardian{contacts.length !== 1 ? 's' : ''} configured
          </p>
        </div>
      </div>

      {/* Contact List */}
      <div className="space-y-4">
        {contacts.map((contact, idx) => (
          <div key={contact.id} className="glass-panel rounded-2xl p-6 transition-all hover:bg-white/[0.05] group">
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg",
                    contact.priority === 1
                      ? "bg-gradient-to-br from-accent to-blue-600 text-black"
                      : "bg-white/5 text-white/60 border border-white/5"
                  )}>
                    {contact.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg text-white leading-none">{contact.name}</h3>
                      <span className={cn(
                        "text-[9px] px-2 py-0.5 rounded border font-bold uppercase tracking-widest",
                        contact.priority === 1 ? "border-accent text-accent" : "border-white/10 text-white/30"
                      )}>
                        P{contact.priority}
                      </span>
                    </div>
                    <p className="text-white/40 text-xs font-mono tracking-tighter">
                      {contact.phone} · {contact.relationship.toUpperCase()}
                    </p>
                    {contact.email ? (
                      <p className="text-[10px] text-green-400 mt-0.5 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">mail</span>
                        {contact.email}
                      </p>
                    ) : (
                      <p className="text-[10px] text-yellow-500 mt-0.5 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">warning</span>
                        No email — won't receive alerts
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteContact(contact.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-accent text-xs">
                    {contact.priority === 1 ? 'bolt' : 'schedule'}
                  </span>
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                    {contact.priority === 1 ? 'Instant Alert' : `T+${contact.delayMinutes || (contact.priority === 2 ? 2 : 5)} Mins`}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-white/20 uppercase">Escalations</span>
                  <div className={cn(
                    "w-8 h-4 rounded-full relative flex items-center transition-all",
                    contact.receiveEscalations ? "bg-accent/40" : "bg-white/5"
                  )}>
                    <div className={cn(
                      "w-3 h-3 bg-white rounded-full shadow-lg transition-transform",
                      contact.receiveEscalations ? "translate-x-4 bg-accent" : "translate-x-0.5"
                    )}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {contacts.length === 0 && !isAdding && (
          <div className="glass-panel rounded-2xl p-10 text-center text-white/20 space-y-3">
            <span className="material-symbols-outlined text-4xl">group_add</span>
            <p className="text-xs font-bold uppercase tracking-widest">No guardians yet</p>
            <p className="text-[10px]">Add trusted contacts so they can be alerted when you trigger SOS.</p>
          </div>
        )}
      </div>

      {/* Add Contact Form */}
      {isAdding ? (
        <div className="glass-panel p-6 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
          <h3 className="text-xs font-bold text-white uppercase tracking-[0.3em] mb-6">Add New Guardian</h3>
          <form className="space-y-5" onSubmit={handleAdd}>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-bold uppercase text-white/30 tracking-widest ml-1">Name</label>
                <input
                  required
                  placeholder="Full name"
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-sm focus:border-accent/40 outline-none transition-all"
                  value={newContact.name}
                  onChange={e => setNewContact({ ...newContact, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-bold uppercase text-white/30 tracking-widest ml-1">Phone</label>
                <input
                  required
                  placeholder="+1 555 000 0000"
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-sm focus:border-accent/40 outline-none transition-all"
                  value={newContact.phone}
                  onChange={e => setNewContact({ ...newContact, phone: e.target.value })}
                />
              </div>
            </div>

            {/* Email — critical for notifications */}
            <div className="space-y-2">
              <label className="text-[9px] font-bold uppercase text-white/30 tracking-widest ml-1">
                Email <span className="text-accent">(required for SOS alerts)</span>
              </label>
              <input
                type="email"
                placeholder="guardian@example.com"
                className="w-full h-12 px-4 bg-white/5 border border-accent/20 rounded-xl text-sm focus:border-accent/50 outline-none transition-all"
                value={newContact.email}
                onChange={e => setNewContact({ ...newContact, email: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-bold uppercase text-white/30 tracking-widest ml-1">Relationship</label>
                <input
                  required
                  placeholder="e.g. Parent"
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-sm focus:border-accent/40 outline-none transition-all"
                  value={newContact.relationship}
                  onChange={e => setNewContact({ ...newContact, relationship: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-bold uppercase text-white/30 tracking-widest ml-1">Priority Tier</label>
                <select
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-sm focus:border-accent/40 outline-none transition-all appearance-none"
                  value={newContact.priority}
                  onChange={e => setNewContact({ ...newContact, priority: parseInt(e.target.value) as 1 | 2 | 3 })}
                >
                  <option value={1} className="bg-background">P1 — Instant</option>
                  <option value={2} className="bg-background">P2 — After 2 min</option>
                  <option value={3} className="bg-background">P3 — After 5 min</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="flex-1 h-12 rounded-xl bg-white/5 text-xs font-bold border border-white/5 uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 h-12 bg-accent text-black rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-accent/20"
              >
                Add Guardian
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="fixed bottom-24 right-6 w-14 h-14 bg-red-600 text-white rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-90 transition-transform sos-glow"
        >
          <span className="material-symbols-outlined text-2xl">add</span>
        </button>
      )}
    </div>
  );
}
