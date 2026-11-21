import { FlagRepository } from '../repositories/flagRepository.ts';
import { ReviewRepository } from '../repositories/reviewRepository.ts';
import { AppError } from '../errors/appError.ts';
import type { AuthenticatedUser } from '../middleware/auth.ts';
import { getDb } from '../db/index.ts';
import type { DbExecutor } from '../db/executor.ts';
import { AuditLogRepository } from '../repositories/auditLogRepository.ts';
import { auditMetadata } from './auditMetadata.ts';

const VALID_STATUSES = ['pending', 'resolved', 'dismissed'];

export class FlagService {
  private flagRepository: FlagRepository;

  constructor(
    flagRepository: FlagRepository = new FlagRepository(),
    private readonly reviewRepository: ReviewRepository = new ReviewRepository(),
    private readonly auditLogRepository: AuditLogRepository = new AuditLogRepository(),
  ) {
    this.flagRepository = flagRepository;
  }

  async createFlag(input: { reviewId: number; reason?: string | null }, actor: AuthenticatedUser) {
    const db = await getDb();
    return db.transaction(async (tx) => {
      const review = await this.reviewRepository.findById(input.reviewId, tx);
      if (!review) throw new AppError(404, 'REVIEW_NOT_FOUND', 'Ulasan tidak ditemukan.');
      const row = await this.flagRepository.create({
        reviewId: input.reviewId,
        reportedBy: actor.id,
        reason: input.reason,
        status: 'pending',
      }, tx);
      if (!row) throw new Error('FLAG_CREATE_FAILED');
      await this.auditLogRepository.create({
        userId: actor.id,
        action: 'CREATE_FLAG',
        targetTable: 'FLAGS',
        targetId: row.id,
        metadata: auditMetadata(actor.role),
      }, tx);
      return row;
    });
  }

  async getAllFlags(status?: string) {
    if (status && !VALID_STATUSES.includes(status)) throw new Error('FLAG_INVALID_STATUS');
    return this.flagRepository.findAll(status);
  }

  async updateFlagStatus(id: number, status: string, actor: AuthenticatedUser) {
    if (!VALID_STATUSES.includes(status)) throw new Error('FLAG_INVALID_STATUS');
    const db = await getDb();
    return db.transaction(async (tx) => {
      const row = await this.flagRepository.updateStatus(id, status, tx);
      if (!row) throw new Error('FLAG_NOT_FOUND');
      await this.auditLogRepository.create({
        userId: actor.id,
        action: 'UPDATE_FLAG',
        targetTable: 'FLAGS',
        targetId: row.id,
        metadata: JSON.stringify({ role: actor.role, result: 'success', fields: ['status'] }),
      }, tx);
      return row;
    });
  }
}