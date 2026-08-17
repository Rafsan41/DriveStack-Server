import type { ParamsDictionary } from 'express-serve-static-core';
import { asyncHandler } from '../../core/asyncHandler';
import { sendSuccess } from '../../core/http';
import type { RentalService } from './rental.service';
import type { CreateRentalBody, ListRentalsQuery, UpdateRentalBody } from './rental.types';

/** `validate` coerces `:id` to a number before the handler runs. */
interface RentalIdParams {
  id: number;
}

export class RentalController {
  constructor(private readonly rentalService: RentalService) {}

  public readonly list = asyncHandler<ParamsDictionary, unknown, unknown, ListRentalsQuery>(
    async (req, res) => {
      const result = await this.rentalService.list(req.query);
      sendSuccess(res, 200, 'Rentals retrieved successfully.', result);
    },
  );

  public readonly getById = asyncHandler<RentalIdParams>(async (req, res) => {
    const rental = await this.rentalService.getById(req.params.id);
    sendSuccess(res, 200, 'Rental retrieved successfully.', rental);
  });

  public readonly create = asyncHandler<ParamsDictionary, unknown, CreateRentalBody>(
    async (req, res) => {
      const rental = await this.rentalService.create(req.body);
      sendSuccess(res, 201, 'Rental created successfully.', rental);
    },
  );

  public readonly update = asyncHandler<RentalIdParams, unknown, UpdateRentalBody>(
    async (req, res) => {
      const rental = await this.rentalService.update(req.params.id, req.body);
      sendSuccess(res, 200, 'Rental updated successfully.', rental);
    },
  );

  public readonly remove = asyncHandler<RentalIdParams>(async (req, res) => {
    const result = await this.rentalService.delete(req.params.id);
    sendSuccess(res, 200, 'Rental deleted successfully.', result);
  });
}
