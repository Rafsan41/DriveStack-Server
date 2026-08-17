import { inclusiveDayCount, roundCurrency } from '../../core/dates';
import type { ReportRepository } from './report.repository';
import type {
  MonthlyRentalReport,
  RentalsReportQuery,
  VehicleMonthlyReportRow,
} from './report.types';

export class ReportService {
  constructor(private readonly reportRepository: ReportRepository) {}

  public async getMonthlyRentalReport(query: RentalsReportQuery): Promise<MonthlyRentalReport> {
    const [year, month] = query.month.split('-').map(Number) as [number, number];

    const { rows, monthStart, monthEnd } = await this.reportRepository.getMonthlyReport(
      year,
      month,
      query.vehicle_id,
    );

    const totals = rows.reduce(
      (acc, row) => ({
        total_bookings: acc.total_bookings + row.total_bookings,
        days_rented: acc.days_rented + row.days_rented,
        revenue: roundCurrency(acc.revenue + row.revenue),
      }),
      { total_bookings: 0, days_rented: 0, revenue: 0 },
    );

    return {
      month: query.month,
      period: {
        start_date: monthStart,
        end_date: monthEnd,
        days_in_month: inclusiveDayCount(monthStart, monthEnd),
      },
      vehicles: rows,
      totals,
      top_vehicle_by_revenue: ReportService.pickTopVehicle(rows),
    };
  }

  /**
   * The query already sorts by revenue DESC, so the winner is the first row —
   * but only if it actually earned something. A month with no rentals has no
   * "top vehicle", and naming an arbitrary zero-revenue vehicle would be
   * misleading.
   */
  private static pickTopVehicle(rows: VehicleMonthlyReportRow[]): VehicleMonthlyReportRow | null {
    const first = rows[0];
    if (!first || first.revenue <= 0) return null;
    return first;
  }
}
