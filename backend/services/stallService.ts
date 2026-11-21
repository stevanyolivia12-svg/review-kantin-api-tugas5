import {
  StallRepository,
  type CreateStallInput,
  type FindAllParams,
} from '../repositories/stallRepository.ts';
import { MenuItemRepository } from '../repositories/menuItemRepository.ts';
import type { MenuItemDto, StallResponseDto } from '../dtos/stallDto.ts';
import { AppError } from '../errors/appError.ts';
import type { AuthenticatedUser } from '../middleware/auth.ts';
import { getDb } from '../db/index.ts';
import type { DbExecutor } from '../db/executor.ts';
import { AuditLogRepository } from '../repositories/auditLogRepository.ts';
import { auditMetadata } from './auditMetadata.ts';

type StallRow = NonNullable<Awaited<ReturnType<StallRepository['findById']>>>;

export class StallService {
  private stallRepository: StallRepository;
  private menuItemRepository: MenuItemRepository;
  private auditLogRepository: AuditLogRepository;

  constructor(
    stallRepository: StallRepository = new StallRepository(),
    menuItemRepository: MenuItemRepository = new MenuItemRepository(),
    auditLogRepository: AuditLogRepository = new AuditLogRepository(),
  ) {
    this.stallRepository = stallRepository;
    this.menuItemRepository = menuItemRepository;
    this.auditLogRepository = auditLogRepository;
  }

  // Mapping row DB -> DTO API (sekaligus logika bisnis isPopular).
  private toDto(row: StallRow): StallResponseDto {
    const avgRating = Number(row.avgRating);
    return {
      id: row.id,
      ownerId: row.ownerId,
      name: row.name,
      category: row.category,
      location: row.location,
      description: row.description,
      avgRating,
      reviewCount: row.reviewCount,
      isPopular: avgRating >= 4.7,
    };
  }

  async getAllStalls(params: FindAllParams) {
    const { rows, total } = await this.stallRepository.findAll(params);
    return { data: rows.map((row) => this.toDto(row)), total };
  }

  async getStallById(id: number): Promise<StallResponseDto> {
    const row = await this.stallRepository.findById(id);
    if (!row) throw new Error('STALL_NOT_FOUND');
    return this.toDto(row);
  }

  async getStallMenus(id: number): Promise<MenuItemDto[]> {
    const row = await this.stallRepository.findById(id);
    if (!row) throw new Error('STALL_NOT_FOUND');
    return this.menuItemRepository.findByStallId(id);
  }

  async createStall(input: Omit<CreateStallInput, 'ownerId'>, actor: AuthenticatedUser): Promise<StallResponseDto> {
    const db = await getDb();
    return db.transaction(async (tx) => {
      const row = await this.stallRepository.create({ ...input, ownerId: actor.id }, tx);
      if (!row) throw new Error('STALL_NOT_FOUND');
      await this.auditLogRepository.create({
        userId: actor.id,
        action: 'CREATE_STALL',
        targetTable: 'STALLS',
        targetId: row.id,
        metadata: auditMetadata(actor.role, Object.keys(input)),
      }, tx);
      return this.toDto(row);
    });
  }

  async updateStall(
    id: number,
    input: Partial<Omit<CreateStallInput, 'ownerId'>>,
    actor: AuthenticatedUser,
  ): Promise<StallResponseDto> {
    const db = await getDb();
    return db.transaction(async (tx) => {
      await this.assertCanManage(id, actor, tx);
      const row = await this.stallRepository.update(id, input, tx);
      if (!row) throw new Error('STALL_NOT_FOUND');
      await this.auditLogRepository.create({
        userId: actor.id,
        action: 'UPDATE_STALL',
        targetTable: 'STALLS',
        targetId: row.id,
        metadata: auditMetadata(actor.role, Object.keys(input)),
      }, tx);
      return this.toDto(row);
    });
  }

  async deleteStall(id: number, actor: AuthenticatedUser): Promise<StallResponseDto> {
    if (actor.role !== 'admin') {
      throw new AppError(403, 'FORBIDDEN', 'Hanya admin yang dapat menghapus warung.');
    }
    const db = await getDb();
    return db.transaction(async (tx) => {
      await this.assertCanManage(id, actor, tx);
      const row = await this.stallRepository.remove(id, tx);
      if (!row) throw new Error('STALL_NOT_FOUND');
      await this.auditLogRepository.create({
        userId: actor.id,
        action: 'DELETE_STALL',
        targetTable: 'STALLS',
        targetId: row.id,
        metadata: auditMetadata(actor.role),
      }, tx);
      return this.toDto(row);
    });
  }

  private async assertCanManage(id: number, actor: AuthenticatedUser, executor?: DbExecutor): Promise<void> {
    const stall = await this.stallRepository.findById(id, executor);
    if (!stall) throw new Error('STALL_NOT_FOUND');
    if (
      actor.role !== 'admin' &&
      (actor.role !== 'owner' || stall.ownerId !== actor.id)
    ) {
      throw new AppError(403, 'FORBIDDEN', 'Warung hanya dapat dikelola oleh pemiliknya.');
    }
  }
}
