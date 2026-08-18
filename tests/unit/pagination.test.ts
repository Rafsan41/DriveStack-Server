import { describe, expect, it } from 'vitest';
import { buildPaginationMeta } from '../../src/core/http';

describe('buildPaginationMeta', () => {
  it('computes total pages by rounding up', () => {
    const meta = buildPaginationMeta(1, 10, 25);
    expect(meta.totalPages).toBe(3);
    expect(meta.hasNextPage).toBe(true);
    expect(meta.hasPreviousPage).toBe(false);
  });

  it('marks the last page as having no next page', () => {
    const meta = buildPaginationMeta(3, 10, 25);
    expect(meta.hasNextPage).toBe(false);
    expect(meta.hasPreviousPage).toBe(true);
  });

  it('reports zero pages and no navigation for an empty result set', () => {
    const meta = buildPaginationMeta(1, 10, 0);
    expect(meta).toMatchObject({
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it('handles an exact multiple of the page size', () => {
    const meta = buildPaginationMeta(2, 10, 20);
    expect(meta.totalPages).toBe(2);
    expect(meta.hasNextPage).toBe(false);
    expect(meta.hasPreviousPage).toBe(true);
  });
});
