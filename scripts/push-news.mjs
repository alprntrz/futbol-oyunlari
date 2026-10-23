#!/usr/bin/env node
/**
 * News push to every phone that turned "News and new games" on (server-push.js, POST /api/admin/push).
 * Only phones that opted in get it (App Store 4.5.4); invites and friend pushes are not affected.
 *
 * Usage:
 *   PUSH_ADMIN_TOKEN=… node scripts/push-news.mjs "Başlık" "Metin" "Title" "Text"
 *   PUSH_URL=http://localhost:3000 … (default https://tiktako.fly.dev)
 * Add --yes to send without the confirmation prompt.
 */
import { createInterface } from "node:readline/promises";

const TOKEN = process.env.PUSH_ADMIN_TOKEN;
const BASE = (process.env.PUSH_URL || "https://tiktako.fly.dev").replace(/\/$/, "");
const args = process.argv.slice(2).filter((a) => a !== "--yes");
const [title_tr, body_tr, title_en, body_en] = args;

if (!TOKEN) {
  console.error("PUSH_ADMIN_TOKEN is not set (the same value as the server's Fly secret).");
  process.exit(1);
}
if (![title_tr, body_tr, title_en, body_en].every((s) => typeof s === "string" && s.trim())) {
  console.error('Usage: node scripts/push-news.mjs "Başlık" "Metin" "Title" "Text" [--yes]');
  process.exit(1);
}

console.log(`To ${BASE}, phones with news on:\n  tr: ${title_tr} — ${body_tr}\n  en: ${title_en} — ${body_en}`);
if (!process.argv.includes("--yes")) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question("Send? (y/N) ");
  rl.close();
  if (answer.trim().toLowerCase() !== "y") process.exit(0);
}

try {
  const res = await fetch(`${BASE}/api/admin/push`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ title_tr, body_tr, title_en, body_en }),
    signal: AbortSignal.timeout(120_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Failed: HTTP ${res.status} ${body.error ?? ""}`);
    process.exit(1);
  }
  console.log(`Sent to ${body.sent} phone(s).`);
} catch (e) {
  console.error(`Failed: ${e.message}`);
  process.exit(1);
}
