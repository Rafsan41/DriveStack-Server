import type { Knex } from 'knex';

/** Ids land at 1..6 because 01_staff.ts truncated with RESTART IDENTITY. */
export async function seed(knex: Knex): Promise<void> {
  await knex('vehicles').insert([
    {
      name: 'Toyota Corolla Altis',
      plate_number: 'DHA-KA-1234',
      category: 'sedan',
      daily_rate: 4500,
    },
    { name: 'Honda CR-V', plate_number: 'DHA-GA-5678', category: 'suv', daily_rate: 7200 },
    { name: 'Toyota Hiace', plate_number: 'DHM-CHA-9012', category: 'van', daily_rate: 9500 },
    { name: 'Suzuki Swift', plate_number: 'CTG-KA-3344', category: 'hatchback', daily_rate: 3200 },
    {
      name: 'Mitsubishi Pajero Sport',
      plate_number: 'DHA-GA-7788',
      category: 'suv',
      daily_rate: 11000,
    },
    { name: 'Nissan X-Trail', plate_number: 'SYL-KA-2211', category: 'suv', daily_rate: 8000 },
  ]);
}
