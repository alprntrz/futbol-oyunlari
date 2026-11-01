import assert from "node:assert/strict";
import { test } from "node:test";

import { roomOfLink } from "@/../mobile/src/lib/roomLinkPath"; // the app's pure link parser

test("room links name the room they would join", () => {
  assert.equal(roomOfLink("tiktako://hat-trick/oda/ab12c"), "hat-trick/oda/AB12C");
  assert.equal(roomOfLink("tiktako://possession/oda/XY9?random=1"), "possession/oda/XY9");
  assert.equal(roomOfLink("exp://192.168.1.2:8081/--/rondo/oda/QQ1"), "rondo/oda/QQ1");
  assert.equal(roomOfLink("tiktako://taktik/lobi?coach=bus&code=k7"), "taktik/lobi/K7");
});

test("the screen on show matches its own Live Activity link", () => {
  assert.equal(roomOfLink("/hat-trick/oda/AB12C"), roomOfLink("tiktako://hat-trick/oda/AB12C"));
});

test("other links are not room links", () => {
  for (const url of ["tiktako://", "tiktako://bingo", "tiktako://hat-trick/oda", "tiktako://hat-trick/bot", "tiktako://taktik/lobi", "/"]) {
    assert.equal(roomOfLink(url), null, url);
  }
});
