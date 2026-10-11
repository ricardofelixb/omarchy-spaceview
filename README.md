# Spaceview

A fullscreen workspace overview for [Omarchy](https://omarchy.org/): your ten
workspaces side by side, every window a live preview. It runs inside the
`omarchy-shell` you already have — no compositor plugin, no compiling, nothing
to rebuild when Hyprland updates.

Open it with a three-finger swipe, a keyboard shortcut, or both.

![Spaceview showing five workspaces with live window previews](preview.png)

## Features

- Each card is a true miniature of the workspace: windows are placed from
  Hyprland's own geometry, so a vertical split reads as a vertical split
- Live Wayland window previews, falling back to the app icon while a window has
  no frame yet
- Click a window to focus it, click a workspace to switch to it
- Drag a window between workspaces, or within one to rearrange it: drop it on
  the left, right, top, or bottom half of another window to land it exactly
  there, with the landing zone highlighted as you drag (dwindle only)
- Keyboard driven throughout: arrows or `hjkl`, `Enter` to switch, `1`–`9`/`0`
  to jump, `Esc` to close
- Workspaces 1–10, with 1–5 always shown and a trailing `+` card for the next
  empty one
- Follows your Omarchy theme, since every color is a theme token

## Requirements

- Omarchy 4 (Quattro) with `omarchy-shell`
- Hyprland with Omarchy 4's Lua configuration format
- Quickshell 0.3+ with the Wayland screencopy module (ships with Omarchy)

No external binaries, services, or network access.

## Install

```bash
omarchy plugin add https://github.com/ecylmz/omarchy-spaceview.git --enable --yes
```

## Open it

Every way of opening Spaceview goes through the same shell IPC call, so you can
bind it to whatever you like:

```bash
omarchy-shell shell toggle ecylmz.spaceview   # open if closed, close if open
omarchy-shell shell summon ecylmz.spaceview   # open
omarchy-shell shell hide ecylmz.spaceview     # close
```

### With a keyboard shortcut

Add this to `~/.config/hypr/bindings.lua`, then run `hyprctl reload`:

```lua
o.bind("SUPER + CTRL + G", "Workspace overview", "omarchy-shell shell toggle ecylmz.spaceview")
```

Any free combination works — `omarchy menu keybindings --print` lists the ones
already taken. To claim a key Omarchy uses by default, unbind it first:

```lua
hl.unbind("SUPER + G") -- Omarchy binds this to "Toggle window grouping"
o.bind("SUPER + G", "Workspace overview", "omarchy-shell shell toggle ecylmz.spaceview")
```

### With a trackpad gesture

Three fingers up opens Spaceview, three fingers down closes it. Add this to
`~/.config/hypr/input.lua`, then run `hyprctl reload`:

```lua
-- The table form fires on `start`, i.e. as soon as the swipe is recognized;
-- a bare `action = function() ... end` would only fire once your fingers lift.
local spaceview = function(command)
  return {
    start = function()
      hl.exec_cmd("omarchy-shell shell " .. command .. " ecylmz.spaceview")
    end,
    update = function() end,
    finish = function() end,
  }
end

hl.gesture({ fingers = 3, direction = "up", action = spaceview("summon") })
hl.gesture({ fingers = 3, direction = "down", action = spaceview("hide") })
```

## Workspace switcher (Super+Tab)

Hold `Super` and press `Tab` to open Spaceview with the next workspace picked.
Keep holding `Super` and press `Tab` or `Shift+Tab` to move the pick, then let
go of `Super` to switch to it. `Esc` cancels without switching. An overview
opened any other way (gesture, `toggle`) is unaffected: letting go of `Super`
there does nothing.

Hyprland has to tell Spaceview when `Super` is released, so this needs a little
config of your own. Save this as `~/.config/hypr/spaceview.lua`, add
`require("hypr.spaceview")` after `require("hypr.bindings")` in
`~/.config/hypr/hyprland.lua`, then run `hyprctl reload` and
`hyprctl configerrors`:

```lua
-- Spaceview setup: a Super+Tab workspace switcher, and no tap-and-drag while
-- the overview is up. Documented in the Spaceview README.
local PLUGIN = "ecylmz.spaceview"
local NAMESPACE = "spaceview" -- the overlay's layer-shell namespace

-- Hold Super and tap Tab to walk the workspaces; letting go of Super switches
-- to the one picked. Omarchy binds Super+Tab to "Next workspace" and
-- Super+Shift+Tab to "Previous workspace"; these take their place.
local switching = false

-- Every hold of Super is one numbered session. The steps and the release are
-- separate processes with no delivery order, so the overlay uses the number to
-- match them up. Counting from the clock keeps it ahead of earlier sessions
-- after a reload.
local session = os.time() * 1000

local function step(direction)
  if not switching then session = session + 1 end
  switching = true
  hl.exec_cmd(string.format("omarchy-shell -q shell summon %s '{\"step\":%d,\"session\":%d}'",
    PLUGIN, direction, session))
end

-- The overlay ignores a release it has no session for, so a stale one is
-- harmless; the flag only saves the call.
local function release()
  if not switching then return end
  switching = false
  hl.exec_cmd(string.format("omarchy-shell -q shell call %s commitSwitch '{\"session\":%d}'", PLUGIN, session))
end

-- Hyprland holds back a modifier's release bind once another bind has fired
-- under that modifier, which Tab just did; `transparent` stops that. The release
-- must also match with Shift still down, hence `ignore_mods`.
local release_flags = { release = true, transparent = true, ignore_mods = true }

hl.unbind("SUPER + TAB")
hl.unbind("SUPER + SHIFT + TAB")
o.bind("SUPER + TAB", "Workspace switcher: next", function() step(1) end)
o.bind("SUPER + SHIFT + TAB", "Workspace switcher: previous", function() step(-1) end)
hl.bind("SUPER + SUPER_L", release, release_flags)
hl.bind("SUPER + SUPER_R", release, release_flags)

-- A tap on a preview should click it, not start a window drag, so only a held
-- physical click drags there. Tap-to-click is untouched. The setting comes
-- back when the overlay's layer goes away, however it goes.
local layers = 0
local saved_tap_and_drag

hl.on("layer.opened", function(layer)
  if layer.namespace ~= NAMESPACE then return end
  layers = layers + 1
  if layers == 1 then
    saved_tap_and_drag = hl.get_config("input.touchpad.tap_and_drag")
    if saved_tap_and_drag ~= nil then
      hl.config({ input = { touchpad = { tap_and_drag = false } } })
    end
  end
end)

hl.on("layer.closed", function(layer)
  if layer.namespace ~= NAMESPACE or layers == 0 then return end
  layers = layers - 1
  if layers == 0 then
    switching = false
    if saved_tap_and_drag ~= nil then
      hl.config({ input = { touchpad = { tap_and_drag = saved_tap_and_drag } } })
      saved_tap_and_drag = nil
    end
  end
end)
```

Notes:

- It takes over `Super+Tab` and `Super+Shift+Tab`, which Omarchy binds to
  "Next workspace" and "Previous workspace". `Super+Ctrl+Tab` is untouched.
- The switcher cycles the workspace cards and skips the trailing `+` card.
- Both `Super` keys commit, even with `Shift` still down. A release with no
  switcher session behind it is ignored, so it cannot switch workspace by
  accident.
- Each hold of `Super` is a numbered session, and the steps and the release
  carry its number. They reach the shell as separate processes with no delivery
  order; if a quick tap's release lands first, the shell remembers it and the
  step then switches straight away.
- The second half of the file switches off tap-and-drag while the overview is
  open, so a tap on a preview clicks it instead of starting a drag; a held
  physical click still drags. Qt cannot tell a tap from a physical click (a
  Wayland pointer button carries no source), so the only way to tell them apart
  is in the compositor. The setting is saved when the overview's layer appears
  and put back when it goes away, however it goes. Tap-to-click is never
  touched. To check it on your touchpad, open the overview, tap a preview and
  at once touch down again and move: it should not drag, while a held physical
  click should. `hyprctl getoption input:touchpad:tap-and-drag` reads `false`
  while the overview is open and `true` again once it closes.

## Keys

| Key | Action |
| --- | --- |
| Arrows / `h` `j` `k` `l` | Move between workspace cards |
| `Enter` / `Space` | Switch to the selected workspace |
| `1`–`9`, `0` | Switch to that workspace directly |
| `Esc` | Close |
| Hold `Super`, `Tab` / `Shift+Tab` | Step through the workspaces; release `Super` to switch ([setup](#workspace-switcher-supertab)) |

## Remove

```bash
omarchy plugin remove ecylmz.spaceview --yes
```

Then delete the binding, the `hl.gesture(...)` block, or `spaceview.lua` and its
`require` line, whichever you added, and run `hyprctl reload`.

## Security

Omarchy plugins run unsandboxed with your user permissions, so review the source
before installing — it is three QML files, a small JavaScript module and a manifest.

Spaceview ships no binaries and no helper scripts, spawns no processes, and
opens no sockets. It talks to Hyprland only through Quickshell's
`Hyprland.dispatch`, validating every window address against
`^(0x)?[0-9a-fA-F]+$` first, and it never writes to your Hyprland or Omarchy
configuration — the bindings, gesture and `spaceview.lua` above are yours to add.
[SECURITY.md](SECURITY.md) lists the invariants a change has to keep.

## Credits

The grid, card, and preview layout started from the workspace overview proposed
in [omacom/omarchy#6611](https://github.com/omacom/omarchy/pull/6611) by
[@sanjyay](https://github.com/sanjyay), which was closed rather than merged.
That code is MIT licensed as part of Omarchy. Spaceview reworks it into a
standalone third-party plugin: Lua-form Hyprland dispatches, gesture-driven
summoning, a reworked focus hierarchy, and a deeper scrim for fullscreen use.

## License

MIT — see [LICENSE](LICENSE).
