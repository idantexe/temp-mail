export interface UserProfile {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  email: string | null;
  relationshipId: string | null; // ID of the shared space
}

export interface Relationship {
  id: string;
  code: string; // The 6-digit invite code
  createdAt: number;
  startDate: string; // "YYYY-MM-DD"
  partnerIds: string[];
  loveNote?: string; // Fitur baru: Shared note
  loveNoteUpdater?: string; // Siapa yang terakhir update
}

export interface WishlistItem {
  id: string;
  category: 'places' | 'activities' | 'hopes';
  title: string;
  note?: string;
  link?: string;
  targetDate?: string;
  completed: boolean;
  createdBy: string;
  createdAt: number;
  // Fitur Baru
  priority: 'high' | 'medium' | 'low';
  budget: 'free' | 'low' | 'medium' | 'high';
}

export enum TabType {
  PLACES = 'places',
  ACTIVITIES = 'activities',
  HOPES = 'hopes'
}