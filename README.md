# Spaceview

A fullscreen workspace overview for [Omarchy](https://omarchy.org/): occupied
workspaces side by side, every window a live preview. It runs inside the
`omarchy-shell` you already have — no compositor plugin, no compiling, nothing
to rebuild when Hyprland updates.

Open it with a trackpad swipe, a keyboard shortcut, or both.

![Spaceview with live window previews](preview.png)

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
- Occupied workspaces within 1–10, plus the current workspace even if empty,
  and a trailing `+` card for the first unused slot (unless all ten are shown)
- Up to three cards fit on one row
- Follows your Omarchy theme, since every color is a theme token

## Requirements

- Omarchy 4 (Quattro) with `omarchy-shell`
- Hyprland with Omarchy 4's Lua configuration format
- Quickshell 0.3+ with the Wayland screencopy module (ships with Omarchy)

No external binaries, services, or network access.

## Install this fork

Install the merged version from `main`:

```bash
git clone --branch main --single-branch \
  https://github.com/ricardofelixb/omarchy-spaceview.git \
  ~/.config/omarchy/plugins/ecylmz.spaceview
omarchy plugin enable ecylmz.spaceview
omarchy restart shell
```

Use a new destination; do not overwrite an existing plugin checkout.

## Open it

Every way of opening Spaceview uses the same overview:

```bash
omarchy-shell shell toggle ecylmz.spaceview   # open if closed, close if open
omarchy-shell shell summon ecylmz.spaceview   # open
omarchy-shell shell hide ecylmz.spaceview     # close
```

### With a keyboard shortcut

For a trial without replacing workspace navigation, use a free shortcut:

```lua
o.bind("SUPER + CTRL + G", "Workspace overview", "omarchy-shell shell toggle ecylmz.spaceview")
```

Check `omarchy menu keybindings --print` for conflicts first. Put local trial
bindings in `~/.config/hypr/spaceview.lua`, and add
`require("hypr.spaceview")` after `require("hypr.bindings")` in
`~/.config/hypr/hyprland.lua`. Run `hyprctl reload` and `hyprctl configerrors`.
This avoids changing a shared `bindings.lua` on other machines.

To use `Super+Tab` instead, replace the default workspace bindings:

```lua
hl.unbind("SUPER + TAB")
hl.unbind("SUPER + SHIFT + TAB")
o.bind("SUPER + TAB", "Workspace overview", "omarchy-shell shell toggle ecylmz.spaceview")
```

Press once to open, release the keys, then click any window, workspace, or `+`.
Press again to close. There is no cycling or switching on key release.
`Super+Ctrl+Tab` is untouched. Four-finger swipe-up opens the same overview.

### With a trackpad gesture

Four fingers up opens Spaceview, four fingers down closes it. Add this to
`~/.config/hypr/input.lua`, then run `hyprctl reload` and `hyprctl configerrors`:

```lua
-- Fire as soon as the swipe is recognized, not when fingers lift.
local spaceview = function(command)
  return {
    start = function()
      hl.exec_cmd("omarchy-shell shell " .. command .. " ecylmz.spaceview")
    end,
    update = function() end,
    finish = function() end,
  }
end

hl.gesture({ fingers = 4, direction = "up", action = spaceview("summon") })
hl.gesture({ fingers = 4, direction = "down", action = spaceview("hide") })
```

### Optional: physical-click dragging only

Qt cannot distinguish a tap-generated pointer click from a physical click.
On a trackpad, add this to the local `spaceview.lua` to disable tap-and-drag
while the overview is open, restoring its previous setting when it closes.
Tap-to-click is unaffected.

```lua
local layers = 0
local saved_tap_and_drag

hl.on("layer.opened", function(layer)
  if layer.namespace ~= "spaceview" then return end
  layers = layers + 1
  if layers == 1 then
    saved_tap_and_drag = hl.get_config("input.touchpad.tap_and_drag")
    if saved_tap_and_drag ~= nil then
      hl.config({ input = { touchpad = { tap_and_drag = false } } })
    end
  end
end)

hl.on("layer.closed", function(layer)
  if layer.namespace ~= "spaceview" or layers == 0 then return end
  layers = layers - 1
  if layers == 0 and saved_tap_and_drag ~= nil then
    hl.config({ input = { touchpad = { tap_and_drag = saved_tap_and_drag } } })
    saved_tap_and_drag = nil
  end
end)
```

## Keys

| Key | Action |
| --- | --- |
| Arrows / `h` `j` `k` `l` | Move between workspace cards, including `+` |
| `Enter` / `Space` | Switch to the selected workspace |
| `1`–`9`, `0` | Switch to that workspace directly |
| `Esc` | Close |
| `Super+Tab` (if configured) | Toggle the overview; release does nothing |

## Remove

```bash
omarchy plugin remove ecylmz.spaceview --yes
```

Then delete the binding, the `hl.gesture(...)` block, or `spaceview.lua` and its
`require` line, whichever you added, and run `hyprctl reload`.

## Security

Omarchy plugins run unsandboxed with your user permissions, so review the source
before installing — it is three QML files and a manifest.

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
