import type { Knex } from 'knex';
import { BaseRepository } from '../../core/BaseRepository';
import type { ListVehiclesQuery, VehicleInsert, VehicleRow, VehicleUpdate } from './vehicle.types';

/** `COUNT(*) OVER ()` rides along on every row of the page. */
interface VehicleListRow extends VehicleRow {
  total_count: number;
}

export interface VehicleListResult {
  rows: VehicleRow[];
  total: number;
}

export class VehicleRepository extends BaseRepository<VehicleRow> {
  constructor(knex?: Knex) {
    super('vehicles', knex);
  }

  /**
   * Paginated listing with optional category filter and name search.
   *
   * Written as SQL rather than a Knex chain for one concrete reason: the window
   * function `COUNT(*) OVER ()` returns the unpaginated total on the same scan
   * that fetches the page, so the endpoint needs one round trip instead of the
   * usual query-plus-count-query pair.
   *
   * Bindings are positional (`?`) rather than named, because named bindings and
   * Postgres `::type` casts share the `:` character and confuse Knex's parser.
   */
  public async list(query: ListVehiclesQuery, trx?: Knex.Transaction): Promise<VehicleListResult> {
    const offset = (query.page - 1) * query.limit;
    const category = query.category ?? null;
    const search = query.search?.trim() ? query.search.trim() : null;

    const result = await this.connection(trx).raw<{ rows: VehicleListRow[] }>(
      `
      SELECT
          v.id,
          v.name,
          v.plate_number,
          v.category,
          v.daily_rate,
          v.photo_path,
          v.deleted_at,
          v.created_at,
          v.updated_at,
          COUNT(*) OVER () AS total_count
      FROM vehicles v
      WHERE v.deleted_at IS NULL
        AND (?::text IS NULL OR v.category = ?::text)
        AND (?::text IS NULL OR v.name ILIKE '%' || ?::text || '%')
      ORDER BY v.created_at DESC, v.id DESC
      LIMIT ? OFFSET ?
      `,
      [category, category, search, search, query.limit, offset],
    );

    const rows = result.rows;
    const first = rows[0];
    return {
      rows,
      total: first ? Number(first.total_count) : 0,
    };
  }

  public async findById(
    id: number,
    options: { includeDeleted?: boolean } = {},
    trx?: Knex.Transaction,
  ): Promise<VehicleRow | undefined> {
    const builder = this.table(trx).where({ id });
    if (!options.includeDeleted) builder.whereNull('deleted_at');
    return builder.first();
  }

  /**
   * Locks the vehicle row for the duration of the transaction. This is the lock
   * the rental overlap check contends on — see RentalService.
   */
  public async findByIdForUpdate(
    id: number,
    trx: Knex.Transaction,
  ): Promise<VehicleRow | undefined> {
    return this.table(trx).where({ id }).whereNull('deleted_at').forUpdate().first();
  }

  /** Plate uniqueness is checked up front so the client gets a useful message. */
  public async findByPlateNumber(
    plateNumber: string,
    excludeId?: number,
    trx?: Knex.Transaction,
  ): Promise<VehicleRow | undefined> {
    const builder = this.table(trx).where({ plate_number: plateNumber });
    if (excludeId !== undefined) builder.whereNot({ id: excludeId });
    return builder.first();
  }

  public async create(data: VehicleInsert, trx?: Knex.Transaction): Promise<VehicleRow> {
    const [row] = await this.table(trx).insert(data).returning('*');
    return row as VehicleRow;
  }

  public async update(
    id: number,
    data: VehicleUpdate,
    trx?: Knex.Transaction,
  ): Promise<VehicleRow | undefined> {
    const [row] = await this.table(trx)
      .where({ id })
      .whereNull('deleted_at')
      .update(data)
      .returning('*');
    return row as VehicleRow | undefined;
  }

  /** Soft delete — sets `deleted_at`, keeps the row and its rental history. */
  public async softDelete(id: number, trx?: Knex.Transaction): Promise<VehicleRow | undefined> {
    const [row] = await this.table(trx)
      .where({ id })
      .whereNull('deleted_at')
      .update({ deleted_at: this.connection(trx).fn.now() })
      .returning('*');
    return row as VehicleRow | undefined;
  }
}
