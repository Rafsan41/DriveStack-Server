import type { Knex } from 'knex';
import { BaseRepository } from '../../core/BaseRepository';
import {
  BLOCKING_RENTAL_STATUSES,
  type ConflictingRental,
  type ListRentalsQuery,
  type OverlapCheckParams,
  type RentalInsert,
  type RentalRow,
  type RentalUpdate,
  type RentalWithVehicleRow,
} from './rental.types';

interface RentalListRow extends RentalWithVehicleRow {
  total_count: number;
}

export interface RentalListResult {
  rows: RentalWithVehicleRow[];
  total: number;
}

const VEHICLE_JOIN_COLUMNS = `
          v.name         AS vehicle_name,
          v.plate_number AS vehicle_plate_number,
          v.category     AS vehicle_category,
          v.daily_rate   AS vehicle_daily_rate`;

export class RentalRepository extends BaseRepository<RentalRow> {
  constructor(knex?: Knex) {
    super('rentals', knex);
  }

  /**
   * THE OVERLAP QUERY.
   *
   * Two closed date ranges [s1,e1] and [s2,e2] intersect if and only if
   *
   *     s1 <= e2  AND  e1 >= s2
   *
   * which is what the last two predicates say: an existing rental conflicts when
   * it starts on or before our end date AND ends on or after our start date.
   * That single pair of comparisons covers every arrangement — the candidate
   * sitting inside an existing rental, straddling either edge, or swallowing it
   * whole. It is easiest to convince yourself via the complement: two ranges are
   * disjoint exactly when one ends strictly before the other begins, i.e.
   * e1 < s2 OR e2 < s1; negate that and you get s1 <= e2 AND e1 >= s2.
   *
   * The comparisons are inclusive (<=, >=) because a rental occupies both of its
   * endpoint days, so a booking ending Sep 12 conflicts with one starting Sep 12.
   *
   * `status = ANY(...)` binds BLOCKING_RENTAL_STATUSES rather than hard-coding
   * `<> 'cancelled'`, so the rule has exactly one definition (rental.types.ts).
   *
   * Callers must run this inside the transaction that already holds the lock on
   * the vehicle row — see RentalService.
   */
  public async findOverlapping(
    params: OverlapCheckParams,
    trx: Knex.Transaction,
  ): Promise<ConflictingRental | undefined> {
    const excludeId = params.excludeRentalId ?? null;

    const result = await this.connection(trx).raw<{ rows: ConflictingRental[] }>(
      `
      SELECT
          r.id,
          r.start_date,
          r.end_date,
          r.status,
          r.customer_name
      FROM rentals r
      WHERE r.vehicle_id = ?
        AND r.status = ANY(?::text[])
        AND (?::int IS NULL OR r.id <> ?::int)
        AND r.start_date <= ?::date
        AND r.end_date   >= ?::date
      ORDER BY r.start_date
      LIMIT 1
      `,
      [
        params.vehicleId,
        BLOCKING_RENTAL_STATUSES as unknown as string[],
        excludeId,
        excludeId,
        params.endDate,
        params.startDate,
      ],
    );

    return result.rows[0];
  }

  /**
   * Paginated listing. The date filter uses the same intersection predicate as
   * the overlap check: `?start_date=&end_date=` returns rentals that *overlap*
   * the window, not only those fully contained by it. Either bound may be
   * omitted.
   */
  public async list(query: ListRentalsQuery, trx?: Knex.Transaction): Promise<RentalListResult> {
    const offset = (query.page - 1) * query.limit;
    const vehicleId = query.vehicle_id ?? null;
    const status = query.status ?? null;
    const from = query.start_date ?? null;
    const to = query.end_date ?? null;
    const search = query.search?.trim() ? query.search.trim() : null;

    const result = await this.connection(trx).raw<{ rows: RentalListRow[] }>(
      `
      SELECT
          r.id,
          r.vehicle_id,
          r.customer_name,
          r.customer_phone,
          r.start_date,
          r.end_date,
          r.total_amount,
          r.status,
          r.created_at,
          r.updated_at,
${VEHICLE_JOIN_COLUMNS},
          COUNT(*) OVER () AS total_count
      FROM rentals r
      JOIN vehicles v ON v.id = r.vehicle_id
      WHERE (?::int  IS NULL OR r.vehicle_id = ?::int)
        AND (?::text IS NULL OR r.status = ?::text)
        AND (?::date IS NULL OR r.end_date   >= ?::date)
        AND (?::date IS NULL OR r.start_date <= ?::date)
        AND (
              ?::text IS NULL
              OR r.customer_name  ILIKE '%' || ?::text || '%'
              OR r.customer_phone ILIKE '%' || ?::text || '%'
            )
      ORDER BY r.start_date DESC, r.id DESC
      LIMIT ? OFFSET ?
      `,
      [
        vehicleId,
        vehicleId,
        status,
        status,
        from,
        from,
        to,
        to,
        search,
        search,
        search,
        query.limit,
        offset,
      ],
    );

    const rows = result.rows;
    const first = rows[0];
    return { rows, total: first ? Number(first.total_count) : 0 };
  }

  public async findById(
    id: number,
    trx?: Knex.Transaction,
  ): Promise<RentalWithVehicleRow | undefined> {
    const result = await this.connection(trx).raw<{ rows: RentalWithVehicleRow[] }>(
      `
      SELECT
          r.id,
          r.vehicle_id,
          r.customer_name,
          r.customer_phone,
          r.start_date,
          r.end_date,
          r.total_amount,
          r.status,
          r.created_at,
          r.updated_at,
${VEHICLE_JOIN_COLUMNS}
      FROM rentals r
      JOIN vehicles v ON v.id = r.vehicle_id
      WHERE r.id = ?
      `,
      [id],
    );

    return result.rows[0];
  }

  /** Locks the rental row itself, so two concurrent updates cannot interleave. */
  public async findByIdForUpdate(
    id: number,
    trx: Knex.Transaction,
  ): Promise<RentalRow | undefined> {
    return this.table(trx).where({ id }).forUpdate().first();
  }

  public async create(data: RentalInsert, trx?: Knex.Transaction): Promise<RentalRow> {
    const [row] = await this.table(trx).insert(data).returning('*');
    return row as RentalRow;
  }

  public async update(
    id: number,
    data: RentalUpdate,
    trx?: Knex.Transaction,
  ): Promise<RentalRow | undefined> {
    const [row] = await this.table(trx).where({ id }).update(data).returning('*');
    return row as RentalRow | undefined;
  }

  public async delete(id: number, trx?: Knex.Transaction): Promise<number> {
    return this.table(trx).where({ id }).del();
  }
}
