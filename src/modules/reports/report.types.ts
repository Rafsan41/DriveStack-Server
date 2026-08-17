/** One row of the monthly report — the shape spec §4 asks for, plus context. */
export interface VehicleMonthlyReportRow {
  id: number;
  name: string;
  plate_number: string;
  category: string;
  total_bookings: number;
  days_rented: number;
  revenue: number;
}

export interface MonthlyReportTotals {
  total_bookings: number;
  days_rented: number;
  revenue: number;
}

export interface MonthlyRentalReport {
  /** Echoed back as `YYYY-MM`. */
  month: string;
  /** The inclusive calendar window the figures were clipped to. */
  period: {
    start_date: string;
    end_date: string;
    days_in_month: number;
  };
  vehicles: VehicleMonthlyReportRow[];
  totals: MonthlyReportTotals;
  /** Spec §4: "the vehicle with the highest revenue that month". */
  top_vehicle_by_revenue: VehicleMonthlyReportRow | null;
}

export interface RentalsReportQuery {
  /** `YYYY-MM`. */
  month: string;
  vehicle_id?: number;
}
