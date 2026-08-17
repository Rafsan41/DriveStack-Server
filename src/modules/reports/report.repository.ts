import type { Knex } from 'knex';
import { BaseRepository } from '../../core/BaseRepository';
import { BLOCKING_RENTAL_STATUSES } from '../rentals/rental.types';
import type { VehicleMonthlyReportRow } from './report.types';

interface MonthlyReportQueryRow extends VehicleMonthlyReportRow {
  month_start: string;
  month_end: string;
}

export interface MonthlyReportQueryResult {
  rows: VehicleMonthlyReportRow[];
  monthStart: string;
  monthEnd: string;
}

/** Row shape is produced entirely by the report query, so there is no table type. */
export class ReportRepository extends BaseRepository<Record<string, never>> {
  constructor(knex?: Knex) {
    super('rentals', knex);
  }

  /**
   * THE MONTHLY REPORT QUERY.
   *
   * The rule from spec §4: "a rental running July 29 – Aug 3 contributes 3 days
   * to the August report, not 6". So each rental is clipped to the requested
   * month before it is counted:
   *
   *   days_in_month = LEAST(end_date, month_end) - GREATEST(start_date, month_start) + 1
   *
   * GREATEST/LEAST intersect the rental's range with the month's range; the +1
   * makes the count inclusive of both endpoints, exactly like total_amount's day
   * count. For Jul 29 -> Aug 3 against August that is
   * LEAST('2025-08-03','2025-08-31') - GREATEST('2025-07-29','2025-08-01') + 1
   * = Aug 3 - Aug 1 + 1 = 3.
   *
   * The `overlapping` CTE filters with the same intersection predicate as the
   * booking overlap check (start <= month_end AND end >= month_start), so a
   * rental is considered by this month exactly when it actually touches it.
   *
   * Revenue is PRORATED FROM total_amount rather than recomputed as
   * daily_rate * days_in_month. total_amount is the price that was actually
   * agreed when the rental was created; if a vehicle's daily_rate is edited
   * later, recomputing would silently rewrite history. Prorating also
   * guarantees a rental's monthly slices sum back to exactly what the customer
   * was charged (13500 + 13500 = 27000 for the seeded July/August rental).
   *
   * LEFT JOIN from vehicles so idle vehicles still appear, with zeros — the
   * report doubles as a fleet-utilisation view, and ?vehicle_id= always returns
   * a row. Cancelled rentals are excluded via BLOCKING_RENTAL_STATUSES.
   */
  public async getMonthlyReport(
    year: number,
    month: number,
    vehicleId?: number,
    trx?: Knex.Transaction,
  ): Promise<MonthlyReportQueryResult> {
    const filterVehicleId = vehicleId ?? null;

    const result = await this.connection(trx).raw<{ rows: MonthlyReportQueryRow[] }>(
      `
      WITH bounds AS (
          SELECT
              make_date(?::int, ?::int, 1)                                  AS month_start,
              (make_date(?::int, ?::int, 1) + INTERVAL '1 month')::date - 1  AS month_end
      ),
      overlapping AS (
          SELECT
              r.id,
              r.vehicle_id,
              r.total_amount,
              (r.end_date - r.start_date) + 1                               AS total_days,
              (LEAST(r.end_date, b.month_end)
                 - GREATEST(r.start_date, b.month_start)) + 1               AS days_in_month
          FROM rentals r
          CROSS JOIN bounds b
          WHERE r.status = ANY(?::text[])
            AND r.start_date <= b.month_end
            AND r.end_date   >= b.month_start
      )
      SELECT
          v.id,
          v.name,
          v.plate_number,
          v.category,
          COUNT(o.id)::int                                                  AS total_bookings,
          COALESCE(SUM(o.days_in_month), 0)::int                            AS days_rented,
          COALESCE(
              SUM(ROUND(o.total_amount * o.days_in_month / o.total_days, 2)),
              0
          )::numeric(14,2)                                                  AS revenue,
          (SELECT month_start FROM bounds)                                  AS month_start,
          (SELECT month_end   FROM bounds)                                  AS month_end
      FROM vehicles v
      LEFT JOIN overlapping o ON o.vehicle_id = v.id
      WHERE v.deleted_at IS NULL
        AND (?::int IS NULL OR v.id = ?::int)
      GROUP BY v.id, v.name, v.plate_number, v.category
      ORDER BY revenue DESC, v.id ASC
      `,
      [
        year,
        month,
        year,
        month,
        BLOCKING_RENTAL_STATUSES as unknown as string[],
        filterVehicleId,
        filterVehicleId,
      ],
    );

    const rows = result.rows;
    const first = rows[0];

    return {
      rows: rows.map((row) => ({
        id: row.id,
        name: row.name,
        plate_number: row.plate_number,
        category: row.category,
        total_bookings: Number(row.total_bookings),
        days_rented: Number(row.days_rented),
        revenue: Number(row.revenue),
      })),
      monthStart: first?.month_start ?? ReportRepository.firstOfMonth(year, month),
      monthEnd: first?.month_end ?? ReportRepository.lastOfMonth(year, month),
    };
  }

  /** Fallbacks for the edge case of a fleet with no live vehicles at all. */
  private static firstOfMonth(year: number, month: number): string {
    return `${year}-${String(month).padStart(2, '0')}-01`;
  }

  private static lastOfMonth(year: number, month: number): string {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }
}
