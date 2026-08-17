import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { uploadVehiclePhoto } from '../../middlewares/upload.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { VehicleController } from './vehicle.controller';
import { VehicleRepository } from './vehicle.repository';
import { VehicleService } from './vehicle.service';
import {
  createVehicleSchema,
  listVehiclesSchema,
  updateVehicleSchema,
  vehicleIdParamSchema,
} from './vehicle.validation';

const controller = new VehicleController(new VehicleService(new VehicleRepository()));

export const vehicleRouter: Router = Router();

// Spec §3: JWT protects every /vehicles route.
vehicleRouter.use(authenticate);

vehicleRouter.get('/', validate({ query: listVehiclesSchema }), controller.list);

vehicleRouter.get('/:id', validate({ params: vehicleIdParamSchema }), controller.getById);

// Multer runs first: until it has parsed the multipart stream, `req.body` is empty.
vehicleRouter.post(
  '/',
  uploadVehiclePhoto(),
  validate({ body: createVehicleSchema }),
  controller.create,
);

vehicleRouter.put(
  '/:id',
  uploadVehiclePhoto(),
  validate({ params: vehicleIdParamSchema, body: updateVehicleSchema }),
  controller.update,
);

vehicleRouter.delete('/:id', validate({ params: vehicleIdParamSchema }), controller.remove);
