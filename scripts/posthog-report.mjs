#!/usr/bin/env node
/**
 * Yesterday's (Istanbul day) usage report from PostHog, in Turkish Markdown (scripts/lib/posthog-report.mjs).
 * Read-only: a PostHog personal API key with only the "Query: read" scope, kept in ~/.tiktako-posthog-key
 * (chmod 600) or POSTHOG_API_KEY. Events are anonymous (mobile/src/lib/analytics.ts); the report prints counts only.
 *
 * Usage:
 *   node scripts/posthog-report.mjs                  report to stdout
 *   node scripts/posthog-report.mjs --out <dir>      also writes <dir>/posthog-YYYY-MM-DD.md
 *   node scripts/posthog-report.mjs --day 2026-10-24 a given Istanbul day
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { renderReport, reportDay, reportQueries } from "./lib/posthog-report.mjs";

const HOST = (process.env.POSTHOG_HOST || "https://us.posthog.com").replace(/\/$/, "");
const PROJECT = process.env.POSTHOG_PROJECT || "684160";
const KEY_FILE = join(homedir(), ".tiktako-posthog-key");
const QUERY_TIMEOUT_MS = 60_000;

function apiKey() {
  if (process.env.POSTHOG_API_KEY) return process.env.POSTHOG_API_KEY.trim();
  try {
    return readFileSync(KEY_FILE, "utf8").trim();
  } catch {
    return "";
  }
}

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function hogql(key, query) {
  const res = await fetch(`${HOST}/api/projects/${PROJECT}/query/`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status} ${body.detail ?? body.error ?? ""}`.trim());
  return body.results ?? [];
}

const key = apiKey();
if (!key) {
  console.error(`No PostHog key: put a personal API key (scope "Query: read" only) in ${KEY_FILE} or POSTHOG_API_KEY.`);
  process.exit(1);
}
const dayArg = argValue("--day");
if (dayArg && !/^\d{4}-\d{2}-\d{2}$/.test(dayArg)) {
  console.error("--day takes YYYY-MM-DD");
  process.exit(1);
}
// noon UTC of the next day = mid-morning in Istanbul, so reportDay lands on --day
const window = reportDay(dayArg ? new Date(Date.parse(`${dayArg}T12:00:00Z`) + 86_400_000) : new Date());

try {
  const queries = reportQueries(window);
  const entries = await Promise.all(Object.entries(queries).map(async ([name, q]) => [name, await hogql(key, q)]));
  const md = renderReport(window.day, Object.fromEntries(entries));
  console.log(md);
  const outDir = argValue("--out");
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    const file = join(outDir, `posthog-${window.day}.md`);
    writeFileSync(file, md + "\n");
    console.error(`Wrote ${file}`);
  }
} catch (e) {
  console.error(`PostHog query failed: ${e.message}`);
  process.exit(1);
}
