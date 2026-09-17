import { mkdtempSync } from "node:fs";
import * as nodeOs from "node:os";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { jest, mock, vi } from "bun:test";

mock.module("node:os", () => ({
  ...nodeOs,
  homedir: () =>
    process.env["HOME"] || process.env["USERPROFILE"] || nodeOs.homedir(),
}));

const testHome = mkdtempSync(join(tmpdir(), "agentmemory-bun-test-home-"));
process.env["HOME"] = testHome;
process.env["USERPROFILE"] = testHome;

type MockCompat = typeof vi & {
  mocked?: <T>(value: T) => T;
  hoisted?: <T>(factory: () => T) => T;
  setSystemTime?: typeof jest.setSystemTime;
  stubGlobal?: (name: string, value: unknown) => void;
  unstubAllGlobals?: () => void;
  advanceTimersByTimeAsync?: (milliseconds: number) => Promise<void>;
  runAllTimersAsync?: () => Promise<void>;
};

const mockCompat = vi as MockCompat;

mockCompat.mocked ??= <T>(value: T): T => value;
mockCompat.hoisted ??= <T>(factory: () => T): T => factory();
mockCompat.setSystemTime ??= jest.setSystemTime;

const globalSnapshots = new Map<string, { existed: boolean; value: unknown }>();

mockCompat.stubGlobal ??= (name: string, value: unknown) => {
  if (!globalSnapshots.has(name)) {
    globalSnapshots.set(name, {
      existed: name in globalThis,
      value: globalThis[name as keyof typeof globalThis],
    });
  }
  Object.defineProperty(globalThis, name, {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
};

mockCompat.unstubAllGlobals ??= () => {
  for (const [name, snapshot] of globalSnapshots) {
    if (snapshot.existed) {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: snapshot.value,
      });
    } else {
      delete globalThis[name as keyof typeof globalThis];
    }
  }
  globalSnapshots.clear();
};

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

mockCompat.advanceTimersByTimeAsync ??= async (milliseconds: number) => {
  const target = jest.now() + milliseconds;
  await flushMicrotasks();
  if (jest.now() < target) jest.advanceTimersByTime(target - jest.now());
  await flushMicrotasks();
};

mockCompat.runAllTimersAsync ??= async () => {
  for (let i = 0; i < 100; i++) {
    await flushMicrotasks();
    if (jest.getTimerCount() === 0) {
      await flushMicrotasks();
      if (jest.getTimerCount() === 0) return;
    }
    jest.runAllTimers();
  }
};
