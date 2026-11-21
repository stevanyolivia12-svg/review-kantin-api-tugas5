import type { Request, Response } from 'express';
import { OrderService } from '../services/orderService.ts';
import { respondWithError } from '../middleware/errorHandler.ts';

export class OrderController {
  constructor(private readonly orderService: OrderService = new OrderService()) {}

  createOrder = async (req: Request, res: Response): Promise<Response> => {
    try {
      const data = await this.orderService.createOrder(req.body, req.auth!);
      return res.status(201).json({ status: 'success', data });
    } catch (error) {
      return respondWithError(res, error);
    }
  };
}
