export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber: string | null;
  createdAt: string;
}

export interface Contact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email?: string;          // For email notifications
  relationship: string;
  priority: number;          // 1 = immediate, 2+ = escalation groups
  receiveEscalations: boolean;
  delayMinutes: number;
}

export interface Alert {
  id: string;
  userId: string;
  userName: string;
  status: 'active' | 'resolved' | 'cancelled';
  currentLevel: number;
  timestamp: any; // Firestore Timestamp
  lastLocation?: {
    lat: number;
    lng: number;
    address?: string;
  };
}

export interface LiveLocation {
  id: string;
  userId: string;
  alertId: string;
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: any;
  battery?: number;
  signal?: string;
}

export interface CheckIn {
  id: string;
  userId: string;
  deadline: any;
  durationMinutes: number;
  status: 'pending' | 'confirmed' | 'expired' | 'alerted';
  createdAt: any;
}

export interface EscalationLog {
  id: string;
  alertId: string;
  contactId: string;
  contactName: string;
  level: number;
  emailSent: boolean;
  timestamp: any;
}
