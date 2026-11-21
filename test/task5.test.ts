import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import type { Request, Response } from 'express';
import { hashSync } from 'bcryptjs';
import { AuthController } from '../backend/controllers/authController.ts';
import { AuditLogService } from '../backend/services/auditLogService.ts';
import type { CreateAuditLogInput } from '../backend/repositories/auditLogRepository.ts';
import { verifyPassword } from '../backend/repositories/userRepository.ts';
import { auditLogListQuerySchema } from '../backend/validators/schemas.ts';
import { AuthService } from '../backend/services/authService.ts';

test('password verification accepts stored bcrypt and scrypt hashes', () => {
  const password = 'Task5 test password';
  const bcryptHash = hashSync(password, 4);
  const legacyBcryptHash = bcryptHash.replace('$2b$', '$2a$');
  const salt = crypto.randomBytes(16).toString('hex');
  const scryptHash = crypto.scryptSync(password, salt, 64).toString('hex');

  assert.equal(verifyPassword(password, legacyBcryptHash), true);
  assert.equal(verifyPassword(password, bcryptHash), true);
  assert.equal(verifyPassword(password, `${salt}:${scryptHash}`), true);
  assert.equal(verifyPassword('wrong password', legacyBcryptHash), false);
  assert.equal(verifyPassword(password, 'invalid-hash'), false);
});

test('audit list query applies defaults and rejects invalid or unknown parameters', () => {
  assert.deepEqual(auditLogListQuerySchema.parse({}), { page: 1, pageSize: 20 });
  assert.equal(auditLogListQuerySchema.safeParse({ page: '0' }).success, false);
  assert.equal(auditLogListQuerySchema.safeParse({ pageSize: '101' }).success, false);
  assert.equal(auditLogListQuerySchema.safeParse({ targetId: 'abc' }).success, false);
  assert.equal(auditLogListQuerySchema.safeParse({ userId: '-1' }).success, false);
  assert.equal(auditLogListQuerySchema.safeParse({ from: '2026-02-30' }).success, false);
  assert.equal(
    auditLogListQuerySchema.safeParse({ from: '2026-03-02', to: '2026-03-01' }).success,
    false,
  );
  assert.equal(auditLogListQuerySchema.safeParse({ unknown: 'value' }).success, false);
  assert.equal(
    auditLogListQuerySchema.parse({ action: ' CREATE_MENU ' }).action,
    ' CREATE_MENU ',
  );
});

class FailingAuditLogService extends AuditLogService {
  readonly records: CreateAuditLogInput[] = [];

  override async record(input: CreateAuditLogInput): Promise<never> {
    this.records.push(input);
    throw new Error('simulated audit failure');
  }
}

class SuccessfulAuthService extends AuthService {
  override async login(_input: { email: string; password: string }) {
    return {
      accessToken: 'test-access-token',
      tokenType: 'Bearer' as const,
      expiresIn: 3600,
      user: { id: 17, email: 'admin@kantin.test', role: 'admin' as const },
    };
  }
}

function makeRequest(body: unknown, auth?: Request['auth']): Request {
  return {
    body,
    auth,
    ip: '203.0.113.17',
    get: (name: string) => name.toLowerCase() === 'user-agent' ? 'task5-test-agent' : undefined,
  } as unknown as Request;
}

function makeResponse() {
  const state: { statusCode: number; body: unknown } = {
    statusCode: 0,
    body: null,
  };
  const response = {
    status(code: number) {
      state.statusCode = code;
      return response;
    },
    json(body: unknown) {
      state.body = body;
      return response;
    },
  };
  return { state, response: response as unknown as Response };
}

test('login and logout stay successful when their best-effort audit write fails', async () => {
  const auditService = new FailingAuditLogService();
  const controller = new AuthController(new SuccessfulAuthService(), auditService);
  const originalConsoleError = console.error;
  const consoleErrors: unknown[][] = [];
  console.error = (...args: unknown[]) => { consoleErrors.push(args); };

  try {
    const loginResponse = makeResponse();
    await controller.login(
      makeRequest({ email: 'admin@kantin.test', password: 'not-logged' }),
      loginResponse.response,
    );
    assert.equal(loginResponse.state.statusCode, 200);

    const logoutResponse = makeResponse();
    await controller.logout(
      makeRequest(undefined, { id: 17, email: 'admin@kantin.test', role: 'admin' }),
      logoutResponse.response,
    );
    assert.equal(logoutResponse.state.statusCode, 200);
    assert.deepEqual(auditService.records.map((record) => record.action), ['LOGIN', 'LOGOUT']);

    for (const record of auditService.records) {
      assert.equal(record.userId, 17);
      assert.equal(record.targetId, 17);
      assert.equal(record.targetTable, 'USERS');
      assert.deepEqual(JSON.parse(record.metadata ?? '{}'), {
        role: 'admin',
        ip_address: '203.0.113.17',
        user_agent: 'task5-test-agent',
        result: 'success',
      });
    }
    assert.equal(JSON.stringify(consoleErrors).includes('simulated audit failure'), false);
  } finally {
    console.error = originalConsoleError;
  }
});
