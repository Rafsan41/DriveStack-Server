import type { ParamsDictionary } from 'express-serve-static-core';
import { asyncHandler } from '../../core/asyncHandler';
import { sendSuccess } from '../../core/http';
import type { VehicleService } from './vehicle.service';
import type { CreateVehicleBody, ListVehiclesQuery, UpdateVehicleBody } from './vehicle.types';

/** `validate` coerces `:id` to a number before the handler runs. */
interface VehicleIdParams {
  id: number;
}

/**
 * Handler properties are intentionally left un-annotated — see AuthController
 * for why annotating them as `RequestHandler` would throw the types away.
 */
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  public readonly list = asyncHandler<ParamsDictionary, unknown, unknown, ListVehiclesQuery>(
    async (req, res) => {
      const result = await this.vehicleService.list(req.query);
      sendSuccess(res, 200, 'Vehicles retrieved successfully.', result);
    },
  );

  public readonly getById = asyncHandler<VehicleIdParams>(async (req, res) => {
    const vehicle = await this.vehicleService.getById(req.params.id);
    sendSuccess(res, 200, 'Vehicle retrieved successfully.', vehicle);
  });

  public readonly create = asyncHandler<ParamsDictionary, unknown, CreateVehicleBody>(
    async (req, res) => {
      const vehicle = await this.vehicleService.create(req.body, req.file);
      sendSuccess(res, 201, 'Vehicle created successfully.', vehicle);
    },
  );

  public readonly update = asyncHandler<VehicleIdParams, unknown, UpdateVehicleBody>(
    async (req, res) => {
      const vehicle = await this.vehicleService.update(req.params.id, req.body, req.file);
      sendSuccess(res, 200, 'Vehicle updated successfully.', vehicle);
    },
  );

  public readonly remove = asyncHandler<VehicleIdParams>(async (req, res) => {
    const result = await this.vehicleService.softDelete(req.params.id);
    sendSuccess(res, 200, 'Vehicle deleted successfully.', result);
  });
}
