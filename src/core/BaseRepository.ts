import type { Knex } from 'knex';
import { db } from '../database/connection';

/**
 * Shared plumbing for the data layer.
 *
 * Every method takes an optional transaction so a service can compose several
 * repository calls into one atomic unit — which is exactly what the rental
 * overlap check needs.
 */
export abstract class BaseRepository<TRow extends object> {
  protected constructor(
    protected readonly tableName: string,
    protected readonly knex: Knex = db,
  ) {}

  /** Query builder bound to this repository's table, on `trx` when given. */
  protected table(trx?: Knex.Transaction): Knex.QueryBuilder<TRow> {
    return this.connection(trx)<TRow>(this.tableName);
  }

  /** Raw connection, for hand-written SQL. */
  protected connection(trx?: Knex.Transaction): Knex {
    return (trx ?? this.knex) as Knex;
  }

  /** Runs `work` inside a transaction, reusing `trx` if one is already open. */
  public async transaction<TResult>(
    work: (trx: Knex.Transaction) => Promise<TResult>,
    trx?: Knex.Transaction,
  ): Promise<TResult> {
    if (trx) return work(trx);
    return this.knex.transaction(work);
  }
}
