import { Router } from 'express';
import { FlagController } from '../controllers/flagController.ts';
import { requireAuth, requireRoles } from '../middleware/auth.ts';
import { validateBody, validateIdParam, validateQuery } from '../middleware/validate.ts';
import { createFlagSchema, flagListQuerySchema, updateFlagSchema } from '../validators/schemas.ts';

const flagRouter = Router();
const flagController = new FlagController();

flagRouter.post('/', requireAuth, requireRoles('customer'), validateBody(createFlagSchema), (req, res) => {
	// #swagger.security = [{ "bearerAuth": [] }]
	// #swagger.parameters['body'] = { in: 'body', required: true, schema: { reviewId: 1, reason: 'Alasan laporan' } }
	// #swagger.responses[201] = { description: 'Laporan dibuat' }
	return flagController.createFlag(req, res);
});
flagRouter.get('/', requireAuth, requireRoles('admin'), validateQuery(flagListQuerySchema), (req, res) => {
	// #swagger.security = [{ "bearerAuth": [] }]
	return flagController.getFlags(req, res);
});
flagRouter.put('/:id', requireAuth, requireRoles('admin'), validateIdParam, validateBody(updateFlagSchema), (req, res) => {
	// #swagger.security = [{ "bearerAuth": [] }]
	return flagController.updateFlagStatus(req, res);
});

export { flagRouter };