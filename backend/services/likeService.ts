import { LikeRepository, type CreateLikeInput } from '../repositories/likeRepository.ts';
import { AppError } from '../errors/appError.ts';
import type { AuthenticatedUser } from '../middleware/auth.ts';
import { getDb } from '../db/index.ts';
import { AuditLogRepository } from '../repositories/auditLogRepository.ts';
import { auditMetadata } from './auditMetadata.ts';

export class LikeService {
  private likeRepository: LikeRepository;

  constructor(
    likeRepository: LikeRepository = new LikeRepository(),
    private readonly auditLogRepository: AuditLogRepository = new AuditLogRepository(),
  ) {
    this.likeRepository = likeRepository;
  }

  async getLikesByUser(userId: number) {
    return this.likeRepository.findByUserId(userId);
  }

  async createLike(input: Omit<CreateLikeInput, 'userId'>, actor: AuthenticatedUser) {
    if (!input.reviewId) throw new Error('LIKE_INVALID_INPUT');
    const db = await getDb();
    return db.transaction(async (tx) => {
      const existing = await this.likeRepository.findExisting(input.reviewId, actor.id, tx);
      if (existing) throw new AppError(409, 'LIKE_ALREADY_EXISTS', 'Kamu sudah menyukai ulasan ini.');

      const row = await this.likeRepository.create({ ...input, userId: actor.id }, tx);
      if (!row) throw new Error('LIKE_NOT_FOUND');
      await this.likeRepository.recalcReviewLikeCount(input.reviewId, tx);
      await this.auditLogRepository.create({
        userId: actor.id,
        action: 'CREATE_LIKE',
        targetTable: 'LIKES',
        targetId: row.id,
        metadata: auditMetadata(actor.role, ['reviewId']),
      }, tx);
      return row;
    });
  }

  async deleteLike(id: number, actor: AuthenticatedUser) {
    const db = await getDb();
    return db.transaction(async (tx) => {
      const existing = await this.likeRepository.findById(id, tx);
      if (!existing) throw new Error('LIKE_NOT_FOUND');
      if (actor.role !== 'admin' && existing.userId !== actor.id) {
        throw new AppError(403, 'FORBIDDEN', 'Like hanya dapat dihapus oleh pembuatnya.');
      }
      const row = await this.likeRepository.remove(id, tx);
      if (!row) throw new Error('LIKE_NOT_FOUND');
      await this.likeRepository.recalcReviewLikeCount(existing.reviewId, tx);
      await this.auditLogRepository.create({
        userId: actor.id,
        action: 'DELETE_LIKE',
        targetTable: 'LIKES',
        targetId: row.id,
        metadata: auditMetadata(actor.role),
      }, tx);
      return row;
    });
  }
}