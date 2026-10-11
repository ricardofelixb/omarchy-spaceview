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

test("several steps at once land where the same steps one by one would", () => {
  assert.equal(Switcher.next(2, 2, 5), 4)
  assert.equal(Switcher.next(4, 7, 5), 1)
  assert.equal(Switcher.next(1, -3, 5), 3)
  assert.equal(Switcher.next(2, 0, 5), 2)
})

test("a focused workspace with no card enters at the first card going forward, the last going back", () => {
  // The count starts just before the first card for Tab and on it for Shift+Tab.
  assert.equal(Switcher.next(Switcher.origin(-1, 1), 1, 5), 0)
  assert.equal(Switcher.next(Switcher.origin(-1, -1), -1, 5), 4)
  assert.equal(Switcher.origin(3, 1), 3)
  assert.equal(Switcher.origin(3, -1), 3)
})

test("no cards, nowhere to step", () => {
  assert.equal(Switcher.next(0, 1, 0), -1)
})

test("a pick that no longer exists commits nothing", () => {
  assert.equal(Switcher.commitIndex(2, 5), 2)
  assert.equal(Switcher.commitIndex(5, 5), -1)
  assert.equal(Switcher.commitIndex(-1, 5), -1)
  assert.equal(Switcher.commitIndex(0, 0), -1)
})

// The steps and the release of one Super hold reach the shell as separate
// processes, so nothing orders them. Each hold carries a session number, and
// the release says how far the Tabs moved the pick (`offset`), so it can finish
// any step that has not arrived yet. These replay the orders that went wrong.

// One shell: the first of five cards focused (or none, with -1), like the overlay's own state.
function rig(focused = 0, count = 5) {
  const s = Switcher.create()
  let selected = -1
  return {
    count,
    // `first` is the direction of the hold's first Tab, which every call carries.
    step(session, direction, first = direction) {
      if (Switcher.stepIsStale(s, session)) return null // the overlay is not even opened for it
      selected = Switcher.step(s, session, direction, first, selected, focused, count)
      return selected
    },
    release(session, offset = null, first = 0) {
      return Switcher.release(s, session, offset, first, selected, focused, count)
    },
    close() { // Esc, a click, or a commit
      Switcher.end(s)
      selected = -1
    },
  }
}

test("Tab, Tab, release goes two cards on", () => {
  const sw = rig()
  sw.step(7, 1)
  sw.step(7, 1)
  assert.equal(sw.release(7, 2), 2)
})

test("a release between two Tabs still counts both", () => {
  const sw = rig()
  sw.step(7, 1)
  assert.equal(sw.release(7, 2), 2) // the second Tab has not got here yet
  assert.equal(sw.step(7, 1), null) // and when it does, it is dropped
})

test("a release ahead of its first Tab switches without it", () => {
  const sw = rig()
  assert.equal(sw.release(7, 2), 2)
  assert.equal(sw.step(7, 1), null)
  assert.equal(sw.step(7, 1), null)
})

test("Tab and Shift+Tab that cancel out come back to the focused card", () => {
  const sw = rig()
  sw.step(7, 1)
  assert.equal(sw.release(7, 0), 0)
})

test("a late Tab of a finished hold does not commit the next hold", () => {
  const sw = rig()
  sw.step(7, 1)
  assert.equal(sw.release(7, 1), 1)
  sw.close()
  assert.equal(sw.step(8, 1), 1)
  assert.equal(sw.step(7, 1), null) // delayed from the first hold
  assert.equal(sw.release(8, 1), 1) // the second hold is untouched and still commits
})

test("a late Tab of an older hold does not take over a running one", () => {
  const sw = rig()
  sw.step(8, 1) // 7 never got a release here
  assert.equal(sw.step(7, 1), null)
  assert.equal(sw.release(7, 1), -1)
  assert.equal(sw.release(8, 1), 1)
})

test("a release without a session cannot commit a numbered one", () => {
  const sw = rig()
  sw.step(7, 1)
  assert.equal(sw.release(0), -1)
  assert.equal(sw.release(7, 1), 1) // still waiting for its own release
})

test("a release with no sessions behind it commits nothing", () => {
  // The overview was opened by gesture and Super was let go.
  const sw = rig()
  assert.equal(sw.release(0), -1)
  assert.equal(sw.release(7), -1) // no offset, so no idea where to go
})

test("Esc cancels the hold, and Tabs and the release still on their way do nothing", () => {
  const sw = rig()
  sw.step(7, 1)
  sw.close()
  assert.equal(sw.step(7, 1), null) // the queued second Tab must not reopen it
  assert.equal(sw.release(7, 2), -1)
})

test("a release after the commit does nothing", () => {
  const sw = rig()
  sw.step(7, 1)
  assert.equal(sw.release(7, 1), 1)
  assert.equal(sw.release(7, 1), -1)
})

test("a hold with no numbers works as before", () => {
  const sw = rig()
  sw.step(0, 1)
  assert.equal(sw.release(0), 1)
})

test("a new hold starts from the focused card, not where the last one stopped", () => {
  const sw = rig(2)
  sw.step(7, 1)
  sw.release(7, 1)
  sw.close()
  assert.equal(sw.step(8, -1), 1)
})

test("a workspace that closes while Super is held commits nothing", () => {
  const s = Switcher.create()
  Switcher.step(s, 7, 1, 1, -1, 3, 5)
  assert.equal(Switcher.release(s, 7, 1, 1, 4, 3, 4), -1) // a workspace closed meanwhile
})

// The count only has a start when the focused workspace has a card. Without
// one, it depends on which way the first Tab went, which a net offset forgets,
// so every call carries that direction too.

test("from a workspace with no card, Tab then Shift+Tab lands on the last card whatever the order", () => {
  for (const order of [["a", "b", "r"], ["r", "a", "b"], ["b", "a", "r"], ["a", "r", "b"], ["b", "r", "a"], ["r", "b", "a"]]) {
    const sw = rig(-1)
    let got = null
    for (const m of order) {
      if (m === "r") got = sw.release(7, 0, 1)
      else sw.step(7, m === "a" ? 1 : -1, 1) // Tab, then Shift+Tab; `first` is Tab's
    }
    assert.equal(got, 4, order.join())
  }
})

function permutations(items) {
  if (items.length <= 1) return [items]
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map(rest => [item, ...rest]))
}

test("one hold picks the same card whatever order its Tabs and release arrive in", () => {
  const count = 5
  const holds = [[1], [-1], [1, 1], [1, -1], [-1, 1], [-1, -1], [1, 1, -1], [1, -1, -1], [-1, 1, 1], [-1, -1, 1]]
  for (const focused of [-1, 0, 3]) {
    for (const directions of holds) {
      // What pressing the keys one by one would pick.
      let expected = focused
      for (const d of directions)
        expected = expected < 0 ? (d > 0 ? 0 : count - 1) : (expected + d + count) % count
      const first = directions[0]
      const offset = directions.reduce((a, b) => a + b, 0)
      const release = directions.length // message number of the release
      for (const order of permutations([...directions.keys(), release])) {
        const sw = rig(focused, count)
        let got = null
        for (const m of order) {
          if (m === release) got = sw.release(7, offset, first)
          else sw.step(7, directions[m], first)
        }
        assert.equal(got, expected, `focused ${focused}, Tabs ${directions}, order ${order}`)
      }
    }
  }
})
