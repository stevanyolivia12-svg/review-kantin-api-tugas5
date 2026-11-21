import { eq } from 'drizzle-orm';
import type { DbExecutor } from '../db/executor.ts';
import { getDb } from '../db/index.ts';
import { users } from '../db/schema.ts';
import crypto from 'node:crypto';
import { compareSync } from 'bcryptjs';

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'owner' | 'customer';
}

function hashPassword(plain: string): string {
  // Hash sederhana (scrypt bawaan Node) supaya tidak perlu install package baru.
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, storedHash: string): boolean {
  if (/^\$2[ab]\$(?:0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/.test(storedHash)) {
    return compareSync(plain, storedHash);
  }

  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash || !/^[0-9a-f]{32}$/.test(salt) || !/^[0-9a-f]{128}$/.test(hash)) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(plain, salt, expected.length);
  return expected.length > 0 && crypto.timingSafeEqual(actual, expected);
}

export class UserRepository {
  async findProfileById(id: number, executor?: DbExecutor) {
    const db = executor ?? await getDb();
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id));
    return rows[0];
  }

  async findAll() {
    const db = await getDb();
    return db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.id);
  }

  async findByEmail(email: string) {
    const db = await getDb();
    const rows = await db.select().from(users).where(eq(users.email, email));
    return rows[0];
  }

  async create(input: CreateUserInput, executor?: DbExecutor) {
    const db = executor ?? await getDb();
    const rows = await db
      .insert(users)
      .output()
      .values({
        name: input.name,
        email: input.email,
        passwordHash: hashPassword(input.password),
        role: input.role,
      });
    return rows[0];
  }
}