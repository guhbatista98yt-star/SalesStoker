import { describe, it, expect } from 'vitest';
import { formatCurrency, formatPercent } from '../client/src/lib/calendar-utils';

describe('Format Utils', () => {
  it('formats currency correctly', () => {
    expect(formatCurrency(1500.5)).toBe('R$ 1.500,50');
    expect(formatCurrency(0)).toBe('R$ 0,00');
  });

  it('formats percentages correctly', () => {
    expect(formatPercent(12.5)).toBe('12,5%');
    expect(formatPercent(0)).toBe('0,0%');
  });
});
