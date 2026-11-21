import { UserRepository, type CreateUserInput } from '../repositories/userRepository.ts';
import type { UserResponseDto } from '../dtos/userDto.ts';
import { getDb } from '../db/index.ts';
import { AuditLogRepository } from '../repositories/auditLogRepository.ts';
import { auditMetadata } from './auditMetadata.ts';
import type { AuthenticatedUser } from '../middleware/auth.ts';

type UserRow = { id: number; name: string; email: string; role: string; createdAt: Date | string | null };

export class UserService {
  private userRepository: UserRepository;

  constructor(
    userRepository: UserRepository = new UserRepository(),
    private readonly auditLogRepository: AuditLogRepository = new AuditLogRepository(),
  ) {
    this.userRepository = userRepository;
  }

  private toDto(row: UserRow): UserResponseDto {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role as UserResponseDto['role'],
      createdAt: row.createdAt,
    };
  }

  async getAllUsers(): Promise<UserResponseDto[]> {
    const rows = await this.userRepository.findAll();
    return rows.map((row) => this.toDto(row));
  }

  async createUser(input: CreateUserInput, actor: AuthenticatedUser): Promise<UserResponseDto> {
    if (!input.name || !input.email || !input.password || !input.role) {
      throw new Error('USER_INVALID_INPUT');
    }
    if (!['admin', 'owner', 'customer'].includes(input.role)) {
      throw new Error('USER_INVALID_ROLE');
    }
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) throw new Error('USER_EMAIL_TAKEN');

    const db = await getDb();
    const row = await db.transaction(async (tx) => {
      const created = await this.userRepository.create(input, tx);
      if (!created) throw new Error('USER_CREATE_FAILED');
      await this.auditLogRepository.create({
        userId: actor.id,
        action: 'CREATE_USER',
        targetTable: 'USERS',
        targetId: created.id,
        metadata: auditMetadata(actor.role, ['name', 'email', 'role']),
      }, tx);
      return created;
    });
    return this.toDto(row as unknown as UserRow);
  }
}