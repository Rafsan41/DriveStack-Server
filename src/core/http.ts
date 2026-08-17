import type { Response } from 'express';

/** Every successful response has this shape. */
export interface ApiSuccessBody<TData> {
  success: true;
  message: string;
  data: TData;
}

/** Every failed response has this shape. */
export interface ApiErrorBody {
  success: false;
  message: string;
  code: string;
  errors?: ValidationIssue[];
  details?: unknown;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** Shape returned by every list endpoint. */
export interface PaginatedData<TItem> {
  items: TItem[];
  pagination: PaginationMeta;
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && total > 0,
  };
}

export function sendSuccess<TData>(
  res: Response,
  statusCode: number,
  message: string,
  data: TData,
): Response<ApiSuccessBody<TData>> {
  return res.status(statusCode).json({ success: true, message, data });
}
