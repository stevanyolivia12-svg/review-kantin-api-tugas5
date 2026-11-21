import type { UserRole } from '../middleware/auth.ts';

export function auditMetadata(role: UserRole, fields?: string[]): string {
  return JSON.stringify({
    role,
    result: 'success',
    ...(fields?.length ? { fields } : {}),
  });
}
