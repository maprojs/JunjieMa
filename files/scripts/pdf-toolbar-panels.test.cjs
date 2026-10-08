const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../pdfViewer/javascripts/pdf-viewer.js'), 'utf8');
const helper = source.slice(source.indexOf('const toolbarPanelCloseTimers'), source.indexOf('function updateToolbarLayout'));

function fixture() {
  const classes = new Set();
  const toolbarClasses = new Set(['is-page-compact']);
  const pending = new Map();
  const document = { activeElement: null };
  let nextTimer = 0;
  let reducedMotion = false;
  const panel = {
    hidden: true, inert: true, offsetWidth: 120,
    classList: { contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name) },
    contains: element => element === panel
  };
  const toggle = {
    expanded: 'false', setAttribute: (key, value) => { toggle.expanded = value; },
    focus: () => { document.activeElement = toggle; }
  };
  const context = vm.createContext({
    document, toolbar: { classList: { contains: name => toolbarClasses.has(name) } },
    matchMedia: () => ({ matches: reducedMotion }),
    setTimeout: (callback, delay) => { assert.equal(delay, 180); pending.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: timer => pending.delete(timer)
  });
  vm.runInContext(helper, context);
  return {
    panel, toggle, document, pending, classes,
    set: open => context.setToolbarPanelExpanded(panel, toggle, open),
    desktop: () => toolbarClasses.clear(), reduced: () => { reducedMotion = true; },
    finish: () => { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback()); }
  };
}

test('closing animates before hiding and immediately removes keyboard interaction', () => {
  const f = fixture();
  f.set(true);
  assert.equal(f.panel.hidden, false);
  assert.equal(f.panel.inert, false);
  assert.equal(f.classes.has('show'), true);
  f.document.activeElement = f.panel;
  f.set(false);
  assert.equal(f.toggle.expanded, 'false');
  assert.equal(f.panel.hidden, false);
  assert.equal(f.panel.inert, true);
  assert.equal(f.document.activeElement, f.toggle);
  assert.equal(f.classes.has('show'), false);
  f.set(false);
  assert.equal(f.panel.hidden, false);
  assert.equal(f.pending.size, 1);
  f.finish();
  assert.equal(f.panel.hidden, true);
});

test('reopening during folding cancels the pending hide', () => {
  const f = fixture();
  f.set(true);
  f.set(false);
  f.set(true);
  assert.equal(f.pending.size, 0);
  f.finish();
  assert.equal(f.panel.hidden, false);
  assert.equal(f.panel.inert, false);
  assert.equal(f.toggle.expanded, 'true');
});

test('switching to desktop during folding restores inline controls', () => {
  const f = fixture();
  f.set(true);
  f.set(false);
  f.desktop();
  f.set(false);
  f.finish();
  assert.equal(f.panel.hidden, false);
  assert.equal(f.panel.inert, false);
  assert.equal(f.classes.has('show'), false);
});

test('initial collapsed panels and reduced-motion exits hide immediately', () => {
  const f = fixture();
  f.set(false);
  assert.equal(f.panel.hidden, true);
  assert.equal(f.pending.size, 0);
  f.reduced();
  f.set(true);
  f.set(false);
  assert.equal(f.panel.hidden, true);
  assert.equal(f.pending.size, 0);
});
