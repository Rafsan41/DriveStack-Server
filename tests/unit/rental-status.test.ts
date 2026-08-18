import { describe, expect, it } from 'vitest';
import {
  BLOCKING_RENTAL_STATUSES,
  isBlockingStatus,
  RENTAL_STATUSES,
} from '../../src/modules/rentals/rental.types';

describe('rental blocking-status rule', () => {
  it('treats every status except cancelled as blocking', () => {
    expect(isBlockingStatus('booked')).toBe(true);
    expect(isBlockingStatus('ongoing')).toBe(true);
    expect(isBlockingStatus('completed')).toBe(true);
    expect(isBlockingStatus('cancelled')).toBe(false);
  });

  it('BLOCKING_RENTAL_STATUSES is exactly the non-cancelled statuses', () => {
    const expected = RENTAL_STATUSES.filter((s) => s !== 'cancelled');
    expect([...BLOCKING_RENTAL_STATUSES].sort()).toEqual([...expected].sort());
  });

  it('cancelled is a valid status but never blocks', () => {
    expect(RENTAL_STATUSES).toContain('cancelled');
    expect(BLOCKING_RENTAL_STATUSES).not.toContain('cancelled');
  });
});
