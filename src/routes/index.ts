import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
import { rentalRouter } from '../modules/rentals/rental.routes';
import { reportRouter } from '../modules/reports/report.routes';
import { vehicleRouter } from '../modules/vehicles/vehicle.routes';

export const apiRouter: Router = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/vehicles', vehicleRouter);
apiRouter.use('/rentals', rentalRouter);
apiRouter.use('/reports', reportRouter);
