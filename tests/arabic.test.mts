/** Arabic locale: fallbacks, dates and that the Arabic copy keeps every placeholder. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

import { latinGuess, normalizeArabic, searchPlayers } from "@/lib/playersAr";
import { quizQuestions } from "@/lib/quiz";
import { dateLocale, dict, ordinal, pick, type TKey } from "@/lib/strings";

const { friendPush, invitePush } = createRequire(import.meta.url)("../server-push.js");

const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();

test("pick reads the locale's text and falls back to English when Arabic is missing", () => {
  const both = { tr: "Şili", en: "Chile" };
  assert.equal(pick(both, "tr"), "Şili");
  assert.equal(pick(both, "ar"), "Chile");
  assert.equal(pick({ ...both, ar: "تشيلي" }, "ar"), "تشيلي");
});

test("Arabic dates stay Gregorian with Western digits", () => {
  assert.match(dateLocale("ar"), /nu-latn/);
  assert.match(dateLocale("ar"), /ca-gregory/);
  assert.equal(dateLocale("tr"), "tr-TR");
  assert.equal(dateLocale("en"), "en-GB");
});

test("Arabic places are plain numbers", () => {
  assert.equal(ordinal(3, "ar"), "3");
});

test("every Arabic string exists and keeps the English placeholders", () => {
  for (const k of Object.keys(dict.en) as TKey[]) {
    assert.ok(dict.ar[k]?.trim(), `missing: ${k}`);
    assert.equal(holes(dict.ar[k]), holes(dict.en[k]), `placeholders differ: ${k}`);
  }
});

test("a known club and country read in Arabic by id", () => {
  assert.equal(pick({ id: "realmadrid", tr: "Real Madrid", en: "Real Madrid" }, "ar"), "ريال مدريد");
  assert.equal(pick({ id: "chile", tr: "Şili", en: "Chile" }, "ar"), "تشيلي");
});

test("every dealt quiz question carries Arabic text and options", () => {
  for (const q of quizQuestions(40, "mixed", "normal")) {
    assert.match(q.text.ar ?? "", /[\u0600-\u06FF]/, `no Arabic: ${q.text.en}`);
    assert.ok(q.options.every((o) => o.ar?.trim()), `option without Arabic: ${q.text.en}`);
  }
});

test("pushes reach an Arabic phone in Arabic, any other language in English", () => {
  assert.match(invitePush("Kartal", "ht")("ar").body, /يدعوك/);
  assert.match(friendPush("")("ar").body, /أضافك/);
  assert.match(invitePush("Kartal", "ht")("de").body, /invited you/);
});

test("Arabic spellings fold together", () => {
  assert.equal(normalizeArabic("أليسون"), normalizeArabic("اليسون"));
  assert.equal(normalizeArabic("مُحَمَّد"), "محمد");
});

test("an Arabic surname finds the player and becomes the Latin name", () => {
  assert.ok(searchPlayers("ميسي").some((p) => p.name === "Lionel Messi"));
  assert.equal(latinGuess("ليونيل ميسي"), "Lionel Messi");
  assert.equal(latinGuess("ميسي"), "Messi");
});

test("Latin input searches as before and a guess nobody matches stays as typed", () => {
  assert.ok(searchPlayers("Messi").some((p) => p.name === "Lionel Messi"));
  assert.equal(latinGuess("Messi"), "Messi");
  assert.equal(latinGuess("لاعب غير معروف"), "لاعب غير معروف");
});
