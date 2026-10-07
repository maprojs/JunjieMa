const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../pdfViewer/javascripts/pdf-viewer.js'), 'utf8');
const start = source.indexOf('  function finishInitialLoad() {');
const finish = source.slice(start, source.indexOf("  eventBus.on('pagesinit'", start));

function fixture(pages, currentPageNumber = 1, spreadMode = 0) {
  const elements = { pdfStatus: { hidden: false }, pdfPageBadge: { hidden: true } };
  const busy = {};
  const context = vm.createContext({
    ready: true, initialRenderComplete: false, renderingFailed: false,
    RenderingStates: { FINISHED: 3 }, SpreadMode: { NONE: 0 },
    viewer: { currentPageNumber, spreadMode, getPageView: index => pages[index] },
    $: id => elements[id], container: { setAttribute: (name, value) => { busy[name] = value; } },
    loadTimeout: 123, clearTimeout: id => { context.clearedTimeout = id; }
  });
  vm.runInContext(finish, context);
  return { context, elements, busy, complete: () => vm.runInContext('finishInitialLoad()', context) };
}

test('a background page finishing cannot hide loading for a different current page', () => {
  const pages = Array.from({ length: 5 }, () => ({ renderingState: 0 }));
  pages[0].renderingState = 3;
  const f = fixture(pages, 5);
  f.complete();
  assert.equal(f.elements.pdfStatus.hidden, false);
  assert.equal(f.context.clearedTimeout, undefined);
  pages[4].renderingState = 3;
  f.complete();
  assert.equal(f.elements.pdfStatus.hidden, true);
  assert.equal(f.elements.pdfPageBadge.hidden, false);
  assert.equal(f.busy['aria-busy'], 'false');
  assert.equal(f.context.clearedTimeout, 123);
});

test('current page must finish rendering, including any pending detail canvas', () => {
  const page = { renderingState: 1 };
  const f = fixture([page]);
  f.complete();
  assert.equal(f.elements.pdfStatus.hidden, false);
  page.renderingState = 3;
  page.detailView = { renderingState: 0 };
  f.complete();
  assert.equal(f.elements.pdfStatus.hidden, false);
  page.detailView.renderingState = 3;
  f.complete();
  assert.equal(f.elements.pdfStatus.hidden, true);
});

test('two-page loading waits for both pages but accepts an unpaired final page', () => {
  const pages = [{ renderingState: 3 }, { renderingState: 1 }, { renderingState: 3 }];
  const f = fixture(pages, 2, 1);
  f.complete();
  assert.equal(f.elements.pdfStatus.hidden, false);
  pages[1].renderingState = 3;
  f.complete();
  assert.equal(f.elements.pdfStatus.hidden, true);
  const final = fixture(pages, 3, 1);
  final.complete();
  assert.equal(final.elements.pdfStatus.hidden, true);
});

test('loading stays visible before initialization, for a missing page, and after a render error', () => {
  const unready = fixture([{ renderingState: 3 }]);
  unready.context.ready = false;
  unready.complete();
  assert.equal(unready.elements.pdfStatus.hidden, false);
  const missing = fixture([]);
  missing.complete();
  assert.equal(missing.elements.pdfStatus.hidden, false);
  const failed = fixture([{ renderingState: 3 }]);
  failed.context.renderingFailed = true;
  failed.complete();
  assert.equal(failed.elements.pdfStatus.hidden, false);
});

test('later completions do not dismiss a new error panel after initial loading', () => {
  const f = fixture([{ renderingState: 3 }]);
  f.complete();
  f.elements.pdfStatus.hidden = false;
  f.complete();
  assert.equal(f.elements.pdfStatus.hidden, false);
});
