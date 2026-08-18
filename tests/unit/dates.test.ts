import { describe, expect, it } from 'vitest';
import { inclusiveDayCount, isIsoDate, roundCurrency } from '../../src/core/dates';

describe('inclusiveDayCount', () => {
  it('counts a same-day rental as 1 day (spec: same start/end = 1 day)', () => {
    expect(inclusiveDayCount('2025-08-15', '2025-08-15')).toBe(1);
  });

  it('counts both endpoints — 10th to 12th is 3 days', () => {
    expect(inclusiveDayCount('2025-09-10', '2025-09-12')).toBe(3);
  });

  it('spans a month boundary correctly (Jul 29 -> Aug 3 is 6 days)', () => {
    expect(inclusiveDayCount('2025-07-29', '2025-08-03')).toBe(6);
  });

  it('handles a leap-day span (Feb 28 -> Mar 1, 2024 is 3 days)', () => {
    expect(inclusiveDayCount('2024-02-28', '2024-03-01')).toBe(3);
  });

  it('is unaffected by month length across a full month', () => {
    expect(inclusiveDayCount('2025-08-01', '2025-08-31')).toBe(31);
  });
});

describe('roundCurrency', () => {
  it('rounds to two decimal places', () => {
    expect(roundCurrency(13500)).toBe(13500);
    expect(roundCurrency(100.005)).toBe(100.01);
  });

  it('does not drift on values that are unsafe in binary floating point', () => {
    // 0.1 + 0.2 === 0.30000000000000004 without rounding.
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3);
  });

  it('keeps a prorated revenue slice clean (27000 * 3 / 6)', () => {
    expect(roundCurrency((27000 * 3) / 6)).toBe(13500);
  });
});

describe('isIsoDate', () => {
  it('accepts a well-formed calendar date', () => {
    expect(isIsoDate('2025-08-01')).toBe(true);
  });

  it('rejects an impossible calendar date the regex alone would allow', () => {
    expect(isIsoDate('2025-02-30')).toBe(false);
    expect(isIsoDate('2025-13-01')).toBe(false);
  });

  it('rejects the wrong shape', () => {
    expect(isIsoDate('2025-8-1')).toBe(false);
    expect(isIsoDate('01-08-2025')).toBe(false);
    expect(isIsoDate('not-a-date')).toBe(false);
  });

  it('accepts a real leap day and rejects a non-leap Feb 29', () => {
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2025-02-29')).toBe(false);
  });
});
