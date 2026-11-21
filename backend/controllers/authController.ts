import type { Request, Response } from 'express';
import { AuthService } from '../services/authService.ts';
import { AuditLogService } from '../services/auditLogService.ts';

export class AuthController {
  constructor(
    private readonly authService: AuthService = new AuthService(),
    private readonly auditLogService: AuditLogService = new AuditLogService(),
  ) {}

  register = async (req: Request, res: Response): Promise<Response> => {
    const data = await this.authService.register(req.body);
    return res.status(201).json({ status: 'success', data });
  };

  login = async (req: Request, res: Response): Promise<Response> => {
    const data = await this.authService.login(req.body);
    await this.recordAuthEvent(req, data.user.id, data.user.role, 'LOGIN');
    return res.status(200).json({ status: 'success', data });
  };

  logout = async (req: Request, res: Response): Promise<Response> => {
    const user = req.auth!;
    await this.recordAuthEvent(req, user.id, user.role, 'LOGOUT');
    return res.status(200).json({ status: 'success', data: { loggedOut: true } });
  };

  me = async (req: Request, res: Response): Promise<Response> => {
    const user = await this.authService.getCurrentUser(req.auth!.id);
    return res.status(200).json({ status: 'success', data: user });
  };

  private async recordAuthEvent(
    req: Request,
    userId: number,
    role: string,
    action: 'LOGIN' | 'LOGOUT',
  ): Promise<void> {
    try {
      await this.auditLogService.record({
        userId,
        action,
        targetTable: 'USERS',
        targetId: userId,
        metadata: JSON.stringify({
          role,
          ip_address: req.ip,
          user_agent: req.get('user-agent')?.slice(0, 1000) ?? null,
          result: 'success',
        }),
      });
    } catch {
      console.error(`Gagal menulis audit ${action}; autentikasi tetap dilanjutkan.`);
    }
  }
}