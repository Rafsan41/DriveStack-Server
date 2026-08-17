import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('rentals', (table) => {
    table.increments('id').primary();
    table
      .integer('vehicle_id')
      .notNullable()
      .references('id')
      .inTable('vehicles')
      // A vehicle with rental history must not vanish; vehicles are soft-deleted
      // instead, so RESTRICT here is a real guard, not a formality.
      .onDelete('RESTRICT')
      .onUpdate('CASCADE');
    table.string('customer_name', 150).notNullable();
    table.string('customer_phone', 32).notNullable();
    table.date('start_date').notNullable();
    table.date('end_date').notNullable();
    table.decimal('total_amount', 12, 2).notNullable();
    table.string('status', 20).notNullable().defaultTo('booked');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE rentals
      ADD CONSTRAINT rentals_status_check
        CHECK (status IN ('booked', 'ongoing', 'completed', 'cancelled')),
      ADD CONSTRAINT rentals_date_order_check
        CHECK (end_date >= start_date),
      ADD CONSTRAINT rentals_total_amount_check
        CHECK (total_amount >= 0);
  `);

  // Both the overlap check and the monthly report scan by vehicle and then by
  // date range, so this composite index serves both.
  await knex.raw(`
    CREATE INDEX rentals_vehicle_date_range_idx
      ON rentals (vehicle_id, start_date, end_date);
  `);
  await knex.raw('CREATE INDEX rentals_status_idx ON rentals (status);');
  await knex.raw('CREATE INDEX rentals_start_date_idx ON rentals (start_date);');

  await knex.raw(`
    CREATE TRIGGER rentals_set_updated_at
    BEFORE UPDATE ON rentals
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  /*
   * Deliberately NOT added:
   *
   *   ALTER TABLE rentals ADD CONSTRAINT rentals_no_overlap
   *     EXCLUDE USING gist (
   *       vehicle_id WITH =,
   *       daterange(start_date, end_date, '[]') WITH &&
   *     ) WHERE (status <> 'cancelled');
   *
   * That would push the whole rule into Postgres (requires the btree_gist
   * extension). The assessment states the overlap check belongs in application
   * code, so it lives in RentalService.assertNoOverlap() instead — see the
   * README for the trade-off.
   */
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('rentals');
}
