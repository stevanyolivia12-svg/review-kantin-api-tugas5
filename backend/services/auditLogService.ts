import { AppError } from '../errors/appError.ts';
import {
  AuditLogRepository,
  type CreateAuditLogInput,
  type FindAuditLogsParams,
} from '../repositories/auditLogRepository.ts';

function parseMetadata(metadata: string | null): Record<string, unknown> | null {
  if (metadata === null) return null;
  try {
    const parsed: unknown = JSON.parse(metadata);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return { legacyValue: metadata };
  }
}

export class AuditLogService {
  private auditLogRepository: AuditLogRepository;

  constructor(auditLogRepository: AuditLogRepository = new AuditLogRepository()) {
    this.auditLogRepository = auditLogRepository;
  }

  async getAuditLogs(params: FindAuditLogsParams) {
    const { items, total } = await this.auditLogRepository.findAll(params);
    return {
      items: items.map((item) => ({ ...item, metadata: parseMetadata(item.metadata) })),
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages: Math.ceil(total / params.pageSize),
      },
    };
  }

  async getAuditLogById(id: number) {
    const row = await this.auditLogRepository.findById(id);
    if (!row) throw new AppError(404, 'AUDIT_LOG_NOT_FOUND', 'Audit log tidak ditemukan.');
    return { ...row, metadata: parseMetadata(row.metadata) };
  }

  async record(input: CreateAuditLogInput) {
    if (!Number.isInteger(input.userId) || input.userId < 1
      || !input.action || !input.targetTable || !Number.isInteger(input.targetId) || input.targetId < 1) {
      throw new Error('AUDIT_LOG_INVALID_INPUT');
    }
    const row = await this.auditLogRepository.create(input);
    if (!row) throw new Error('AUDIT_LOG_NOT_FOUND');
    return row;
  }
}