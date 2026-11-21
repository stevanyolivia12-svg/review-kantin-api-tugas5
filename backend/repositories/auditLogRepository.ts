import { and, count, desc, eq, gte, lt, type SQL } from 'drizzle-orm';
import type { DbExecutor } from '../db/executor.ts';
import { getDb } from '../db/index.ts';
import { auditLogs } from '../db/schema.ts';
import { users } from '../db/schema.ts';

export interface CreateAuditLogInput {
  userId: number;
  action: string;
  targetTable: string;
  targetId: number;
  metadata?: string | null;
}

export interface FindAuditLogsParams {
  page: number;
  pageSize: number;
  action?: string;
  targetTable?: string;
  targetId?: number;
  userId?: number;
  from?: string;
  to?: string;
}

export class AuditLogRepository {
  async findAll(params: FindAuditLogsParams) {
    const db = await getDb();
    const conditions: SQL[] = [];
    if (params.action) conditions.push(eq(auditLogs.action, params.action));
    if (params.targetTable) conditions.push(eq(auditLogs.targetTable, params.targetTable));
    if (params.targetId !== undefined) conditions.push(eq(auditLogs.targetId, params.targetId));
    if (params.userId !== undefined) conditions.push(eq(auditLogs.userId, params.userId));
    if (params.from) conditions.push(gte(auditLogs.createdAt, new Date(`${params.from}T00:00:00.000Z`)));
    if (params.to) {
      const exclusiveEnd = new Date(`${params.to}T00:00:00.000Z`);
      exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
      conditions.push(lt(auditLogs.createdAt, exclusiveEnd));
    }

    const where = conditions.length ? and(...conditions) : undefined;
    const [items, totals] = await Promise.all([
      db
        .select({
          id: auditLogs.id,
          userId: auditLogs.userId,
          userName: users.name,
          userEmail: users.email,
          action: auditLogs.action,
          targetTable: auditLogs.targetTable,
          targetId: auditLogs.targetId,
          metadata: auditLogs.metadata,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .innerJoin(users, eq(auditLogs.userId, users.id))
        .where(where)
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .offset((params.page - 1) * params.pageSize)
        .fetch(params.pageSize),
      db.select({ total: count() }).from(auditLogs).where(where),
    ]);

    return { items, total: Number(totals[0]?.total ?? 0) };
  }

  async findById(id: number) {
    const db = await getDb();
    const rows = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        userName: users.name,
        userEmail: users.email,
        action: auditLogs.action,
        targetTable: auditLogs.targetTable,
        targetId: auditLogs.targetId,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .innerJoin(users, eq(auditLogs.userId, users.id))
      .where(eq(auditLogs.id, id));
    return rows[0];
  }

  async create(input: CreateAuditLogInput, executor?: DbExecutor) {
    const db = executor ?? await getDb();
    const rows = await db
      .insert(auditLogs)
      .output()
      .values({
        userId: input.userId,
        action: input.action,
        targetTable: input.targetTable,
        targetId: input.targetId,
        metadata: input.metadata ?? null,
      });
    return rows[0];
  }
}