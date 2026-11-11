import { FlagRepository } from '../repositories/flagRepository.ts';
import { ReviewRepository } from '../repositories/reviewRepository.ts';
import { AppError } from '../errors/appError.ts';
import type { AuthenticatedUser } from '../middleware/auth.ts';

const VALID_STATUSES = ['pending', 'resolved', 'dismissed'];

export class FlagService {
  private flagRepository: FlagRepository;

  constructor(
    flagRepository: FlagRepository = new FlagRepository(),
    private readonly reviewRepository: ReviewRepository = new ReviewRepository(),
  ) {
    this.flagRepository = flagRepository;
  }

  async createFlag(input: { reviewId: number; reason?: string | null }, actor: AuthenticatedUser) {
    const review = await this.reviewRepository.findById(input.reviewId);
    if (!review) throw new AppError(404, 'REVIEW_NOT_FOUND', 'Ulasan tidak ditemukan.');
    const row = await this.flagRepository.create({
      reviewId: input.reviewId,
      reportedBy: actor.id,
      reason: input.reason,
      status: 'pending',
    });
    if (!row) throw new Error('FLAG_CREATE_FAILED');
    return row;
  }

  async getAllFlags(status?: string) {
    if (status && !VALID_STATUSES.includes(status)) throw new Error('FLAG_INVALID_STATUS');
    return this.flagRepository.findAll(status);
  }

  async updateFlagStatus(id: number, status: string) {
    if (!VALID_STATUSES.includes(status)) throw new Error('FLAG_INVALID_STATUS');
    const row = await this.flagRepository.updateStatus(id, status);
    if (!row) throw new Error('FLAG_NOT_FOUND');
    return row;
  }
}