import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('vehicles', (table) => {
    table.increments('id').primary();
    table.string('name', 150).notNullable();
    table.string('plate_number', 32).notNullable().unique();
    table.string('category', 60).notNullable();
    table.decimal('daily_rate', 10, 2).notNullable();
    table.string('photo_path', 500).nullable();
    // Soft delete: NULL means live. Every read path filters on this.
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE vehicles
      ADD CONSTRAINT vehicles_daily_rate_positive CHECK (daily_rate > 0);
  `);

  await knex.raw('CREATE INDEX vehicles_category_idx ON vehicles (category);');

  // The listing endpoint always filters `deleted_at IS NULL`, so a partial index
  // keeps only the live rows and stays small as deleted rows accumulate.
  await knex.raw(`
    CREATE INDEX vehicles_live_created_at_idx
      ON vehicles (created_at DESC)
      WHERE deleted_at IS NULL;
  `);

  await knex.raw(`
    CREATE TRIGGER vehicles_set_updated_at
    BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('vehicles');
}
