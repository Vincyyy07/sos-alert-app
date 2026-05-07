import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { dbService } from '../services/db';
import { Contact } from '../types';
import { orderBy } from 'firebase/firestore';
import { cn } from '../lib/utils';

const PRIORITY_CONFIG: Record<number, { avatar: string; badge: string; accent: string; cardBg: string; nameColor: string; label: string; icon: string }> = {
  1: {
    avatar:    'bg-gradient-to-br from-rose-400 to-[#E11D48] text-white',
    badge:     'border-[#E11D48] text-[#E11D48] bg-[#E11D48]/10',
    accent:    'border-l-[#E11D48]',
    cardBg:    'bg-[#E11D48]/[0.05]',
    nameColor: 'text-[#E11D48]',
    label:     'INSTANT ALERT',
    icon:      'bolt',
  },
  2: {
    avatar:    'bg-gradient-to-br from-amber-300 to-[#F59E0B] text-white',
    badge:     'border-[#F59E0B] text-[#F59E0B] bg-[#F59E0B]/10',
    accent:    'border-l-[#F59E0B]',
    cardBg:    'bg-[#F59E0B]/[0.05]',
    nameColor: 'text-[#F59E0B]',
    label:     'T+1 MIN ALERT',
    icon:      'schedule',
  },
  3: {
    avatar:    'bg-gradient-to-br from-blue-400 to-[#2563EB] text-white',
    badge:     'border-[#2563EB] text-[#2563EB] bg-[#2563EB]/10',
    accent:    'border-l-[#2563EB]',
    cardBg:    'bg-[#2563EB]/[0.05]',
    nameColor: 'text-[#2563EB]',
    label:     'T+2 MIN ALERT',
    icon:      'schedule',
  },
  4: {
    avatar:    'bg-gradient-to-br from-emerald-400 to-[#10B981] text-white',
    badge:     'border-[#10B981] text-[#10B981] bg-[#10B981]/10',
    accent:    'border-l-[#10B981]',
    cardBg:    'bg-[#10B981]/[0.05]',
    nameColor: 'text-[#10B981]',
    label:     'T+4 MIN ALERT',
    icon:      'schedule',
  },
  5: {
    avatar:    'bg-gradient-to-br from-violet-400 to-[#8B5CF6] text-white',
    badge:     'border-[#8B5CF6] text-[#8B5CF6] bg-[#8B5CF6]/10',
    accent:    'border-l-[#8B5CF6]',
    cardBg:    'bg-[#8B5CF6]/[0.05]',
    nameColor: 'text-[#8B5CF6]',
    label:     'T+5 MIN ALERT',
    icon:      'schedule',
  },
};

const DEFAULT_CONFIG = {
  avatar:    'bg-on-background/10 text-on-surface-variant',
  badge:     'border-outline text-on-surface-variant bg-on-background/5',
  accent:    'border-l-outline',
  cardBg:    'bg-on-background/[0.03]',
  nameColor: 'text-on-surface/70',
  label:     'Other',
  icon:      'person'
};

const getPC = (p: number) => PRIORITY_CONFIG[p] ?? DEFAULT_CONFIG;

const TIMING_MAP: Record<number, string> = {
  1: 'Immediate',
  2: '+1 min',
  3: '+2 mins',
  4: '+4 mins',
  5: '+5 mins',
};
const getTimingLabel = (priority: number): string => TIMING_MAP[priority] ?? `+${priority} mins`;

const phoneRegex = /^\+91 [0-9]{10}$/;

const BLANK_CONTACT = { name: '', phone: '+91 ', email: '', relationship: '', priority: 1, receiveEscalations: true, delayMinutes: 0 };

export default function Contacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [newContact, setNewContact] = useState(BLANK_CONTACT);

  // 3-dot menu
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Edit modal
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', relationship: '', priority: 1, receiveEscalations: true });
  const [editError, setEditError] = useState('');

  // Delete confirmation
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);

  // Priority reorder screen
  const [isReordering, setIsReordering] = useState(false);
  const [reorderList, setReorderList] = useState<Contact[]>([]);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    return dbService.subscribeToCollection<Contact>(
      `users/${user.uid}/contacts`,
      [orderBy('priority', 'asc')],
      setContacts
    );
  }, [user]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Add Contact ──────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      setAddError('');
      if (!newContact.name.trim()) { setAddError('Contact name cannot be empty'); return; }
      if (!phoneRegex.test(newContact.phone)) { setAddError('Enter a valid 10-digit number after +91'); return; }
      if (contacts.some(c => c.phone === newContact.phone)) { setAddError('This number is already added'); return; }
      
      // Validation: Allowed priorities = ONLY P1 to P(N+1)
      const maxAllowed = Math.min(5, contacts.length + 1);
      
      if (contacts.length === 0 && newContact.priority !== 1) {
        setAddError('The first contact must be Priority 1 (Immediate).');
        return;
      }

      if (newContact.priority > maxAllowed) {
        setAddError(`Invalid priority. With ${contacts.length} current contacts, you can only pick P1-P${maxAllowed}.`);
        return;
      }

      await dbService.createDocument(`users/${user.uid}/contacts`, { 
        ...newContact, 
        userId: user.uid,
        name: newContact.name.trim(),
        email: newContact.email.trim()
      });
      setIsAdding(false);
      setNewContact(BLANK_CONTACT);
    } catch (err) {
      setAddError('Failed to add contact. Please try again.');
    }
  };

  // ── Edit Contact ─────────────────────────────────────────────
  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    setEditForm({ 
      name: contact.name, 
      phone: contact.phone, 
      email: contact.email || '', 
      relationship: contact.relationship || '',
      priority: contact.priority, 
      receiveEscalations: contact.receiveEscalations ?? true 
    });
    setEditError('');
    setActiveMenuId(null);
  };

  const handleEditSave = async () => {
    if (!user || !editingContact) return;
    try {
      setEditError('');
      if (!editForm.name.trim()) { setEditError('Name cannot be empty'); return; }
      if (!phoneRegex.test(editForm.phone)) { setEditError('Enter a valid 10-digit number after +91'); return; }
      if (contacts.some(c => c.phone === editForm.phone && c.id !== editingContact.id)) { setEditError('This number is already used by another contact'); return; }
      
      // Validation: Allowed priorities = ONLY P1 to PN for existing contacts
      const maxAllowed = Math.min(5, contacts.length);
      if (editForm.priority > maxAllowed) {
        setEditError(`Invalid priority for current number of contacts. Only P1-P${maxAllowed} allowed.`);
        return;
      }

      await dbService.updateDocument(`users/${user.uid}/contacts`, editingContact.id, {
        name: editForm.name.trim(),
        phone: editForm.phone,
        email: editForm.email.trim(),
        relationship: editForm.relationship.trim(),
        priority: editForm.priority,
        receiveEscalations: editForm.receiveEscalations,
      });
      setEditingContact(null);
    } catch (err) {
      setEditError('Failed to save changes. Please try again.');
    }
  };

  // ── Delete Contact ───────────────────────────────────────────
  const confirmDelete = async () => {
    if (!user || !deletingContact) return;
    await dbService.deleteDocument(`users/${user.uid}/contacts`, deletingContact.id);
    setDeletingContact(null);
  };

  // ── Priority Reorder ─────────────────────────────────────────
  const openReorder = () => {
    setReorderList([...contacts]);
    setIsReordering(true);
    setActiveMenuId(null);
  };

  const movePriority = (idx: number, delta: number) => {
    const newList = [...reorderList];
    const contact = newList[idx];
    const newPriority = contact.priority + delta;
    
    // Limits: Min P1, Max contacts.length
    if (newPriority < 1 || newPriority > contacts.length) return;
    
    newList[idx] = { ...contact, priority: newPriority };
    // Re-sort by priority
    newList.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
    setReorderList(newList);
  };

  const saveReorder = async () => {
    if (!user) return;
    try {
      await Promise.all(reorderList.map((c) =>
        dbService.updateDocument(`users/${user.uid}/contacts`, c.id, { priority: c.priority })
      ));
      setIsReordering(false);
      // Force a tiny timeout to ensure Firestore subscription catches up if needed
      setTimeout(() => setIsReordering(false), 100);
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const phoneChangeHandler = (val: string, setter: (v: string) => void) => {
    if (!val.startsWith('+91 ')) { setter('+91 '); return; }
    if (val.length <= 14) setter(val);
  };

  // ══════════════════════════════════════════════════════════════
  //  PRIORITY REORDER SCREEN
  // ══════════════════════════════════════════════════════════════
  if (isReordering) {
    return (
      <div className="pb-32 space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsReordering(false)} className="w-9 h-9 rounded-xl bg-on-background/5 flex items-center justify-center hover:bg-on-background/10 transition-all text-on-background">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
          </button>
          <div>
            <h2 className="text-xl font-semibold text-on-background">Reorder Contacts</h2>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Drag or tap arrows to reorder</p>
          </div>
        </div>

        <div className="space-y-3">
          {reorderList.map((c, i) => {
            const pc = getPC(c.priority);
            return (
              <div key={c.id} className={cn('glass-panel rounded-2xl p-4 flex items-center gap-4 border-l-2 border border-outline', pc.accent, pc.cardBg)}>
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0', pc.avatar)}>
                  {c.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('font-bold text-sm truncate', pc.nameColor)}>{c.name}</p>
                  <p className="text-[10px] text-on-surface-variant font-mono">{c.phone}</p>
                </div>
                <div className="flex flex-col items-end gap-1 mr-2">
                  <span className={cn('text-[9px] px-2 py-0.5 rounded border font-bold uppercase tracking-widest', pc.badge)}>
                    {pc.label}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => movePriority(i, -1)} disabled={c.priority === 1} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 disabled:opacity-20 transition-all">
                    <span className="material-symbols-outlined text-xs">keyboard_arrow_up</span>
                  </button>
                  <button onClick={() => movePriority(i, 1)} disabled={c.priority === contacts.length} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 disabled:opacity-20 transition-all">
                    <span className="material-symbols-outlined text-xs">keyboard_arrow_down</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button onClick={() => setIsReordering(false)} className="flex-1 h-12 rounded-xl bg-on-background/5 border border-outline text-xs font-bold uppercase tracking-widest text-on-background">Cancel</button>
          <button onClick={saveReorder} className="flex-1 h-12 bg-accent text-black rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-accent/20">Save Order</button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  //  MAIN VIEW
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="pb-32 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-light text-on-background tracking-tight">
            Security <span className="text-accent font-medium">Chain</span>
          </h2>
          <p className="text-on-surface-variant text-[11px] uppercase tracking-[0.2em] font-bold">Escalation protocol management</p>
        </div>
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} className="hidden md:flex shrink-0 items-center gap-2 px-5 py-3 bg-red-600 text-white rounded-xl shadow-lg text-xs font-bold uppercase tracking-widest hover:bg-red-500 transition-all">
            <span className="material-symbols-outlined text-base">add</span>Add Guardian
          </button>
        )}
      </div>

      {/* Status Bar */}
      <div className="glass-panel p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent animate-pulse"></div>
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-accent font-fill">security</span>
        </div>
        <div className="flex-1">
          <h3 className="text-xs font-bold text-on-background/80 uppercase tracking-widest">Active Monitoring</h3>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-tighter">{contacts.length} guardian{contacts.length !== 1 ? 's' : ''} configured</p>
        </div>
        {contacts.length > 1 && (
          <button onClick={openReorder} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-on-background/5 border border-outline hover:bg-on-background/10 transition-all text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-background">
            <span className="material-symbols-outlined text-xs">swap_vert</span>Reorder
          </button>
        )}
      </div>

      {/* Contact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" ref={menuRef}>
        {contacts.map((contact) => {
          const pc = getPC(contact.priority);
          const initials = contact.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
          const isMenuOpen = activeMenuId === contact.id;

          return (
            <div key={contact.id} className={cn('relative glass-panel rounded-2xl md:rounded-3xl p-5 md:p-6 border border-outline transition-all hover:bg-on-background/[0.04]', pc.cardBg)}>
              
              {/* Header: Avatar, Info, and 3-dots */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className={cn('w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center font-black text-lg md:text-xl shadow-2xl shrink-0', pc.avatar)}>
                    {initials}
                  </div>

                  {/* Info Section */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="font-bold text-base md:text-lg text-on-surface leading-tight tracking-tight truncate pr-2">{contact.name}</h3>
                    
                    <div className="flex flex-wrap items-center gap-2 text-on-surface-variant text-[10px] md:text-[11px] mt-1 font-medium">
                      <span>{contact.phone}</span>
                      <span className="w-1 h-1 rounded-full bg-outline shrink-0 hidden md:block"></span>
                      <span className="uppercase tracking-[0.15em] truncate">{contact.relationship}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setActiveMenuId(isMenuOpen ? null : contact.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-on-background/10 text-on-surface-variant hover:text-on-background transition-all shrink-0 -mt-1 -mr-1"
                >
                  <span className="material-symbols-outlined text-base">more_vert</span>
                </button>
              </div>

              {/* Status Row: Priority Badge + Email */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <span className={cn('text-[9px] px-2.5 py-1 rounded-full font-black uppercase tracking-[0.15em] bg-black/40 border border-white/10', pc.nameColor)}>
                  P{contact.priority} • {getTimingLabel(contact.priority).toUpperCase()}
                </span>
                
                {contact.email && (
                  <div className="flex items-center gap-1.5 text-green-500/80 text-[10px] font-semibold">
                    <span className="material-symbols-outlined text-sm shrink-0">mail</span>
                    <span className="truncate max-w-[130px] md:max-w-[180px]">{contact.email}</span>
                  </div>
                )}
              </div>

              {/* Card Footer: Separator + Timing + Toggle */}
              <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', pc.avatar.replace('text-white', pc.nameColor).replace('bg-gradient-to-br', 'bg-white/5'))}>
                    <span className="material-symbols-outlined text-lg">{pc.icon}</span>
                  </div>
                  <span className={cn('text-[10px] font-black uppercase tracking-[0.2em]', pc.nameColor)}>
                    {pc.label}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Escalations</span>
                  <button
                    type="button"
                    onClick={() => dbService.updateDocument(`users/${user.uid}/contacts`, contact.id, { receiveEscalations: !contact.receiveEscalations })}
                    className={cn(
                      "w-10 h-5 rounded-full relative flex items-center transition-all cursor-pointer",
                      contact.receiveEscalations ? "bg-accent/40" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 bg-white rounded-full shadow-lg transition-all duration-300",
                      contact.receiveEscalations ? "translate-x-5.5 bg-accent" : "translate-x-0.5"
                    )}></div>
                  </button>
                </div>
              </div>

              {/* Menu Dropdown */}
              {isMenuOpen && (
                <div 
                  ref={menuRef}
                  className="absolute right-4 top-12 z-50 min-w-[200px] bg-[#111111] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-200"
                >
                  <button onClick={() => openEdit(contact)} className="w-full flex items-center gap-3 px-5 py-4 text-sm text-white/80 hover:bg-white/5 transition-colors text-left border-b border-white/5">
                    <span className="material-symbols-outlined text-base text-white/40">edit</span>Edit Details
                  </button>
                  <button onClick={openReorder} className="w-full flex items-center gap-3 px-5 py-4 text-sm text-white/80 hover:bg-white/10 transition-colors text-left border-b border-white/5">
                    <span className="material-symbols-outlined text-base text-white/40">swap_vert</span>Change Priority
                  </button>
                  <button onClick={() => { setDeletingContact(contact); setActiveMenuId(null); }} className="w-full flex items-center gap-3 px-5 py-4 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left">
                    <span className="material-symbols-outlined text-base">delete</span>Delete Contact
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {contacts.length === 0 && !isAdding && (
          <div className="col-span-full glass-panel rounded-2xl p-10 text-center text-white/20 space-y-3">
            <span className="material-symbols-outlined text-4xl">group_add</span>
            <p className="text-xs font-bold uppercase tracking-widest">No guardians yet</p>
            <p className="text-[10px]">Add trusted contacts so they can be alerted when you trigger SOS.</p>
          </div>
        )}
      </div>

      {/* Add Contact Form */}
      {isAdding ? (
        <div className="glass-panel p-6 rounded-2xl shadow-2xl">
          <h3 className="text-xs font-bold text-white uppercase tracking-[0.3em] mb-5">Add New Guardian</h3>
          {addError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-sm">error</span>{addError}
            </div>
          )}
          <form className="space-y-4" onSubmit={handleAdd}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase text-white/30 tracking-widest ml-1">Name</label>
                <input required placeholder="Full name" className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-sm focus:border-accent/40 outline-none transition-all" value={newContact.name} onChange={e => setNewContact({ ...newContact, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase text-white/30 tracking-widest ml-1">Phone</label>
                <input required type="tel" placeholder="+91 XXXXXXXXXX" className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-sm focus:border-accent/40 outline-none transition-all" value={newContact.phone} onChange={e => phoneChangeHandler(e.target.value, v => setNewContact({ ...newContact, phone: v }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase text-white/30 tracking-widest ml-1">Email <span className="text-accent">(required for SOS alerts)</span></label>
              <input type="email" placeholder="guardian@example.com" className="w-full h-12 px-4 bg-white/5 border border-accent/20 rounded-xl text-sm focus:border-accent/50 outline-none transition-all" value={newContact.email} onChange={e => setNewContact({ ...newContact, email: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase text-white/30 tracking-widest ml-1">Relationship</label>
                <input required placeholder="e.g. Parent" className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-sm focus:border-accent/40 outline-none transition-all" value={newContact.relationship} onChange={e => setNewContact({ ...newContact, relationship: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase text-white/30 tracking-widest ml-1">Priority Group</label>
                <select 
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-sm focus:border-accent/40 outline-none transition-all appearance-none" 
                  value={newContact.priority} 
                  onChange={e => setNewContact({ ...newContact, priority: parseInt(e.target.value) })}
                >
                  {[1, 2, 3, 4, 5].map(p => (
                    <option key={p} value={p} className="bg-black text-white">
                      {TIMING_MAP[p] ? `P${p} • ${TIMING_MAP[p]}` : `Priority ${p}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setIsAdding(false); setAddError(''); }} className="flex-1 h-12 rounded-xl bg-white/5 text-xs font-bold border border-white/5 uppercase tracking-widest">Cancel</button>
              <button type="submit" className="flex-1 h-12 bg-accent text-black rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-accent/20">Add Guardian</button>
            </div>
          </form>
        </div>
      ) : (
        <button onClick={() => setIsAdding(true)} className="md:hidden fixed bottom-24 right-6 w-14 h-14 bg-red-600 text-white rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-90 transition-transform sos-glow">
          <span className="material-symbols-outlined text-2xl">add</span>
        </button>
      )}

      {/* ── Edit Details Modal ── */}
      {editingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 md:pb-4" onClick={e => { if (e.target === e.currentTarget) setEditingContact(null); }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingContact(null)} />
          <div className="relative w-full max-w-md glass-panel rounded-2xl p-6 shadow-2xl border border-white/10 max-h-[85vh] overflow-y-auto hide-scrollbar">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-bold text-white uppercase tracking-[0.3em]">Edit Contact</h3>
              <button onClick={() => setEditingContact(null)} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/40">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {editError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2 mb-5">
                <span className="material-symbols-outlined text-sm">error</span>{editError}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase text-white/30 tracking-widest ml-1">Name</label>
                <input className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-sm focus:border-accent/40 outline-none transition-all" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase text-white/30 tracking-widest ml-1">Phone</label>
                <input type="tel" className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-sm focus:border-accent/40 outline-none transition-all" value={editForm.phone} onChange={e => phoneChangeHandler(e.target.value, v => setEditForm({ ...editForm, phone: v }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase text-white/30 tracking-widest ml-1">Email</label>
                <input type="email" className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-sm focus:border-accent/40 outline-none transition-all" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase text-white/30 tracking-widest ml-1">Relationship</label>
                <input className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-sm focus:border-accent/40 outline-none transition-all" value={editForm.relationship} onChange={e => setEditForm({ ...editForm, relationship: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase text-white/30 tracking-widest ml-1">Priority Group</label>
                <select 
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-sm focus:border-accent/40 outline-none transition-all appearance-none" 
                  value={editForm.priority} 
                  onChange={e => setEditForm({ ...editForm, priority: parseInt(e.target.value) })}
                >
                  {[1, 2, 3, 4, 5].map(p => (
                    <option key={p} value={p} className="bg-black text-white">
                      {TIMING_MAP[p] ? `P${p} • ${TIMING_MAP[p]}` : `Priority ${p}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-semibold text-white">Receive Escalations</p>
                  <p className="text-[10px] text-white/30">Alert this contact during auto-escalation</p>
                </div>
                <button type="button" onClick={() => setEditForm({ ...editForm, receiveEscalations: !editForm.receiveEscalations })} className={cn('w-10 h-5 rounded-full relative flex items-center transition-all', editForm.receiveEscalations ? 'bg-accent/60' : 'bg-white/10')}>
                  <div className={cn('w-4 h-4 bg-white rounded-full shadow-lg transition-transform', editForm.receiveEscalations ? 'translate-x-5' : 'translate-x-0.5')} />
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingContact(null)} className="flex-1 h-12 rounded-xl bg-white/5 text-xs font-bold border border-white/5 uppercase tracking-widest">Cancel</button>
              <button onClick={handleEditSave} className="flex-1 h-12 bg-accent text-black rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-accent/20">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deletingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeletingContact(null)} />
          <div className="relative w-full max-w-sm glass-panel rounded-2xl p-6 shadow-2xl border border-red-500/20 text-center space-y-5">
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-red-400 text-2xl">person_remove</span>
            </div>
            <div>
              <h3 className="font-bold text-white text-base mb-1">Remove Guardian?</h3>
              <p className="text-xs text-white/40">Are you sure you want to remove <span className="text-white font-semibold">{deletingContact.name}</span> from your security chain?</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeletingContact(null)} className="flex-1 h-11 rounded-xl bg-white/5 text-xs font-bold border border-white/5 uppercase tracking-widest">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 h-11 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-colors">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
