export type UserRole = 'admin' | 'owner' | 'customer';

export interface User {
  id: number;
  email: string;
  role: UserRole;
}

export interface Stall {
  id: number;
  ownerId: number;
  name: string;
  category: string | null;
  location: string | null;
  description: string | null;
  avgRating: number;
  reviewCount: number;
  isPopular: boolean;
}

export interface StallInput {
  name: string;
  category: string | null;
  location: string | null;
  description: string | null;
}

export interface AuthSession {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: User;
}

export interface AuthUser extends User {
  name: string;
  createdAt: string | null;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
}

export interface StallList {
  data: Stall[];
  meta: PageMeta;
}

export interface MenuItem {
  id: number;
  stallId: number;
  name: string;
  price: number;
  isAvailable: boolean;
}

export interface MenuItemInput {
  stallId: number;
  name: string;
  price: number;
  isAvailable: boolean;
}

export interface Review {
  id: number;
  stallId: number;
  userId: number;
  rating: number;
  comment: string | null;
  likeCount: number;
  createdAt: string | null;
  user?: { id: number; name: string } | null;
}

export interface Like {
  id: number;
  reviewId: number;
  userId: number;
  createdAt: string | null;
}

export interface Flag {
  id: number;
  reviewId: number;
  reportedBy: number;
  reason: string | null;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string | null;
}

export interface ManagedUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string | null;
}

export interface AuditLog {
  id: number;
  userId: number;
  action: string;
  targetTable: string;
  targetId: number;
  metadata: string | null;
  createdAt: string | null;
}
