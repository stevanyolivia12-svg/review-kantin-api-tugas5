import { AppError } from '../errors/appError.ts';
import { createAccessToken, type AuthenticatedUser } from '../middleware/auth.ts';
import { UserRepository, verifyPassword } from '../repositories/userRepository.ts';
import type { UserResponseDto } from '../dtos/userDto.ts';
import { getDb } from '../db/index.ts';
import { AuditLogRepository } from '../repositories/auditLogRepository.ts';
import { auditMetadata } from './auditMetadata.ts';

interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

export class AuthService {
  constructor(
    private readonly userRepository: UserRepository = new UserRepository(),
    private readonly auditLogRepository: AuditLogRepository = new AuditLogRepository(),
  ) {}

  async register(input: RegisterInput) {
    if (await this.userRepository.findByEmail(input.email)) {
      throw new AppError(409, 'EMAIL_TAKEN', 'Email sudah terdaftar.');
    }
    const db = await getDb();
    const user = await db.transaction(async (tx) => {
      const row = await this.userRepository.create({ ...input, role: 'customer' }, tx);
      if (!row) throw new AppError(500, 'USER_CREATE_FAILED', 'User gagal dibuat.');
      await this.auditLogRepository.create({
        userId: row.id,
        action: 'CREATE_USER',
        targetTable: 'USERS',
        targetId: row.id,
        metadata: auditMetadata('customer', ['name', 'email', 'role']),
      }, tx);
      return row;
    });
    return this.issueToken({ id: user.id, email: user.email, role: user.role as AuthenticatedUser['role'] });
  }

  async login(input: LoginInput) {
    const row = await this.userRepository.findByEmail(input.email);
    if (!row || !verifyPassword(input.password, row.passwordHash)) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email atau password salah.');
    }
    return this.issueToken({ id: row.id, email: row.email, role: row.role as AuthenticatedUser['role'] });
  }

  async getCurrentUser(userId: number): Promise<UserResponseDto> {
    const user = await this.userRepository.findProfileById(userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User tidak ditemukan.');
    }
    return { ...user, role: user.role as UserResponseDto['role'] };
  }

  private issueToken(user: AuthenticatedUser) {
    return {
      accessToken: createAccessToken(user),
      tokenType: 'Bearer',
      expiresIn: 3600,
      user,
    };
  }
}