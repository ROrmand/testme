import { loadConfig, patchLocalConfig } from "./config.js";

export function isGateEnabled(cwd: string): boolean {
  return loadConfig(cwd).gateEnabled !== false;
}

export function setGateEnabled(cwd: string, enabled: boolean): void {
  patchLocalConfig(cwd, { gateEnabled: enabled });
}

export function toggleGateEnabled(cwd: string): boolean {
  const next = !isGateEnabled(cwd);
  setGateEnabled(cwd, next);
  return next;
}

export function formatGateBanner(enabled: boolean): string {
  const state = enabled ? "ON  🟢" : "OFF 🔴";
  return [
    "┌─────────────────────────┐",
    `│  testme gate:  ${state}   │`,
    "└─────────────────────────┘",
  ].join("\n");
}

export function formatStatusline(enabled: boolean): string {
  return enabled ? "🟢 testme" : "🔴 testme off";
}
