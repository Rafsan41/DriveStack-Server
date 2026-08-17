export const RENTAL_STATUSES = ['booked', 'ongoing', 'completed', 'cancelled'] as const;

export type RentalStatus = (typeof RENTAL_STATUSES)[number];

/**
 * Statuses that make a rental occupy its vehicle.
 *
 * The spec says two rentals conflict only when "both are active" without
 * defining active, so this is the deliberate reading: everything except
 * `cancelled` blocks. A `completed` rental means the vehicle was physically out
 * on those dates, so a new booking must not be able to overlap it after the
 * fact. Cancelling is the one action that gives the dates back.
 *
 * Single source of truth — the overlap SQL and the report SQL both bind this
 * array rather than hard-coding the statuses.
 */
export const BLOCKING_RENTAL_STATUSES: readonly RentalStatus[] = ['booked', 'ongoing', 'completed'];

export function isBlockingStatus(status: RentalStatus): boolean {
  return BLOCKING_RENTAL_STATUSES.includes(status);
}

/**
 * Row exactly as it exists in the `rentals` table.
 * `start_date` / `end_date` are `YYYY-MM-DD` strings, not Dates — see
 * database/connection.ts.
 */
export interface RentalRow {
  id: number;
  vehicle_id: number;
  customer_name: string;
  customer_phone: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  status: RentalStatus;
  created_at: Date;
  updated_at: Date;
}

/** Rental row plus the joined vehicle columns. */
export interface RentalWithVehicleRow extends RentalRow {
  vehicle_name: string;
  vehicle_plate_number: string;
  vehicle_category: string;
  vehicle_daily_rate: number;
}

export interface RentalVehicleSummary {
  id: number;
  name: string;
  plate_number: string;
  category: string;
  daily_rate: number;
}

export interface RentalDto {
  id: number;
  vehicle_id: number;
  customer_name: string;
  customer_phone: string;
  start_date: string;
  end_date: string;
  /** Inclusive day count — the multiplier used for total_amount. */
  days: number;
  total_amount: number;
  status: RentalStatus;
  vehicle: RentalVehicleSummary | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateRentalBody {
  vehicle_id: number;
  customer_name: string;
  customer_phone: string;
  start_date: string;
  end_date: string;
  status?: RentalStatus;
}

export interface UpdateRentalBody {
  vehicle_id?: number;
  customer_name?: string;
  customer_phone?: string;
  start_date?: string;
  end_date?: string;
  status?: RentalStatus;
}

export interface ListRentalsQuery {
  page: number;
  limit: number;
  vehicle_id?: number;
  status?: RentalStatus;
  /** Range filter: returns rentals that *overlap* [start_date, end_date]. */
  start_date?: string;
  end_date?: string;
  /** Matches customer name or phone. */
  search?: string;
}

export interface RentalInsert {
  vehicle_id: number;
  customer_name: string;
  customer_phone: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  status: RentalStatus;
}

export type RentalUpdate = Partial<RentalInsert>;

/** Minimal projection returned by the overlap probe, used to build the 409 body. */
export interface ConflictingRental {
  id: number;
  start_date: string;
  end_date: string;
  status: RentalStatus;
  customer_name: string;
}

export interface OverlapCheckParams {
  vehicleId: number;
  startDate: string;
  endDate: string;
  /** Set on update so a rental never conflicts with itself. */
  excludeRentalId?: number;
}
