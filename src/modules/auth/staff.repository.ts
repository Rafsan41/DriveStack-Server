import type { Knex } from 'knex';
import { BaseRepository } from '../../core/BaseRepository';
import type { StaffRow } from './auth.types';

export class StaffRepository extends BaseRepository<StaffRow> {
  constructor(knex?: Knex) {
    super('staff', knex);
  }

  public async findByEmail(email: string, trx?: Knex.Transaction): Promise<StaffRow | undefined> {
    return this.table(trx).where({ email: email.toLowerCase() }).first();
  }

  public async findById(id: number, trx?: Knex.Transaction): Promise<StaffRow | undefined> {
    return this.table(trx).where({ id }).first();
  }
}
