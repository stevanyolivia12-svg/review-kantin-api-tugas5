import { and, eq, inArray } from 'drizzle-orm';
import type { DbExecutor } from '../db/executor.ts';
import { getDb } from '../db/index.ts';
import { menuItems, orderItems, orders, stalls } from '../db/schema.ts';
import type { CreateOrderInput } from '../validators/schemas.ts';

type PaymentMethod = CreateOrderInput['paymentMethod'];

export interface CreateOrderRecord {
  orderCode: string;
  customerId: number;
  customerName: string;
  phone: string;
  paymentMethod: PaymentMethod;
  note?: string | null;
  total: number;
}

export interface CreateOrderItemRecord {
  orderId: number;
  menuId: number;
  stallId: number;
  stallName: string;
  menuName: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export class OrderRepository {
  async findAvailableMenuItems(ids: number[], executor?: DbExecutor) {
    const db = executor ?? await getDb();
    return db
      .select({
        id: menuItems.id,
        name: menuItems.name,
        price: menuItems.price,
        stallId: stalls.id,
        stallName: stalls.name,
      })
      .from(menuItems)
      .innerJoin(stalls, eq(menuItems.stallId, stalls.id))
      .where(and(inArray(menuItems.id, ids), eq(menuItems.isAvailable, true)));
  }

  async createOrder(input: CreateOrderRecord, executor?: DbExecutor) {
    const db = executor ?? await getDb();
    const rows = await db.insert(orders).output().values({
      orderCode: input.orderCode,
      customerId: input.customerId,
      customerName: input.customerName,
      phone: input.phone,
      paymentMethod: input.paymentMethod,
      note: input.note ?? null,
      total: input.total,
      status: 'confirmed',
    });
    return rows[0];
  }

  async createItems(input: CreateOrderItemRecord[], executor?: DbExecutor) {
    const db = executor ?? await getDb();
    return db.insert(orderItems).output().values(input);
  }
}
