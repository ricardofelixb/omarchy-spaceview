const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const qml = fs.readFileSync(`${__dirname}/../Spaceview.qml`, 'utf8');
const names = ['findDrawerWorkspace', 'drawerIsOpen', 'activateDrawer',
  'normalizedAddress', 'moveWindowToDrawer', 'sourceWorkspaceId',
  'moveWindowToWorkspace', 'moveCardSelection', 'cardIndexAfterMove',
  'activateSelectedCard'];
const functions = names.map(name => {
  const match = qml.match(new RegExp(`  function ${name}\\([^]*?\\n  \\}`));
  assert.ok(match, `QML function ${name} exists`);
  return match[0];
}).join('\n');

function setup(workspaces = []) {
  const calls = [];
  const root = { refreshSoon() {}, flushPendingReposition() {}, dismiss() {},
    showDrawer: true, gridCardCount: 3, cardCount: 4, columns: 3, rows: 1,
    workspaceCount: 2, nextWorkspaceId: 3, overviewCardModel: [1, 2, 3],
    activateWorkspace(id) { calls.push(id); },
  };
  const Hyprland = { workspaces: { values: workspaces }, focusedMonitor: {
    lastIpcObject: { specialWorkspace: { name: '' } },
  }, dispatch(command) { calls.push(command); } };
  const context = vm.createContext({ root, Hyprland, Qt: { callLater(fn) { fn(); } } });
  vm.runInContext(functions, context);
  for (const name of names) root[name] = context[name];
  return { root, Hyprland, calls };
}

test('only the named scratchpad is a drawer, never the reposition parking workspace', () => {
  const parking = { id: -2, lastIpcObject: { name: 'special:spaceview-move' } };
  const drawer = { id: -7, lastIpcObject: { name: 'special:scratchpad' } };
  assert.equal(setup([parking, drawer]).root.findDrawerWorkspace(), drawer);
  assert.equal(setup([parking]).root.findDrawerWorkspace(), null);
});

test('activating an already-open drawer never hides it', () => {
  const { root, Hyprland, calls } = setup();
  root.activateDrawer();
  assert.deepEqual(calls, ['hl.dsp.workspace.toggle_special("scratchpad")']);
  Hyprland.focusedMonitor.lastIpcObject.specialWorkspace.name = 'special:scratchpad';
  root.activateDrawer();
  assert.equal(calls.length, 1);
});

test('drawer drops validate addresses and never move a window already inside', () => {
  const { root, calls } = setup();
  assert.equal(root.moveWindowToDrawer({ address: 'bad"command' }), false);
  assert.equal(root.moveWindowToDrawer({ address: 'abc123', workspace: {
    lastIpcObject: { name: 'special:scratchpad' },
  } }), false);
  assert.equal(calls.length, 0);
  assert.equal(root.moveWindowToDrawer({ address: 'abc123' }), true);
  assert.deepEqual(calls, ['hl.dsp.window.move({ workspace = "special:scratchpad", window = "address:0xabc123", follow = false })']);
});

test('a drawer window can move back out to a numbered or new workspace', () => {
  const { root, calls } = setup();
  const window = { address: '0xabc123', workspace: { id: -7 } };
  assert.equal(root.moveWindowToWorkspace(window, 3), true);
  assert.match(calls[0], /workspace = "3"/);
  assert.equal(root.moveWindowToWorkspace(window, -2), false);
  assert.equal(root.moveWindowToWorkspace(window, 11), false);
});

test('keyboard reaches the separate drawer row without confusing it with +', () => {
  const { root, calls } = setup();
  root.selectedCardIndex = 1;
  root.moveCardSelection(0, 1);
  assert.equal(root.selectedCardIndex, 3);
  root.activateSelectedCard();
  assert.match(calls[0], /toggle_special/);
  root.moveCardSelection(1, 0);
  assert.equal(root.selectedCardIndex, 3);
  root.moveCardSelection(0, -1);
  assert.equal(root.selectedCardIndex, 2);
  root.activateSelectedCard();
  assert.equal(calls[1], 3);
  root.showDrawer = false;
  root.moveCardSelection(0, 1);
  assert.equal(root.selectedCardIndex, 2);
});
