import bcrypt from 'bcryptjs';
import type { Knex } from 'knex';
import { env } from '../../config/env';

/**
 * Runs first, so it also resets the whole schema. Truncating here (rather than
 * each seed clearing its own table) avoids fighting the rentals → vehicles
 * foreign key, and RESTART IDENTITY makes the seeded ids stable at 1..n so the
 * README's example requests always line up.
 */
export async function seed(knex: Knex): Promise<void> {
  await knex.raw('TRUNCATE TABLE rentals, vehicles, staff RESTART IDENTITY CASCADE');

  const passwordHash = await bcrypt.hash('Password123!', env.bcryptSaltRounds);

  await knex('staff').insert([
    { email: 'admin@rental.test', password_hash: passwordHash, name: 'Ayesha Rahman' },
    { email: 'ops@rental.test', password_hash: passwordHash, name: 'Tanvir Hasan' },
  ]);
}
