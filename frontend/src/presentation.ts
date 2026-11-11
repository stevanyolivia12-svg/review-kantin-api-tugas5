import type { Stall, User } from './types';

export function canManageStall(user: User | null, stall: Stall): boolean {
  return user?.role === 'admin' || (user?.role === 'owner' && user.id === stall.ownerId);
}

export function categoryIcon(category: string | null): string {
  const value = category?.toLowerCase() ?? '';
  if (value.includes('minum') || value.includes('kopi')) return '☕';
  if (value.includes('snack') || value.includes('jajan')) return '🥐';
  if (value.includes('dessert') || value.includes('manis')) return '🍰';
  return '🍜';
}
