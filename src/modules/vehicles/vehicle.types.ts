/** Row exactly as it exists in the `vehicles` table. */
export interface VehicleRow {
  id: number;
  name: string;
  plate_number: string;
  category: string;
  daily_rate: number;
  photo_path: string | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** What the API returns. `deleted_at` is intentionally not exposed. */
export interface VehicleDto {
  id: number;
  name: string;
  plate_number: string;
  category: string;
  daily_rate: number;
  photo_path: string | null;
  /** Ready-to-use relative URL, e.g. `/uploads/vehicle-1234.jpg`. */
  photo_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateVehicleBody {
  name: string;
  plate_number: string;
  category: string;
  daily_rate: number;
}

export interface UpdateVehicleBody {
  name?: string;
  plate_number?: string;
  category?: string;
  daily_rate?: number;
  /** Clears the existing photo when no replacement file is sent. */
  remove_photo?: boolean;
}

export interface ListVehiclesQuery {
  page: number;
  limit: number;
  category?: string;
  search?: string;
}

/** Values written to the table on insert. */
export interface VehicleInsert {
  name: string;
  plate_number: string;
  category: string;
  daily_rate: number;
  photo_path: string | null;
}

/** Values written to the table on update. */
export type VehicleUpdate = Partial<VehicleInsert>;
