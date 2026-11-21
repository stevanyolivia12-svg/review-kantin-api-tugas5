import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';

type UserRole = 'admin' | 'owner' | 'customer';

interface AuditItem {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  action: string;
  targetTable: string;
  targetId: number;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
}

interface AuditListResponse {
  status: string;
  data: {
    items: AuditItem[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  };
}

const apiBaseUrl = process.env.TASK5_API_URL ?? 'http://localhost:3000';
const jwtSecret = process.env.JWT_SECRET;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;
const createOrderTestEnabled = process.env.TASK5_CREATE_ORDER_TEST === '1';

function createTestToken(role: UserRole, userId = 1): string {
  if (!jwtSecret) throw new Error('JWT_SECRET is required for API integration tests.');
  return jwt.sign(
    { email: `${role}@task5.invalid`, role },
    jwtSecret,
    { subject: String(userId), expiresIn: '5m' },
  );
}

async function request(path: string, token?: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('User-Agent', 'task5-api-test');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${apiBaseUrl}${path}`, { ...init, headers });
}

test('audit API enforces admin access and supports detail, filters, and validation', {
  skip: jwtSecret ? false : 'JWT_SECRET is not configured for API integration tests.',
}, async () => {
  const unauthenticated = await request('/api/audit-logs');
  assert.equal(unauthenticated.status, 401);

  for (const role of ['owner', 'customer'] as const) {
    const forbidden = await request('/api/audit-logs', createTestToken(role));
    assert.equal(forbidden.status, 403);
  }

  const adminToken = createTestToken('admin');
  const pageResponse = await request('/api/audit-logs?pageSize=100', adminToken);
  assert.equal(pageResponse.status, 200);
  const page = await pageResponse.json() as AuditListResponse;
  assert.equal(page.status, 'success');
  assert.equal(page.data.pagination.totalPages, Math.ceil(
    page.data.pagination.total / page.data.pagination.pageSize,
  ));

  if (page.data.items.length > 0) {
    const sample = page.data.items[0];
    assert.ok(sample.metadata === null || typeof sample.metadata === 'object');

    for (const [filter, expected] of [
      ['targetId', sample.targetId],
      ['userId', sample.userId],
    ] as const) {
      const filteredResponse = await request(
        `/api/audit-logs?${filter}=${expected}&pageSize=100`,
        adminToken,
      );
      assert.equal(filteredResponse.status, 200);
      const filtered = await filteredResponse.json() as AuditListResponse;
      assert.ok(filtered.data.items.length > 0);
      assert.ok(filtered.data.items.every((item) => item[filter] === expected));
    }

    const combinedFilterResponse = await request(
      `/api/audit-logs?targetId=${sample.targetId}&userId=${sample.userId}&pageSize=100`,
      adminToken,
    );
    assert.equal(combinedFilterResponse.status, 200);
    const combinedFilter = await combinedFilterResponse.json() as AuditListResponse;
    assert.ok(combinedFilter.data.items.length > 0);
    assert.ok(combinedFilter.data.items.every(
      (item) => item.targetId === sample.targetId && item.userId === sample.userId,
    ));

    const detailResponse = await request(`/api/audit-logs/${sample.id}`, adminToken);
    assert.equal(detailResponse.status, 200);
    const detail = await detailResponse.json() as { status: string; data: AuditItem };
    assert.equal(detail.data.id, sample.id);
    assert.equal(detail.data.userName, sample.userName);
    assert.equal(detail.data.userEmail, sample.userEmail);
    assert.ok(detail.data.metadata === null || typeof detail.data.metadata === 'object');
  }

  const invalidCases = [
    '?page=0',
    '?pageSize=101',
    '?targetId=abc',
    '?userId=-1',
    '?from=2026-02-30',
    '?from=2026-03-02&to=2026-03-01',
    '?unexpected=value',
  ];
  for (const query of invalidCases) {
    const invalid = await request(`/api/audit-logs${query}`, adminToken);
    assert.equal(invalid.status, 400);
    if (query === invalidCases[0]) {
      const error = await invalid.json() as {
        status?: string;
        message?: string;
        errors?: { field: string; message: string }[];
      };
      assert.equal(error.status, 'fail');
      assert.equal(error.message, 'Validasi gagal');
      assert.ok(Array.isArray(error.errors));
      assert.ok(error.errors.length > 0);
    }
  }

  assert.equal((await request('/api/audit-logs/not-an-id', adminToken)).status, 400);
  assert.equal((await request('/api/audit-logs/2147483647', adminToken)).status, 404);
});

test('order creation requires a customer and validates without persisting unavailable menus', {
  skip: jwtSecret ? false : 'JWT_SECRET is not configured for API integration tests.',
}, async () => {
  const body = JSON.stringify({
    phone: '08123456789',
    paymentMethod: 'cash',
    items: [{ menuId: 2147483647, quantity: 1 }],
  });
  const headers = { 'Content-Type': 'application/json' };

  assert.equal((await request('/api/v1/orders', undefined, {
    method: 'POST',
    headers,
    body,
  })).status, 401);
  assert.equal((await request('/api/v1/orders', createTestToken('owner'), {
    method: 'POST',
    headers,
    body,
  })).status, 403);
  assert.equal((await request('/api/v1/orders', createTestToken('admin'), {
    method: 'POST',
    headers,
    body,
  })).status, 403);

  const usersResponse = await request('/api/v1/users', createTestToken('admin'));
  assert.equal(usersResponse.status, 200);
  const users = await usersResponse.json() as { data: { id: number; role: UserRole }[] };
  const customer = users.data.find((user) => user.role === 'customer');
  assert.ok(customer);

  const menusResponse = await request('/api/v1/menu-items');
  assert.equal(menusResponse.status, 200);
  const menus = await menusResponse.json() as { data: { id: number }[] };
  const menuIds = new Set(menus.data.map((menu) => menu.id));
  let unavailableMenuId = 2147483647;
  while (menuIds.has(unavailableMenuId)) unavailableMenuId -= 1;

  const invalidOrder = await request(
    '/api/v1/orders',
    createTestToken('customer', customer.id),
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phone: '08123456789',
        paymentMethod: 'cash',
        items: [{ menuId: unavailableMenuId, quantity: 1 }],
      }),
    },
  );
  assert.equal(invalidOrder.status, 400);
});

test('CREATE_ORDER persists the order and its audit row when explicitly enabled', {
  skip: jwtSecret && createOrderTestEnabled
    ? false
    : 'Set TASK5_CREATE_ORDER_TEST=1 to create one persistent local test order.',
}, async () => {
  const adminToken = createTestToken('admin');
  const usersResponse = await request('/api/v1/users', adminToken);
  assert.equal(usersResponse.status, 200);
  const users = await usersResponse.json() as { data: { id: number; role: UserRole }[] };
  const customer = users.data.find((user) => user.role === 'customer');
  assert.ok(customer);

  const menusResponse = await request('/api/v1/menu-items');
  assert.equal(menusResponse.status, 200);
  const menus = await menusResponse.json() as {
    data: { id: number; isAvailable: boolean }[];
  };
  const menu = menus.data.find((item) => item.isAvailable);
  assert.ok(menu);

  const customerToken = createTestToken('customer', customer.id);
  const orderResponse = await request('/api/v1/orders', customerToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: '08123456789',
      paymentMethod: 'cash',
      note: 'T5 integration test order',
      items: [{ menuId: menu.id, quantity: 1 }],
    }),
  });
  assert.equal(orderResponse.status, 201);
  const order = await orderResponse.json() as {
    data: { id: number; customerId: number; items: { menuId: number }[] };
  };
  assert.equal(order.data.customerId, customer.id);
  assert.equal(order.data.items[0]?.menuId, menu.id);

  const auditResponse = await request(
    `/api/audit-logs?action=CREATE_ORDER&targetTable=ORDERS&targetId=${order.data.id}&userId=${customer.id}`,
    adminToken,
  );
  assert.equal(auditResponse.status, 200);
  const audit = await auditResponse.json() as AuditListResponse;
  assert.ok(audit.data.items.some(
    (item) => item.targetId === order.data.id && item.userId === customer.id,
  ));
});

test('login and logout audit records are persisted when test credentials are supplied', {
  skip: adminPassword ? false : 'Set TEST_ADMIN_PASSWORD to run real login/logout persistence checks.',
}, async () => {
  const email = process.env.TEST_ADMIN_EMAIL ?? 'admin@kantin.test';
  const loginResponse = await request('/api/v1/auth/login', undefined, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: adminPassword }),
  });
  assert.equal(loginResponse.status, 200);
  const login = await loginResponse.json() as {
    data: { accessToken: string; user: { id: number; role: UserRole } };
  };
  const token = login.data.accessToken;
  const userId = login.data.user.id;

  const loginLogsResponse = await request(
    `/api/audit-logs?action=LOGIN&targetId=${userId}&userId=${userId}&pageSize=100`,
    token,
  );
  assert.equal(loginLogsResponse.status, 200);
  const loginLogs = await loginLogsResponse.json() as AuditListResponse;
  const loginLog = loginLogs.data.items.find((item) => item.action === 'LOGIN');
  assert.ok(loginLog);
  assert.equal(loginLog.metadata?.role, login.data.user.role);
  assert.equal(loginLog.metadata?.result, 'success');
  assert.equal(typeof loginLog.metadata?.ip_address, 'string');
  assert.equal(typeof loginLog.metadata?.user_agent, 'string');

  const logoutResponse = await request('/api/v1/auth/logout', token, { method: 'POST' });
  assert.equal(logoutResponse.status, 200);

  const logoutLogsResponse = await request(
    `/api/audit-logs?action=LOGOUT&targetId=${userId}&userId=${userId}&pageSize=100`,
    token,
  );
  assert.equal(logoutLogsResponse.status, 200);
  const logoutLogs = await logoutLogsResponse.json() as AuditListResponse;
  const logoutLog = logoutLogs.data.items.find((item) => item.action === 'LOGOUT');
  assert.ok(logoutLog);
  assert.equal(logoutLog.metadata?.role, login.data.user.role);
  assert.equal(logoutLog.metadata?.result, 'success');
  assert.equal(typeof logoutLog.metadata?.ip_address, 'string');
  assert.equal(typeof logoutLog.metadata?.user_agent, 'string');
});
