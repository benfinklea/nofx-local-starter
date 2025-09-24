import { describe, expect, it, jest } from '@jest/globals';
import { shouldEnableDevRestartWatch } from '../../src/lib/devRestart';

describe('shouldEnableDevRestartWatch', () => {
  it('returns false when DEV_RESTART_WATCH is not set', () => {
    expect(
      shouldEnableDevRestartWatch({ env: {}, isTTY: true, logger: { warn: jest.fn() } }),
    ).toBe(false);
  });

  it('returns true when enabled in interactive tty', () => {
    expect(
      shouldEnableDevRestartWatch({ env: { DEV_RESTART_WATCH: '1' }, isTTY: true, logger: { warn: jest.fn() } }),
    ).toBe(true);
  });

  it('warns and returns false in headless mode unless explicitly allowed', () => {
    const warn = jest.fn();
    expect(
      shouldEnableDevRestartWatch({ env: { DEV_RESTART_WATCH: '1' }, isTTY: false, logger: { warn } }),
    ).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('allows headless usage when override is set', () => {
    const warn = jest.fn();
    expect(
      shouldEnableDevRestartWatch({ env: { DEV_RESTART_WATCH: '1', DEV_RESTART_ALLOW_HEADLESS: '1' }, isTTY: false, logger: { warn } }),
    ).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });
});
