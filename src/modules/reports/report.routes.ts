import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { ReportController } from './report.controller';
import { ReportRepository } from './report.repository';
import { ReportService } from './report.service';
import { rentalsReportSchema } from './report.validation';

const controller = new ReportController(new ReportService(new ReportRepository()));

export const reportRouter: Router = Router();

reportRouter.use(authenticate);

// GET /reports/rentals?month=YYYY-MM[&vehicle_id=]
reportRouter.get('/rentals', validate({ query: rentalsReportSchema }), controller.rentalsByMonth);
