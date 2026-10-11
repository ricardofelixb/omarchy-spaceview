.pragma library

// Rules for the Super+Tab switcher: hold Super, Tab steps through the
// workspace cards, releasing Super goes to the one picked. Kept free of the
// shell so they can be tested on their own.

// Card index `direction` steps from `index`, wrapping at both ends: one Tab is
// 1, one Shift+Tab -1, and a release can carry several at once. An unknown
// start (-1, e.g. the focused workspace has no card) counts as just before the
// first card going forward and the first card going back.
function next(index, direction, count) {
  if (count <= 0) return -1
  if (direction === 0) return index
  if (index < 0) index = direction > 0 ? -1 : 0
  return ((index + direction) % count + count) % count
}

// The card to switch to when Super is let go, or -1 when the pick no longer
// exists (the workspace behind it closed while Super was held).
function commitIndex(index, count) {
  return index >= 0 && index < count ? index : -1
}

// The steps that open the switcher and the release of Super reach the shell as
// separate processes, so nothing orders them. Each Super hold carries a session
// number (0 when a caller sends none), and the release carries `offset`, how
// far the Tabs moved the pick, so it can finish any step that has not arrived.
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
function step(s, session, direction, selected, focused, count) {
  if (stepIsStale(s, session)) return selected
  if (!s.switching || session !== s.session) {
    s.switching = true
    s.session = session
    s.offset = 0
    selected = focused
  }
  s.offset += direction
  return next(selected, direction, count)
}

// The card to go to when Super is let go, or -1 for nothing. Only the running
// session commits; a release that beat the session's first step can still go
// by itself, since its `offset` (null when none came) says where.
function release(s, session, offset, selected, focused, count) {
  if (session !== 0 && session <= s.retired) return -1
  var index
  if (s.switching && session === s.session)
    index = offset === null ? selected : next(selected, offset - s.offset, count)
  else if (session > s.session && offset !== null)
    index = next(focused, offset, count)
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
