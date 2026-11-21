import { Router } from 'express';
import { AuditLogController } from '../controllers/auditLogController.ts';
import { requireAuth, requireRoles } from '../middleware/auth.ts';
import { validateAuditLogIdParam, validateQuery } from '../middleware/validate.ts';
import { auditLogListQuerySchema } from '../validators/schemas.ts';

const auditLogRouter = Router();
const auditLogController = new AuditLogController();

auditLogRouter.get('/', requireAuth, requireRoles('admin'), validateQuery(auditLogListQuerySchema), (req, res) => {
	// #swagger.security = [{ "bearerAuth": [] }]
	// #swagger.parameters['page'] = { in: 'query', type: 'integer', description: 'Nomor halaman (default 1)' }
	// #swagger.parameters['pageSize'] = { in: 'query', type: 'integer', description: 'Ukuran halaman 1-100 (default 20)' }
	// #swagger.parameters['action'] = { in: 'query', type: 'string' }
	// #swagger.parameters['targetTable'] = { in: 'query', type: 'string' }
	// #swagger.parameters['targetId'] = { in: 'query', type: 'integer' }
	// #swagger.parameters['userId'] = { in: 'query', type: 'integer' }
	// #swagger.parameters['from'] = { in: 'query', type: 'string', format: 'date' }
	// #swagger.parameters['to'] = { in: 'query', type: 'string', format: 'date' }
	return auditLogController.getAuditLogs(req, res);
});
auditLogRouter.get('/:id', requireAuth, requireRoles('admin'), validateAuditLogIdParam, (req, res) => {
	// #swagger.security = [{ "bearerAuth": [] }]
	// #swagger.parameters['id'] = { in: 'path', required: true, type: 'integer' }
	// #swagger.responses[404] = { description: 'Audit log tidak ditemukan' }
	return auditLogController.getAuditLogById(req, res);
});

export { auditLogRouter };