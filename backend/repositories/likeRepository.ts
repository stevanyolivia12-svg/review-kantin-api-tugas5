import { eq, and } from 'drizzle-orm';
import type { DbExecutor } from '../db/executor.ts';
import { getDb } from '../db/index.ts';
import { likes, reviews } from '../db/schema.ts';

export interface CreateLikeInput {
  reviewId: number;
  userId: number;
}

export class LikeRepository {
  async findById(id: number, executor?: DbExecutor) {
    const db = executor ?? await getDb();
    const rows = await db.select().from(likes).where(eq(likes.id, id));
    return rows[0];
  }

  async findByUserId(userId: number) {
    const db = await getDb();
    return db.select().from(likes).where(eq(likes.userId, userId)).orderBy(likes.id);
  }

  async findExisting(reviewId: number, userId: number, executor?: DbExecutor) {
    const db = executor ?? await getDb();
    const rows = await db
      .select()
      .from(likes)
      .where(and(eq(likes.reviewId, reviewId), eq(likes.userId, userId)));
    return rows[0];
  }

  async create(input: CreateLikeInput, executor?: DbExecutor) {
    const db = executor ?? await getDb();
    const rows = await db.insert(likes).output().values(input);
    return rows[0];
  }

  async remove(id: number, executor?: DbExecutor) {
    const db = executor ?? await getDb();
    const rows = await db.delete(likes).where(eq(likes.id, id)).output();
    return rows[0];
  }

  async recalcReviewLikeCount(reviewId: number, executor?: DbExecutor) {
    const db = executor ?? await getDb();
    const rows = await db.select().from(likes).where(eq(likes.reviewId, reviewId));
    await db.update(reviews).set({ likeCount: rows.length }).where(eq(reviews.id, reviewId));
  }
}