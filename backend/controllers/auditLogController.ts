import type { Request, Response } from 'express';
import { AuditLogService } from '../services/auditLogService.ts';
import { respondWithError } from '../middleware/errorHandler.ts';

export class AuditLogController {
  private auditLogService: AuditLogService;

  constructor(auditLogService: AuditLogService = new AuditLogService()) {
    this.auditLogService = auditLogService;
  }

  private handleError(res: Response, error: unknown): Response {
    return respondWithError(res, error);
  }

  getAuditLogs = async (_req: Request, res: Response): Promise<Response> => {
    try {
      const filters = res.locals.validatedQuery as Parameters<AuditLogService['getAuditLogs']>[0];
      const data = await this.auditLogService.getAuditLogs(filters);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return this.handleError(res, error);
    }
  };

  getAuditLogById = async (req: Request, res: Response): Promise<Response> => {
    try {
      const data = await this.auditLogService.getAuditLogById(Number(req.params.id));
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return this.handleError(res, error);
    }
  };
}