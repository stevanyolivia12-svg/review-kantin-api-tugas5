import { Router } from 'express';
import { OrderController } from '../controllers/orderController.ts';
import { requireAuth, requireRoles } from '../middleware/auth.ts';
import { validateBody } from '../middleware/validate.ts';
import { createOrderSchema } from '../validators/schemas.ts';

const orderRouter = Router();
const orderController = new OrderController();

orderRouter.post(
  '/',
  requireAuth,
  requireRoles('customer'),
  validateBody(createOrderSchema),
  (req, res) => {
    // #swagger.security = [{ "bearerAuth": [] }]
    // #swagger.parameters['body'] = { in: 'body', required: true, schema: { phone: '08123456789', paymentMethod: 'cash', items: [{ menuId: 1, quantity: 1 }] } }
    // #swagger.responses[201] = { description: 'Pesanan dibuat dan diaudit dalam transaksi yang sama' }
    return orderController.createOrder(req, res);
  },
);

export { orderRouter };
