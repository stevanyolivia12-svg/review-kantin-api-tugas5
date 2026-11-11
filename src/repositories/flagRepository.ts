import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.ts';
import { flags } from '../db/schema.ts';

export interface CreateFlagInput {
  reviewId: number;
  reportedBy: number;
  reason?: string | null;
  status: string;
}

export class FlagRepository {
  async findAll(status?: string) {
    const db = await getDb();
    const query = db.select().from(flags).orderBy(flags.id);
    if (status) {
      return db.select().from(flags).where(eq(flags.status, status)).orderBy(flags.id);
    }
    return query;
  }

  async findById(id: number) {
    const db = await getDb();
    const rows = await db.select().from(flags).where(eq(flags.id, id));
    return rows[0];
  }

  async create(input: CreateFlagInput) {
    const db = await getDb();
    const rows = await db.insert(flags).output().values({
      reviewId: input.reviewId,
      reportedBy: input.reportedBy,
      reason: input.reason ?? null,
      status: input.status,
    });
    return rows[0];
  }

  async updateStatus(id: number, status: string) {
    const db = await getDb();
    const rows = await db.update(flags).set({ status }).where(eq(flags.id, id)).output();
    return rows[0];
  }
}