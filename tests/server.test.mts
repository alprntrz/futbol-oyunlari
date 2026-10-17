/** Server helpers that keep players private: refs (server-refs.js). */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

// a throwaway data dir: server-refs.js keeps its secret and the reports next to ACCOUNTS_DB
process.env.ACCOUNTS_DB = join(mkdtempSync(join(tmpdir(), "tiktako-test-")), "accounts.db");
delete process.env.REF_SECRET;
const require = createRequire(import.meta.url);
const refs = require("../server-refs.js") as {
  refForSocket: (uid: string | null, pid: unknown) => string | null;
  refForUser: (uid: string) => string;
  addReport: (by: string, r: { ref: string; nick?: string; reason?: string; game?: string }) => boolean;
  shownNick: (ref: string | null, nick: string) => string;
  cleanBlocks: (list: unknown) => Set<string>;
  isRef: (v: unknown) => boolean;
};

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

test("three different reporters hide a nickname; one reporter can't", () => {
  const bad = refs.refForUser("bad");
  const r1 = refs.refForUser("r1");
  for (let i = 0; i < 5; i++) refs.addReport(r1, { ref: bad, reason: "nick" });
  assert.equal(refs.shownNick(bad, "Rude"), "Rude");
  refs.addReport(refs.refForUser("r2"), { ref: bad });
  refs.addReport(refs.refForUser("r3"), { ref: bad });
  assert.equal(refs.shownNick(bad, "Rude"), "Player");
  assert.equal(refs.addReport(bad, { ref: bad }), false, "reporting yourself");
});

test("block lists keep only refs, at most 200", () => {
  const list = [...Array.from({ length: 250 }, (_, i) => refs.refForUser(`x${i}`)), "not-a-ref", 42];
  const set = refs.cleanBlocks(list);
  assert.equal(set.size, 200);
  assert.ok([...set].every(refs.isRef));
});
