const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const readerRoot = path.join(__dirname, '../../pdfViewer');
const helper = fs.readFileSync(path.join(readerRoot, 'javascripts/pdf-zoom.js'), 'utf8');
const pdfjs = fs.readFileSync(path.join(readerRoot, 'pdfjs/build/pdf.mjs'), 'utf8');
// Exercise the shipped touch manager without loading the browser-only canvas engine.
const touchSource = pdfjs.slice(pdfjs.indexOf('class TouchManager {'), pdfjs.indexOf(';// ./src/display/editor/editor.js'));
const TouchManager = vm.runInNewContext(touchSource + '\nTouchManager;', {
  AbortController, AbortSignal, OutputScale: { pixelRatio: 1 },
  stopEvent(event) { event.preventDefault(); event.stopPropagation(); }
});
const bindPDFZoomGestures = vm.runInNewContext(helper.replaceAll('export ', '') + '\nbindPDFZoomGestures;', {
  setTimeout, clearTimeout
});

function fixture() {
  const container = new EventTarget();
  container.clientHeight = 600;
  container.getBoundingClientRect = () => ({ left: 200, top: 140 });
  const calls = [];
  let refreshes = 0;
  const viewer = {
    currentScale: 1, containerTopLeft: [0, 200],
    updateScale(options) {
      calls.push(options);
      this.currentScale = Math.round(this.currentScale * options.scaleFactor * 100) / 100;
    },
    refresh() { refreshes++; }
  };
  let ready = true;
  const controller = new AbortController();
  bindPDFZoomGestures({ container, viewer, TouchManager, isReady: () => ready, signal: controller.signal });
  const send = (type, properties = {}) => {
    const { cancelable = true, ...fields } = properties;
    const event = new Event(type, { cancelable });
    Object.assign(event, fields);
    container.dispatchEvent(event);
    return event;
  };
  return {
    viewer, calls, send, controller,
    setReady(value) { ready = value; },
    get refreshes() { return refreshes; }
  };
}
function wheel(f, properties = {}) {
  return f.send('wheel', { deltaMode: 0, deltaY: -10, clientX: 500, clientY: 340, ...properties });
}
function touch(identifier, x, y = 340) {
  return { identifier, clientX: x, clientY: y, screenX: x + 20, screenY: y + 80 };
}

test('plain wheel and single-finger scrolling stay native; loading ignores zoom', () => {
  const f = fixture();
  assert.equal(wheel(f).defaultPrevented, false);
  assert.equal(f.send('touchstart', { touches: [touch(0, 400)] }).defaultPrevented, false);
  assert.equal(f.send('touchmove', { touches: [touch(0, 420)] }).defaultPrevented, false);
  f.setReady(false);
  assert.equal(wheel(f, { ctrlKey: true }).defaultPrevented, false);
  assert.equal(f.send('touchstart', { touches: [touch(0, 400), touch(1, 600)] }).defaultPrevented, false);
  assert.equal(f.calls.length, 0);
  f.controller.abort();
});

test('Ctrl/Meta wheel zooms PDF around the pointer inside its nested workspace', () => {
  const f = fixture();
  assert.equal(wheel(f, { ctrlKey: true }).defaultPrevented, true);
  assert(f.viewer.currentScale > 1);
  assert.deepEqual(Array.from(f.calls[0].origin), [500, 200]);
  assert.equal(f.calls[0].drawingDelay, 150);
  wheel(f, { metaKey: true, deltaY: 10 });
  assert.equal(f.viewer.currentScale, 1);
  f.controller.abort();
});

test('small trackpad deltas accumulate instead of disappearing in PDF.js rounding', () => {
  const f = fixture();
  for (let i = 0; i < 40; i++) wheel(f, { ctrlKey: true, deltaY: -.02 });
  assert.equal(f.viewer.currentScale, 1.01);
  // Toolbar changes must replace the accumulated gesture scale.
  f.viewer.currentScale = 2;
  wheel(f, { ctrlKey: true, deltaY: -10 });
  assert.equal(f.viewer.currentScale, 2.21);
  f.controller.abort();
});

test('zoom limits match the toolbar, suppress browser zoom, and allow reversing', () => {
  const f = fixture();
  f.viewer.currentScale = 10;
  assert.equal(wheel(f, { ctrlKey: true, deltaY: -100 }).defaultPrevented, true);
  assert.equal(f.viewer.currentScale, 10);
  wheel(f, { ctrlKey: true, deltaY: 10 });
  assert(f.viewer.currentScale < 10);
  f.viewer.currentScale = .25;
  wheel(f, { ctrlKey: true, deltaY: 100 });
  assert.equal(f.viewer.currentScale, .25);
  wheel(f, { ctrlKey: true, deltaY: -10 });
  assert(f.viewer.currentScale > .25);
  f.controller.abort();
});

test('line/page wheel deltas are normalized and noncancelable wheel stays native', () => {
  const f = fixture();
  wheel(f, { ctrlKey: true, deltaMode: 1, deltaY: -1 });
  assert.equal(f.viewer.currentScale, 1.35);
  wheel(f, { ctrlKey: true, deltaMode: 2, deltaY: -1 });
  assert.equal(f.viewer.currentScale, 3.67);
  // No listener-driven zoom can safely override a noncancelable browser action.
  const count = f.calls.length;
  f.send('wheel', { ctrlKey: true, deltaY: -100, cancelable: false });
  assert.equal(f.calls.length, count);
  f.controller.abort();
});

test('shipped touch manager changes PDF scale, converts screen coordinates, and refreshes on release', () => {
  const f = fixture();
  assert.equal(f.send('touchstart', { touches: [touch(0, 400), touch(1, 600)] }).defaultPrevented, true);
  // PDF.js first distinguishes a pinch from parallel two-finger movement.
  f.send('touchmove', { touches: [touch(0, 380), touch(1, 620)] });
  f.send('touchmove', { touches: [touch(1, 650), touch(0, 350)] });
  assert.equal(f.viewer.currentScale, 1.25);
  assert.deepEqual(Array.from(f.calls[0].origin), [500, 200]);
  f.send('touchend', { touches: [touch(0, 350)] });
  assert.equal(f.refreshes, 1);
  const count = f.calls.length;
  assert.equal(f.send('touchmove', { touches: [touch(0, 400)] }).defaultPrevented, false);
  assert.equal(f.calls.length, count);
  f.controller.abort();
});

test('pinch cancel restores rendering and aborted listeners no longer intercept gestures', () => {
  const f = fixture();
  f.send('touchstart', { touches: [touch(0, 400), touch(1, 600)] });
  f.send('touchmove', { touches: [touch(0, 380), touch(1, 620)] });
  f.send('touchmove', { touches: [touch(0, 350), touch(1, 650)] });
  f.send('touchcancel', { touches: [] });
  assert.equal(f.refreshes, 1);
  f.controller.abort();
  assert.equal(wheel(f, { ctrlKey: true }).defaultPrevented, false);
  assert.equal(f.send('touchstart', { touches: [touch(0, 400), touch(1, 600)] }).defaultPrevented, false);
});
