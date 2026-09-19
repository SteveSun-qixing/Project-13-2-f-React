import { beforeEach, describe, expect, it } from 'vitest';

import { PAL_ERROR_CODES } from '../src/platform/errors.js';
import type { CommandResult, CommandRunner } from '../src/platform/mac/command-runner.js';
import { createMacPowerPort, parsePmsetBatteryStatus } from '../src/platform/mac/power-port.js';
import { MockPowerMonitor, MockPowerSaveBlocker } from './helpers/electron-mock.js';

/** 命令执行器替身。 */
class StubCommandRunner implements CommandRunner {
  stdout = '';
  error: Error | null = null;
  readonly calls: Array<{ command: string; args: readonly string[] }> = [];

  run(command: string, args: readonly string[]): Promise<CommandResult> {
    this.calls.push({ command, args });
    if (this.error !== null) {
      return Promise.reject(this.error);
    }
    return Promise.resolve({ stdout: this.stdout, stderr: '', exitCode: 0 });
  }
}

describe('parsePmsetBatteryStatus', () => {
  it('should parse charging and discharging states', () => {
    const charging = parsePmsetBatteryStatus(
      "Now drawing from 'AC Power'\n -InternalBattery-0 (id=1234567)\t100%; charged; 0:00 remaining present: true",
    );
    expect(charging).toEqual({ batteryLevel: 1, charging: true });

    const discharging = parsePmsetBatteryStatus(
      "Now drawing from 'Battery Power'\n -InternalBattery-0 (id=1234567)\t73%; discharging; 2:31 remaining present: true",
    );
    expect(discharging).toEqual({ batteryLevel: 0.73, charging: false });

    const notCharging = parsePmsetBatteryStatus(
      "Now drawing from 'AC Power'\n -InternalBattery-0 (id=1234567)\t100%; not charging; 0:00 remaining present: true",
    );
    expect(notCharging).toEqual({ batteryLevel: 1, charging: false });
  });

  it('should return nulls when there is no battery line', () => {
    expect(parsePmsetBatteryStatus("Now drawing from 'AC Power'\n")).toEqual({
      batteryLevel: null,
      charging: null,
    });
  });

  it('should keep charging unknown when the state field is missing', () => {
    expect(parsePmsetBatteryStatus(' -InternalBattery-0\t50%')).toEqual({
      batteryLevel: 0.5,
      charging: null,
    });
  });

  it('should ignore invalid percentages', () => {
    expect(parsePmsetBatteryStatus(' -InternalBattery-0\t250%; charged')).toEqual({
      batteryLevel: null,
      charging: null,
    });
  });
});

describe('createMacPowerPort · query', () => {
  let powerMonitor: MockPowerMonitor;
  let blocker: MockPowerSaveBlocker;
  let runner: StubCommandRunner;

  beforeEach(() => {
    powerMonitor = new MockPowerMonitor();
    blocker = new MockPowerSaveBlocker();
    runner = new StubCommandRunner();
  });

  /** 创建电源端口。 */
  function createPort(): ReturnType<typeof createMacPowerPort> {
    return createMacPowerPort({
      powerMonitor,
      powerSaveBlocker: blocker,
      runCommand: runner,
    });
  }

  it('should combine powerMonitor state with pmset battery data', async () => {
    powerMonitor.onBattery = true;
    powerMonitor.idleState = 'idle';
    powerMonitor.thermal = 'fair';
    runner.stdout = "Now drawing from 'Battery Power'\n -InternalBattery-0 (id=1)\t42%; discharging; 1:00 remaining";

    const state = await createPort().query();
    expect(state).toEqual({
      onBattery: true,
      batteryLevel: 0.42,
      charging: false,
      idleState: 'idle',
      thermalState: 'fair',
    });
    expect(runner.calls).toEqual([{ command: 'pmset', args: ['-g', 'batt'] }]);
  });

  it('should fall back to AC semantics when charging cannot be parsed', async () => {
    powerMonitor.onBattery = false;
    runner.stdout = "Now drawing from 'AC Power'\n";
    const state = await createPort().query();
    expect(state.batteryLevel).toBeNull();
    expect(state.charging).toBe(true);
    expect(state.thermalState).toBe('nominal');
  });

  it('should degrade battery data when the command fails', async () => {
    powerMonitor.onBattery = true;
    runner.error = new Error('pmset missing');
    const state = await createPort().query();
    expect(state.batteryLevel).toBeNull();
    expect(state.charging).toBe(false);
  });

  it('should fail with POWER_INFO_UNAVAILABLE when powerMonitor errors', async () => {
    powerMonitor.fail = true;
    await expect(createPort().query()).rejects.toMatchObject({
      code: PAL_ERROR_CODES.POWER_INFO_UNAVAILABLE,
      retryable: true,
    });
  });

  it('should reject aborted queries', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(createPort().query({ signal: controller.signal })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.BRIDGE_CANCELLED,
    });
  });
});

describe('createMacPowerPort · setPreventSleep', () => {
  let powerMonitor: MockPowerMonitor;
  let blocker: MockPowerSaveBlocker;
  let runner: StubCommandRunner;

  beforeEach(() => {
    powerMonitor = new MockPowerMonitor();
    blocker = new MockPowerSaveBlocker();
    runner = new StubCommandRunner();
  });

  /** 创建电源端口。 */
  function createPort(): ReturnType<typeof createMacPowerPort> {
    return createMacPowerPort({
      powerMonitor,
      powerSaveBlocker: blocker,
      runCommand: runner,
    });
  }

  it('should start and stop a single blocker', async () => {
    const port = createPort();
    await port.setPreventSleep(true);
    expect(blocker.started.size).toBe(1);
    expect(blocker.lastType).toBe('prevent-app-suspension');

    await port.setPreventSleep(true);
    expect(blocker.started.size).toBe(1);

    await port.setPreventSleep(false);
    expect(blocker.started.size).toBe(0);
    await port.setPreventSleep(false);
    expect(blocker.started.size).toBe(0);
  });

  it('should fail when the system does not honor the blocker', async () => {
    blocker.ineffectiveStart = true;
    await expect(createPort().setPreventSleep(true)).rejects.toMatchObject({
      code: PAL_ERROR_CODES.POWER_PREVENT_SLEEP_FAILED,
    });
  });

  it('should normalize blocker start failures', async () => {
    blocker.failStart = true;
    await expect(createPort().setPreventSleep(true)).rejects.toMatchObject({
      code: PAL_ERROR_CODES.POWER_PREVENT_SLEEP_FAILED,
    });
  });

  it('should refuse to re-enable when the blocker state cannot be verified', async () => {
    const port = createPort();
    await port.setPreventSleep(true);
    blocker.failIsStarted = true;
    await expect(port.setPreventSleep(true)).rejects.toMatchObject({
      code: PAL_ERROR_CODES.POWER_PREVENT_SLEEP_FAILED,
    });
  });

  it('should tolerate verification failures while disabling', async () => {
    const port = createPort();
    await port.setPreventSleep(true);
    blocker.failIsStarted = true;
    await expect(port.setPreventSleep(false)).resolves.toBeUndefined();
  });

  it('should restart when the previous blocker was released externally', async () => {
    const port = createPort();
    await port.setPreventSleep(true);
    blocker.started.clear();
    await port.setPreventSleep(true);
    expect(blocker.started.size).toBe(1);
  });

  it('should reject aborted calls', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(createPort().setPreventSleep(true, { signal: controller.signal })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.BRIDGE_CANCELLED,
    });
  });

  it('should not stop a blocker that is no longer started', async () => {
    const port = createPort();
    await port.setPreventSleep(true);
    const id = [...blocker.started][0]!;
    blocker.started.delete(id);
    await expect(port.setPreventSleep(false)).resolves.toBeUndefined();
    expect(blocker.started.size).toBe(0);
  });
});
