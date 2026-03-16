#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);

function readFlag(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

const environment = readFlag("--environment", "preview");
const platform = readFlag("--platform", "all");

if (!["preview", "production", "development"].includes(environment)) {
  throw new Error(`Unsupported environment "${environment}".`);
}

if (!["ios", "android", "all"].includes(platform)) {
  throw new Error(`Unsupported platform "${platform}".`);
}

const commonRequired = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_APP_URL",
  "EXPO_PUBLIC_EAS_PROJECT_ID",
  "EXPO_PUBLIC_VAPID_PUBLIC_KEY",
  "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
  "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
  "EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME",
  "EXPO_PUBLIC_SENTRY_DSN",
  "EXPO_PUBLIC_POSTHOG_KEY",
  "EXPO_PUBLIC_POSTHOG_HOST",
];

const required = new Set(commonRequired);

if (platform === "ios" || platform === "all") {
  required.add("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY");
}

if (platform === "android" || platform === "all") {
  required.add("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY");
}

function runCommand(command, commandArgs) {
  return spawnSync(command, commandArgs, {
    encoding: "utf8",
    env: process.env,
  });
}

function runEasEnvList() {
  const cliArgs = ["env:list", environment, "--format", "short"];
  const directResult =
    process.platform === "win32"
      ? runCommand("cmd.exe", ["/d", "/s", "/c", `eas ${cliArgs.join(" ")}`])
      : runCommand("eas", cliArgs);

  if (!directResult.error && directResult.status === 0) {
    return directResult;
  }

  if (directResult.error?.code !== "ENOENT") {
    return directResult;
  }

  return process.platform === "win32"
    ? runCommand("cmd.exe", ["/d", "/s", "/c", `npx eas ${cliArgs.join(" ")}`])
    : runCommand("npx", ["eas", ...cliArgs]);
}

const result = runEasEnvList();

if (result.status !== 0) {
  const errorMessage = result.error?.message
    ? `${result.error.message}\n`
    : "";
  process.stderr.write(
    errorMessage + (result.stderr || result.stdout || "Failed to read EAS environment.\n")
  );
  process.exit(result.status ?? 1);
}

const output = result.stdout ?? "";
const available = new Set(
  output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.match(/^([A-Z0-9_]+)=/))
    .filter(Boolean)
    .map((match) => match[1])
);

const missing = [...required].filter((name) => !available.has(name));

if (missing.length > 0) {
  process.stderr.write(
    [
      `Missing required EAS ${environment} environment variables for platform "${platform}":`,
      ...missing.map((name) => `- ${name}`),
      "",
      `Hydrate from local .env with: bash scripts/push-env-to-eas.sh --env ${environment} --apply`,
    ].join("\n") + "\n"
  );
  process.exit(1);
}

process.stdout.write(
  `EAS ${environment} environment contains ${required.size} required variables for platform "${platform}".\n`
);
