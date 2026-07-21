import { describe, expect, it, vi } from 'vitest';

import {
  FIXED_UTC_INSTANT,
  FIXED_UUID,
  useDeterministicRuntime,
} from './deterministic.js';

describe('useDeterministicRuntime', () => {
  it('pins the current time and random UUID to fixed values', () => {
    useDeterministicRuntime();

    expect(new Date().toISOString()).toBe(FIXED_UTC_INSTANT.toISOString());
    expect(crypto.randomUUID()).toBe(FIXED_UUID);
  });

  it('does not leak fake timers or UUID mocks into the next test', () => {
    expect(vi.isFakeTimers()).toBe(false);
    expect(new Date().toISOString()).not.toBe(FIXED_UTC_INSTANT.toISOString());
    expect(crypto.randomUUID()).not.toBe(FIXED_UUID);
  });
});
