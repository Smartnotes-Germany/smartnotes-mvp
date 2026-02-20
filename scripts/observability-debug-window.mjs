#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const DEFAULT_MINUTES = 30;
const MIN_MINUTES = 1;
const MAX_MINUTES = 8 * 60;

const executable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const args = process.argv.slice(2);
const command = args[0] ?? "";

const getFlagValue = (flagName) => {
  const direct = args.find((entry) => entry.startsWith(`${flagName}=`));
  if (direct) {
    return direct.slice(flagName.length + 1);
  }

  const index = args.indexOf(flagName);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
};

const printUsage = () => {
  console.log("Verwendung:");
  console.log(
    "  node scripts/observability-debug-window.mjs start [--minutes <zahl>]",
  );
  console.log("  node scripts/observability-debug-window.mjs stop");
};

const runConvexEnvSet = (name, value) => {
  const result = spawnSync(
    executable,
    ["exec", "convex", "env", "set", name, value],
    {
      stdio: "inherit",
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const parseMinutes = () => {
  const raw = getFlagValue("--minutes");
  if (!raw) {
    return DEFAULT_MINUTES;
  }

  const parsed = Number.parseInt(raw, 10);
  if (
    !Number.isFinite(parsed) ||
    parsed < MIN_MINUTES ||
    parsed > MAX_MINUTES
  ) {
    console.error(
      `Ungueltige Dauer: ${raw}. Erlaubt sind ${MIN_MINUTES}-${MAX_MINUTES} Minuten.`,
    );
    process.exit(1);
  }

  return parsed;
};

if (command === "start") {
  const minutes = parseMinutes();
  const expiresAt = Date.now() + minutes * 60 * 1000;

  runConvexEnvSet("OBSERVABILITY_ALLOW_SENSITIVE_CAPTURE", "true");
  runConvexEnvSet("OBSERVABILITY_SENSITIVE_CAPTURE_UNTIL", String(expiresAt));

  console.log("");
  console.log("Sensitive Debug Window aktiviert.");
  console.log(`Dauer: ${minutes} Minuten`);
  console.log(`Ablauf (UTC): ${new Date(expiresAt).toISOString()}`);
  process.exit(0);
}

if (command === "stop") {
  runConvexEnvSet("OBSERVABILITY_ALLOW_SENSITIVE_CAPTURE", "false");
  runConvexEnvSet("OBSERVABILITY_SENSITIVE_CAPTURE_UNTIL", "0");

  console.log("");
  console.log("Sensitive Debug Window deaktiviert.");
  process.exit(0);
}

printUsage();
process.exit(1);
