import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { VehicleRepository } from '../vehicles/vehicle.repository';
import { RentalController } from './rental.controller';
import { RentalRepository } from './rental.repository';
import { RentalService } from './rental.service';
import {
  createRentalSchema,
  listRentalsSchema,
  rentalIdParamSchema,
  updateRentalSchema,
} from './rental.validation';

const controller = new RentalController(
  new RentalService(new RentalRepository(), new VehicleRepository()),
);

export const rentalRouter: Router = Router();

rentalRouter.use(authenticate);

rentalRouter.get('/', validate({ query: listRentalsSchema }), controller.list);

rentalRouter.get('/:id', validate({ params: rentalIdParamSchema }), controller.getById);

rentalRouter.post('/', validate({ body: createRentalSchema }), controller.create);

rentalRouter.put(
  '/:id',
  validate({ params: rentalIdParamSchema, body: updateRentalSchema }),
  controller.update,
);

rentalRouter.delete('/:id', validate({ params: rentalIdParamSchema }), controller.remove);
