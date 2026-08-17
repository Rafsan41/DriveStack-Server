import type { Knex } from 'knex';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/ApiError';
import { inclusiveDayCount, roundCurrency } from '../../core/dates';
import { buildPaginationMeta, type PaginatedData } from '../../core/http';
import { db } from '../../database/connection';
import type { VehicleRepository } from '../vehicles/vehicle.repository';
import type { VehicleRow } from '../vehicles/vehicle.types';
import type { RentalRepository } from './rental.repository';
import {
  isBlockingStatus,
  type CreateRentalBody,
  type ListRentalsQuery,
  type OverlapCheckParams,
  type RentalDto,
  type RentalRow,
  type RentalStatus,
  type RentalUpdate,
  type RentalWithVehicleRow,
  type UpdateRentalBody,
} from './rental.types';

export class RentalService {
  constructor(
    private readonly rentalRepository: RentalRepository,
    private readonly vehicleRepository: VehicleRepository,
    private readonly knex: Knex = db,
  ) {}

  public async list(query: ListRentalsQuery): Promise<PaginatedData<RentalDto>> {
    const { rows, total } = await this.rentalRepository.list(query);
    return {
      items: rows.map((row) => RentalService.joinedRowToDto(row)),
      pagination: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  public async getById(id: number): Promise<RentalDto> {
    const row = await this.rentalRepository.findById(id);
    if (!row) throw new NotFoundError(`Rental ${id} was not found.`);
    return RentalService.joinedRowToDto(row);
  }

  /**
   * Create a rental, refusing to double-book the vehicle.
   *
   * Everything happens in one transaction, in this order:
   *
   *   1. SELECT ... FOR UPDATE on the *vehicle* row.
   *   2. Probe for an overlapping rental.
   *   3. INSERT.
   *
   * Step 1 is what makes step 2 trustworthy. Locking the rental rows would lock
   * nothing at all when the probe returns no rows — there is no row to lock —
   * so two simultaneous requests would both see "free" and both insert. The
   * vehicle row always exists, so it gives the two transactions something
   * concrete to serialise on: the second one blocks until the first commits,
   * then re-reads and sees the rental that was just written. (Spec bonus:
   * "two people booking the same vehicle at the same moment can't both succeed".)
   */
  public async create(input: CreateRentalBody): Promise<RentalDto> {
    return this.knex.transaction(async (trx) => {
      const vehicle = await this.lockVehicle(input.vehicle_id, trx);
      const status: RentalStatus = input.status ?? 'booked';

      if (isBlockingStatus(status)) {
        await this.assertNoOverlap(
          {
            vehicleId: vehicle.id,
            startDate: input.start_date,
            endDate: input.end_date,
          },
          trx,
        );
      }

      const row = await this.rentalRepository.create(
        {
          vehicle_id: vehicle.id,
          customer_name: input.customer_name,
          customer_phone: input.customer_phone,
          start_date: input.start_date,
          end_date: input.end_date,
          total_amount: RentalService.calculateTotal(
            vehicle.daily_rate,
            input.start_date,
            input.end_date,
          ),
          status,
        },
        trx,
      );

      return RentalService.rowToDto(row, vehicle);
    });
  }

  /**
   * Update a rental. Any change to the vehicle or to either date re-runs the
   * overlap check — excluding this rental, so it never conflicts with itself.
   * Reviving a cancelled rental re-checks too, because its dates are becoming
   * occupied again.
   */
  public async update(id: number, input: UpdateRentalBody): Promise<RentalDto> {
    return this.knex.transaction(async (trx) => {
      const existing = await this.rentalRepository.findByIdForUpdate(id, trx);
      if (!existing) throw new NotFoundError(`Rental ${id} was not found.`);

      const vehicleId = input.vehicle_id ?? existing.vehicle_id;
      const startDate = input.start_date ?? existing.start_date;
      const endDate = input.end_date ?? existing.end_date;
      const status = input.status ?? existing.status;

      // Only one of the two dates may have been supplied, so the resulting pair
      // has to be re-checked here even though the schema validates a supplied pair.
      if (endDate < startDate) {
        throw new BadRequestError('end_date must be on or after start_date.');
      }

      const vehicle = await this.lockVehicle(vehicleId, trx);

      const scheduleChanged =
        vehicleId !== existing.vehicle_id ||
        startDate !== existing.start_date ||
        endDate !== existing.end_date;
      const becomingBlocking = isBlockingStatus(status) && !isBlockingStatus(existing.status);

      if (isBlockingStatus(status) && (scheduleChanged || becomingBlocking)) {
        await this.assertNoOverlap({ vehicleId, startDate, endDate, excludeRentalId: id }, trx);
      }

      const changes: RentalUpdate = {};
      if (input.vehicle_id !== undefined) changes.vehicle_id = input.vehicle_id;
      if (input.customer_name !== undefined) changes.customer_name = input.customer_name;
      if (input.customer_phone !== undefined) changes.customer_phone = input.customer_phone;
      if (input.start_date !== undefined) changes.start_date = input.start_date;
      if (input.end_date !== undefined) changes.end_date = input.end_date;
      if (input.status !== undefined) changes.status = input.status;

      // The price follows the schedule: if the dates or the vehicle moved, the
      // amount is recomputed server-side from the vehicle's current daily rate.
      if (scheduleChanged) {
        changes.total_amount = RentalService.calculateTotal(vehicle.daily_rate, startDate, endDate);
      }

      const updated = await this.rentalRepository.update(id, changes, trx);
      if (!updated) throw new NotFoundError(`Rental ${id} was not found.`);

      return RentalService.rowToDto(updated, vehicle);
    });
  }

  public async delete(id: number): Promise<{ id: number }> {
    const deleted = await this.rentalRepository.delete(id);
    if (deleted === 0) throw new NotFoundError(`Rental ${id} was not found.`);
    return { id };
  }

  /** Loads and row-locks the vehicle, rejecting missing or soft-deleted ones. */
  private async lockVehicle(vehicleId: number, trx: Knex.Transaction): Promise<VehicleRow> {
    const vehicle = await this.vehicleRepository.findByIdForUpdate(vehicleId, trx);
    if (!vehicle) {
      throw new NotFoundError(`Vehicle ${vehicleId} was not found or has been deleted.`);
    }
    return vehicle;
  }

  /** Throws 409 with the conflicting rental attached, so the client can explain it. */
  private async assertNoOverlap(params: OverlapCheckParams, trx: Knex.Transaction): Promise<void> {
    const conflict = await this.rentalRepository.findOverlapping(params, trx);
    if (!conflict) return;

    throw new ConflictError(
      `Vehicle ${params.vehicleId} already has a ${conflict.status} rental from ` +
        `${conflict.start_date} to ${conflict.end_date}, which overlaps ` +
        `${params.startDate} to ${params.endDate}.`,
      {
        conflicting_rental: {
          id: conflict.id,
          start_date: conflict.start_date,
          end_date: conflict.end_date,
          status: conflict.status,
          customer_name: conflict.customer_name,
        },
        requested: {
          vehicle_id: params.vehicleId,
          start_date: params.startDate,
          end_date: params.endDate,
        },
      },
    );
  }

  /** Spec §4: daily_rate x number of days, same start/end counting as 1 day. */
  private static calculateTotal(dailyRate: number, startDate: string, endDate: string): number {
    return roundCurrency(Number(dailyRate) * inclusiveDayCount(startDate, endDate));
  }

  private static rowToDto(row: RentalRow, vehicle: VehicleRow): RentalDto {
    return {
      id: row.id,
      vehicle_id: row.vehicle_id,
      customer_name: row.customer_name,
      customer_phone: row.customer_phone,
      start_date: row.start_date,
      end_date: row.end_date,
      days: inclusiveDayCount(row.start_date, row.end_date),
      total_amount: Number(row.total_amount),
      status: row.status,
      vehicle: {
        id: vehicle.id,
        name: vehicle.name,
        plate_number: vehicle.plate_number,
        category: vehicle.category,
        daily_rate: Number(vehicle.daily_rate),
      },
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private static joinedRowToDto(row: RentalWithVehicleRow): RentalDto {
    return {
      id: row.id,
      vehicle_id: row.vehicle_id,
      customer_name: row.customer_name,
      customer_phone: row.customer_phone,
      start_date: row.start_date,
      end_date: row.end_date,
      days: inclusiveDayCount(row.start_date, row.end_date),
      total_amount: Number(row.total_amount),
      status: row.status,
      vehicle: {
        id: row.vehicle_id,
        name: row.vehicle_name,
        plate_number: row.vehicle_plate_number,
        category: row.vehicle_category,
        daily_rate: Number(row.vehicle_daily_rate),
      },
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
