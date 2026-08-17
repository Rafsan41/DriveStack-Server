import type { Knex } from 'knex';

/**
 * Staff table + the shared `set_updated_at()` trigger function used by every
 * table in this schema. Keeping `updated_at` in a trigger means no service can
 * forget to bump it.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await knex.schema.createTable('staff', (table) => {
    table.increments('id').primary();
    table.string('email', 255).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.string('name', 150).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`
    CREATE TRIGGER staff_set_updated_at
    BEFORE UPDATE ON staff
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('staff');
  // Safe: `rollback --all` tears down in reverse order, so the vehicles and
  // rentals triggers that also use this function are already gone by now.
  await knex.raw('DROP FUNCTION IF EXISTS set_updated_at()');
}
