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
}

export enum TabType {
  PLACES = 'places',
  ACTIVITIES = 'activities',
  HOPES = 'hopes'
}