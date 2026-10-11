// Run with: node --test test/
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

// Switcher.js is a QML library script; drop its pragma and load the rest as plain JS.
const source = fs.readFileSync(path.join(__dirname, "..", "Switcher.js"), "utf8")
  .replace(/^\.pragma library\s*$/m, "")
const Switcher = {}
vm.runInNewContext(source, Switcher)

test("Tab steps forward through the cards and wraps at the end", () => {
  assert.equal(Switcher.next(0, 1, 5), 1)
  assert.equal(Switcher.next(3, 1, 5), 4)
  assert.equal(Switcher.next(4, 1, 5), 0)
})

test("Shift+Tab steps back and wraps at the start", () => {
  assert.equal(Switcher.next(3, -1, 5), 2)
  assert.equal(Switcher.next(0, -1, 5), 4)
})

test("an unknown start lands on the first card going forward, the last going back", () => {
  assert.equal(Switcher.next(-1, 1, 5), 0)
  assert.equal(Switcher.next(-1, -1, 5), 4)
})

test("no cards, nowhere to step", () => {
  assert.equal(Switcher.next(0, 1, 0), -1)
})

test("releasing Super commits the card a live session picked", () => {
  assert.equal(Switcher.commitIndex(true, 2, 5), 2)
})

test("releasing Super outside a session commits nothing", () => {
  // After Esc, after an overview opened by gesture, or with the overlay closed.
  assert.equal(Switcher.commitIndex(false, 2, 5), -1)
})

test("a pick that no longer exists commits nothing", () => {
  // The workspace behind the card closed while Super was held.
  assert.equal(Switcher.commitIndex(true, 5, 5), -1)
  assert.equal(Switcher.commitIndex(true, -1, 5), -1)
  assert.equal(Switcher.commitIndex(true, 0, 0), -1)
})

// The step and the release reach the shell as separate processes, so nothing
// orders them. Every Super hold carries a session number and the shell
// remembers the newest one whose release it has seen.

test("a step is dropped when its own session already committed", () => {
  // Tab, Tab, release: the release got in between the two steps.
  assert.equal(Switcher.stepIsLate(7, 7, 7), true)
})

test("a step still counts while its session has not been released", () => {
  assert.equal(Switcher.stepIsLate(7, 7, 6), false)
  assert.equal(Switcher.stepIsLate(8, 7, 7), false)
})

test("a step with no session is never late", () => {
  assert.equal(Switcher.stepIsLate(0, 0, 0), false)
})

test("a release that beat the first step switches as soon as that step arrives", () => {
  assert.equal(Switcher.releasedAlready(7, 7), true)
  assert.equal(Switcher.releasedAlready(7, 6), false)
  assert.equal(Switcher.releasedAlready(0, 7), false)
})

test("only a release for the live session commits", () => {
  assert.equal(Switcher.ownsSession(7, 7), true)
  assert.equal(Switcher.ownsSession(6, 7), false)
  assert.equal(Switcher.ownsSession(0, 7), true)
})
