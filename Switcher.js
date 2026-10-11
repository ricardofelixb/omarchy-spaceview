.pragma library

// Rules for the Super+Tab switcher: hold Super, Tab steps through the
// workspace cards, releasing Super goes to the one picked. Kept free of the
// shell so they can be tested on their own.

// Card index one Tab (direction 1) or Shift+Tab (-1) away from `index`,
// wrapping at both ends. An unknown start (-1, e.g. the focused workspace has
// no card) lands on the first card going forward and the last going back.
function next(index, direction, count) {
  if (count <= 0) return -1
  if (index < 0) return direction > 0 ? 0 : count - 1
  return ((index + direction) % count + count) % count
}

// The card to switch to when Super is let go. Only a live session commits, so
// a release after Esc, or after an overview opened by gesture, does nothing.
function commitIndex(switching, index, count) {
  return switching && index >= 0 && index < count ? index : -1
}
