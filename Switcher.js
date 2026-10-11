.pragma library

// Rules for the Super+Tab switcher: hold Super, Tab steps through the
// workspace cards, releasing Super goes to the one picked. Kept free of the
// shell so they can be tested on their own.

// Card `offset` steps from `index`, wrapping at both ends: one Tab is 1, one
// Shift+Tab -1, and a release can carry several at once.
function next(index, offset, count) {
  if (count <= 0) return -1
  return ((index + offset) % count + count) % count
}

// Where a hold starts counting: the focused card, or, when the focused
// workspace has no card, just before the first card if the hold began with Tab
// (so that Tab lands on the first card) and on it if it began with Shift+Tab
// (so that it lands on the last). The same start serves one step at a time and
// all of them at once, so the order they arrive in cannot change the pick.
function origin(focused, first) {
  if (focused >= 0) return focused
  return first < 0 ? 0 : -1
}

// The card to switch to when Super is let go, or -1 when the pick no longer
// exists (the workspace behind it closed while Super was held).
function commitIndex(index, count) {
  return index >= 0 && index < count ? index : -1
}

// The steps that open the switcher and the release of Super reach the shell as
// separate processes, so nothing orders them. Each Super hold carries a session
// number (0 when a caller sends none) and `first`, the direction of its first
// Tab; the release also carries `offset`, how far the Tabs moved the pick, so
// it can finish any step that has not arrived.
// `s` is what the shell keeps between calls: the session in charge, whether it
// is still waiting for its release, the offset its steps added up to so far,
// and the newest session that is over (committed, cancelled or closed).
function create() {
  return { switching: false, session: 0, offset: 0, retired: 0 }
}

// A step of a session that is over, or older than the one running, must not
// open or move anything.
function stepIsStale(s, session) {
  return session !== 0 && (session <= s.retired || session < s.session)
}

// The card picked after a step: a new session starts from the `focused` card,
// the running one moves on from `selected`. A stale step changes nothing.
function step(s, session, direction, first, selected, focused, count) {
  if (stepIsStale(s, session)) return selected
  if (!s.switching || session !== s.session) {
    s.switching = true
    s.session = session
    s.offset = 0
    selected = origin(focused, first)
  }
  s.offset += direction
  return next(selected, direction, count)
}

// The card to go to when Super is let go, or -1 for nothing. Only the running
// session commits; a release that beat the session's first step can still go
// by itself, since its `offset` (null when none came) says where.
function release(s, session, offset, first, selected, focused, count) {
  if (session !== 0 && session <= s.retired) return -1
  var index
  if (s.switching && session === s.session)
    index = offset === null || offset === s.offset ? selected : next(selected, offset - s.offset, count)
  else if (session > s.session && offset !== null)
    index = next(origin(focused, first), offset, count)
  else
    return -1
  s.retired = Math.max(s.retired, session)
  s.switching = false
  return commitIndex(index, count)
}

// The overlay went away (Esc, a click, a commit) or opened some other way:
// the running session is over, so its late steps and its release do nothing.
function end(s) {
  s.retired = Math.max(s.retired, s.session)
  s.switching = false
}
