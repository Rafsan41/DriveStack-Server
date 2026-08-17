import { ConflictError, NotFoundError } from '../../core/ApiError';
import { buildPaginationMeta, type PaginatedData } from '../../core/http';
import { removeStoredPhoto, toStoredPhotoPath } from '../../middlewares/upload.middleware';
import type { VehicleRepository } from './vehicle.repository';
import type {
  CreateVehicleBody,
  ListVehiclesQuery,
  UpdateVehicleBody,
  VehicleDto,
  VehicleRow,
  VehicleUpdate,
} from './vehicle.types';

export class VehicleService {
  constructor(private readonly vehicleRepository: VehicleRepository) {}

  public async list(query: ListVehiclesQuery): Promise<PaginatedData<VehicleDto>> {
    const { rows, total } = await this.vehicleRepository.list(query);
    return {
      items: rows.map((row) => VehicleService.toDto(row)),
      pagination: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  public async getById(id: number): Promise<VehicleDto> {
    const row = await this.vehicleRepository.findById(id);
    if (!row) throw new NotFoundError(`Vehicle ${id} was not found.`);
    return VehicleService.toDto(row);
  }

  public async create(input: CreateVehicleBody, photo?: Express.Multer.File): Promise<VehicleDto> {
    const existing = await this.vehicleRepository.findByPlateNumber(input.plate_number);
    if (existing) {
      // The uploaded file would otherwise be left behind on disk.
      if (photo) await removeStoredPhoto(toStoredPhotoPath(photo));
      throw new ConflictError(`Plate number ${input.plate_number} is already registered.`);
    }

    const row = await this.vehicleRepository.create({
      name: input.name,
      plate_number: input.plate_number,
      category: input.category,
      daily_rate: input.daily_rate,
      photo_path: photo ? toStoredPhotoPath(photo) : null,
    });

    return VehicleService.toDto(row);
  }

  /**
   * Photo handling: a new file replaces the old one, `remove_photo=true` clears
   * it, and neither leaves the previous file orphaned on disk. The old file is
   * only unlinked *after* the row update commits, so a failed update never
   * destroys the photo that is still referenced.
   */
  public async update(
    id: number,
    input: UpdateVehicleBody,
    photo?: Express.Multer.File,
  ): Promise<VehicleDto> {
    const current = await this.vehicleRepository.findById(id);
    if (!current) {
      if (photo) await removeStoredPhoto(toStoredPhotoPath(photo));
      throw new NotFoundError(`Vehicle ${id} was not found.`);
    }

    if (input.plate_number && input.plate_number !== current.plate_number) {
      const clash = await this.vehicleRepository.findByPlateNumber(input.plate_number, id);
      if (clash) {
        if (photo) await removeStoredPhoto(toStoredPhotoPath(photo));
        throw new ConflictError(`Plate number ${input.plate_number} is already registered.`);
      }
    }

    const changes: VehicleUpdate = {};
    if (input.name !== undefined) changes.name = input.name;
    if (input.plate_number !== undefined) changes.plate_number = input.plate_number;
    if (input.category !== undefined) changes.category = input.category;
    if (input.daily_rate !== undefined) changes.daily_rate = input.daily_rate;

    let photoToDelete: string | null = null;
    if (photo) {
      changes.photo_path = toStoredPhotoPath(photo);
      photoToDelete = current.photo_path;
    } else if (input.remove_photo) {
      changes.photo_path = null;
      photoToDelete = current.photo_path;
    }

    if (Object.keys(changes).length === 0) {
      // Nothing to write — return the current state rather than issuing an
      // empty UPDATE, which Knex rejects.
      return VehicleService.toDto(current);
    }

    const updated = await this.vehicleRepository.update(id, changes);
    if (!updated) throw new NotFoundError(`Vehicle ${id} was not found.`);

    if (photoToDelete && photoToDelete !== updated.photo_path) {
      await removeStoredPhoto(photoToDelete);
    }

    return VehicleService.toDto(updated);
  }

  /** Soft delete (spec §4). The row and its rental history stay intact. */
  public async softDelete(id: number): Promise<{ id: number; deleted_at: Date | null }> {
    const row = await this.vehicleRepository.softDelete(id);
    if (!row) throw new NotFoundError(`Vehicle ${id} was not found or is already deleted.`);
    return { id: row.id, deleted_at: row.deleted_at };
  }

  private static toDto(row: VehicleRow): VehicleDto {
    return {
      id: row.id,
      name: row.name,
      plate_number: row.plate_number,
      category: row.category,
      daily_rate: Number(row.daily_rate),
      photo_path: row.photo_path,
      photo_url: row.photo_path ? `/${row.photo_path}` : null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
