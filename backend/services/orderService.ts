import { randomBytes } from 'node:crypto';
import { AppError } from '../errors/appError.ts';
import type { AuthenticatedUser } from '../middleware/auth.ts';
import { getDb } from '../db/index.ts';
import { AuditLogRepository } from '../repositories/auditLogRepository.ts';
import { OrderRepository } from '../repositories/orderRepository.ts';
import { UserRepository } from '../repositories/userRepository.ts';
import { auditMetadata } from './auditMetadata.ts';
import type { CreateOrderInput } from '../validators/schemas.ts';

const SQL_INT_MAX = 2147483647;

export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository = new OrderRepository(),
    private readonly userRepository: UserRepository = new UserRepository(),
    private readonly auditLogRepository: AuditLogRepository = new AuditLogRepository(),
  ) {}

  async createOrder(input: CreateOrderInput, actor: AuthenticatedUser) {
    if (actor.role !== 'customer') {
      throw new AppError(403, 'FORBIDDEN', 'Hanya customer yang dapat membuat pesanan.');
    }

    const db = await getDb();
    return db.transaction(async (tx) => {
      const customer = await this.userRepository.findProfileById(actor.id, tx);
      if (!customer) throw new AppError(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.');
      if (customer.role !== 'customer') {
        throw new AppError(403, 'FORBIDDEN', 'Hanya customer yang dapat membuat pesanan.');
      }
      if (customer.name.length > 80) {
        throw new AppError(400, 'ORDER_CUSTOMER_NAME_TOO_LONG', 'Nama customer melebihi batas untuk pesanan.');
      }

      const menus = await this.orderRepository.findAvailableMenuItems(
        input.items.map((item) => item.menuId),
        tx,
      );
      if (menus.length !== input.items.length) {
        throw new AppError(400, 'ORDER_MENU_UNAVAILABLE', 'Satu atau beberapa menu tidak tersedia.');
      }

      const menuById = new Map(menus.map((menu) => [menu.id, menu]));
      const lineItems = input.items.map((requested) => {
        const menu = menuById.get(requested.menuId);
        if (!menu) throw new AppError(400, 'ORDER_MENU_UNAVAILABLE', 'Satu atau beberapa menu tidak tersedia.');
        const subtotal = menu.price * requested.quantity;
        if (!Number.isSafeInteger(subtotal) || subtotal < 1 || subtotal > SQL_INT_MAX) {
          throw new AppError(400, 'ORDER_TOTAL_INVALID', 'Total pesanan melebihi batas yang didukung.');
        }
        return {
          menuId: menu.id,
          stallId: menu.stallId,
          stallName: menu.stallName,
          menuName: menu.name,
          unitPrice: menu.price,
          quantity: requested.quantity,
          subtotal,
        };
      });

      const total = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
      if (!Number.isSafeInteger(total) || total < 1 || total > SQL_INT_MAX) {
        throw new AppError(400, 'ORDER_TOTAL_INVALID', 'Total pesanan melebihi batas yang didukung.');
      }

      const timestamp = Date.now().toString(36).toUpperCase();
      const orderCode = `ORD-${timestamp}-${randomBytes(8).toString('hex').toUpperCase()}`;
      const order = await this.orderRepository.createOrder({
        orderCode,
        customerId: actor.id,
        customerName: customer.name,
        phone: input.phone,
        paymentMethod: input.paymentMethod,
        note: input.note,
        total,
      }, tx);
      if (!order) throw new Error('ORDER_CREATE_FAILED');

      const savedItems = await this.orderRepository.createItems(
        lineItems.map((item) => ({ ...item, orderId: order.id })),
        tx,
      );
      await this.auditLogRepository.create({
        userId: actor.id,
        action: 'CREATE_ORDER',
        targetTable: 'ORDERS',
        targetId: order.id,
        metadata: auditMetadata(actor.role, ['itemCount', 'total', 'paymentMethod']),
      }, tx);

      return { ...order, items: savedItems };
    });
  }
}
