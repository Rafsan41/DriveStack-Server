import type { Knex } from 'knex';

/**
 * Rental fixtures chosen so the monthly report is actually provable:
 *
 *  - id 1  spans the July/August boundary (Jul 29 -> Aug 3, 6 days total).
 *          July gets Jul 29,30,31 = 3 days; August gets Aug 1,2,3 = 3 days.
 *          Its two revenue slices (13500 + 13500) sum back to total_amount 27000.
 *  - id 6  spans the August/September boundary (Aug 25 -> Sep 2, 9 days).
 *          August gets 7 days = 77000, September gets 2 days = 22000, sum 99000.
 *  - id 7  is CANCELLED and deliberately overlaps id 1 on the same vehicle. It
 *          proves two things at once: cancelled rentals never block a booking,
 *          and they never appear in the report.
 *  - id 5  starts and ends on the same day -> exactly 1 day, 1 x daily_rate.
 *
 * total_amount is always daily_rate x inclusive day count, matching what
 * RentalService computes at runtime.
 */
export async function seed(knex: Knex): Promise<void> {
  await knex('rentals').insert([
    // vehicle 1 — Corolla @ 4500
    {
      vehicle_id: 1,
      customer_name: 'Nusrat Jahan',
      customer_phone: '+8801711000001',
      start_date: '2025-07-29',
      end_date: '2025-08-03',
      total_amount: 27000, // 6 days
      status: 'completed',
    },
    // vehicle 2 — CR-V @ 7200
    {
      vehicle_id: 2,
      customer_name: 'Imran Kabir',
      customer_phone: '+8801711000002',
      start_date: '2025-08-05',
      end_date: '2025-08-09',
      total_amount: 36000, // 5 days
      status: 'completed',
    },
    {
      vehicle_id: 2,
      customer_name: 'Sadia Islam',
      customer_phone: '+8801711000003',
      start_date: '2025-08-20',
      end_date: '2025-08-22',
      total_amount: 21600, // 3 days
      status: 'completed',
    },
    // vehicle 3 — Hiace @ 9500
    {
      vehicle_id: 3,
      customer_name: 'Rafiq Enterprises',
      customer_phone: '+8801711000004',
      start_date: '2025-08-10',
      end_date: '2025-08-14',
      total_amount: 47500, // 5 days
      status: 'completed',
    },
    // vehicle 4 — Swift @ 3200, single-day rental
    {
      vehicle_id: 4,
      customer_name: 'Mehedi Hasan',
      customer_phone: '+8801711000005',
      start_date: '2025-08-15',
      end_date: '2025-08-15',
      total_amount: 3200, // 1 day
      status: 'completed',
    },
    // vehicle 5 — Pajero @ 11000, crosses into September
    {
      vehicle_id: 5,
      customer_name: 'Farhana Akter',
      customer_phone: '+8801711000006',
      start_date: '2025-08-25',
      end_date: '2025-09-02',
      total_amount: 99000, // 9 days
      status: 'ongoing',
    },
    // vehicle 1 — cancelled, overlapping rental id 1 on purpose
    {
      vehicle_id: 1,
      customer_name: 'Cancelled Booking',
      customer_phone: '+8801711000007',
      start_date: '2025-08-01',
      end_date: '2025-08-03',
      total_amount: 13500, // 3 days
      status: 'cancelled',
    },
    // vehicle 6 — future booking
    {
      vehicle_id: 6,
      customer_name: 'Shahriar Alam',
      customer_phone: '+8801711000008',
      start_date: '2025-09-10',
      end_date: '2025-09-12',
      total_amount: 24000, // 3 days
      status: 'booked',
    },
    // vehicle 1 — earlier July rental, no overlap with id 1
    {
      vehicle_id: 1,
      customer_name: 'Kamrul Islam',
      customer_phone: '+8801711000009',
      start_date: '2025-07-10',
      end_date: '2025-07-14',
      total_amount: 22500, // 5 days
      status: 'completed',
    },
  ]);
}
