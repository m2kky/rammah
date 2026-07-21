import { vi } from 'vitest';

export const FIXED_UTC_INSTANT = new Date('2024-01-02T03:04:05.678Z');
export const FIXED_UUID = '123e4567-e89b-42d3-a456-426614174000';

export function useDeterministicRuntime(): void {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_UTC_INSTANT);
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(FIXED_UUID);
}
