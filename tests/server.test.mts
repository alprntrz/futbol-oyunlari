/** Server helpers that keep players private: refs (server-refs.js). */
import assert from "node:assert/strict";
import { mkdtempSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

// a throwaway data dir: server-refs.js keeps its secret and the reports next to ACCOUNTS_DB
const DIR = mkdtempSync(join(tmpdir(), "tiktako-test-"));
process.env.ACCOUNTS_DB = join(DIR, "accounts.db");
delete process.env.REF_SECRET;
// reports already on disk: signed-in ones from 31 days ago and from yesterday, then a file past its size cap
const REPORTS = join(DIR, "reports.jsonl");
const OLD = "a".repeat(16);
const NEW = "b".repeat(16);
const DAY = 86_400_000;
const line = (by: string, ref: string, ago: number) => JSON.stringify({ at: new Date(Date.now() - ago).toISOString(), by, ref, signed: true });
writeFileSync(
  REPORTS,
  [..."123".split("").map((n) => line(n.repeat(16), OLD, 31 * DAY)), ..."456".split("").map((n) => line(n.repeat(16), NEW, DAY)), JSON.stringify({ pad: "x".repeat(5 * 1024 * 1024) })].join("\n") + "\n"
);
const require = createRequire(import.meta.url);
const refs = require("../server-refs.js") as {
  refForSocket: (uid: string | null, pid: unknown) => string | null;
  refForUser: (uid: string) => string;
  addReport: (by: string, r: { ref: string; nick?: string; reason?: string; game?: string }, signed?: boolean) => boolean;
  shownNick: (ref: string | null, nick: string) => string;
  cleanBlocks: (list: unknown) => Set<string>;
  isRef: (v: unknown) => boolean;
};

const core = require("../server-core.js") as {
  nameKey: (v: unknown) => string;
  nameUsed: (used: string[], name: string) => boolean;
};

test("a name counts as used whatever its case, accents or spacing", () => {
  const used = ["Messi", "Di  Maria", "Ödegaard"];
  assert.equal(core.nameUsed(used, "MESSİ"), true);
  assert.equal(core.nameUsed(used, "messi"), true);
  assert.equal(core.nameUsed(used, "di maria"), true);
  assert.equal(core.nameUsed(used, "Odegaard"), true);
  assert.equal(core.nameUsed(used, "Neymar"), false);
  assert.equal(core.nameUsed([], "Messi"), false);
});

test("a ref is stable, opaque and never the install id", () => {
  const a = refs.refForSocket(null, "installid123456");
  assert.equal(a, refs.refForSocket(null, "installid123456"));
  assert.ok(refs.isRef(a));
  assert.ok(!a!.includes("installid"));
  assert.notEqual(a, refs.refForSocket(null, "installid654321"));
  // signed in: the account decides, whatever the phone
  assert.equal(refs.refForSocket("u1", "installid123456"), refs.refForUser("u1"));
  assert.equal(refs.refForSocket(null, "short"), null);
});

test("three different signed-in reporters hide a nickname; one reporter can't", () => {
  const bad = refs.refForUser("bad");
  const r1 = refs.refForUser("r1");
  for (let i = 0; i < 5; i++) refs.addReport(r1, { ref: bad, reason: "nick" }, true);
  assert.equal(refs.shownNick(bad, "Rude"), "Rude");
  refs.addReport(refs.refForUser("r2"), { ref: bad }, true);
  refs.addReport(refs.refForUser("r3"), { ref: bad }, true);
  assert.equal(refs.shownNick(bad, "Rude"), "Player");
  assert.equal(refs.addReport(bad, { ref: bad }), false, "reporting yourself");
});

test("guest reports are kept but don't hide a nickname", () => {
  const target = refs.refForUser("target");
  for (const pid of ["guestpid0001", "guestpid0002", "guestpid0003"]) assert.ok(refs.addReport(refs.refForSocket(null, pid)!, { ref: target }));
  assert.equal(refs.shownNick(target, "Fine"), "Fine");
});

test("one reporter ref gets one report every few seconds", () => {
  const by = refs.refForUser("quick");
  assert.ok(refs.addReport(by, { ref: refs.refForUser("t1") }, true));
  assert.equal(refs.addReport(by, { ref: refs.refForUser("t2") }, true), false);
});

test("a hide expires 30 days after the reports", () => {
  assert.equal(refs.shownNick(OLD, "Old"), "Old");
  assert.equal(refs.shownNick(NEW, "New"), "Player");
});

test("reports.jsonl stops growing past its cap", async () => {
  const size = statSync(REPORTS).size;
  assert.ok(refs.addReport(refs.refForUser("late"), { ref: refs.refForUser("t3") }, true));
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(statSync(REPORTS).size, size);
});

test("block lists keep only refs, at most 200", () => {
  const list = [...Array.from({ length: 250 }, (_, i) => refs.refForUser(`x${i}`)), "not-a-ref", 42];
  const set = refs.cleanBlocks(list);
  assert.equal(set.size, 200);
  assert.ok([...set].every(refs.isRef));
});
