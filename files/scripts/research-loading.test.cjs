const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = name => fs.readFileSync(path.join(__dirname, '../../javascripts', name), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

function include(id) {
  return {
    dataset: { researchSection: id }, attributes: new Map(), children: [], replacement: null,
    matches: () => true, querySelectorAll: () => [],
    getAttribute: () => `files/content/publications/${id}.html`,
    hasAttribute: name => name === 'data-manual',
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); },
    replaceWith(fragment) { this.replacement = fragment; },
    replaceChildren(...children) { this.children = children; },
    append(child) { this.children.push(child); }
  };
}

test('HTML loading prepares all fragments before replacing tags and permits retry after failure', async () => {
  const window = {};
  let fail = true;
  const elements = [include('papers'), include('patents')];
  const document = {
    readyState: 'loading', addEventListener() {},
    createElement: () => ({ content: {} })
  };
  vm.runInNewContext(source('add-file.js'), {
    window, document, AbortSignal, console,
    fetch: async file => ({ ok: !(fail && file.includes('patents')), status: 503, text: async () => file })
  });
  const root = { querySelectorAll: () => elements };
  await assert.rejects(window.loadAddFiles(root), /HTTP 503/);
  assert(elements.every(element => element.replacement === null && !element.attributes.has('aria-busy')));
  fail = false;
  let prepared = 0;
  const count = await window.loadAddFiles(root, { prepare() {
    assert(elements.every(element => element.replacement === null));
    prepared++;
  } });
  assert.equal(count, 2);
  assert.equal(prepared, 2);
  assert(elements.every(element => element.replacement && !element.attributes.has('aria-busy')));
});

test('research loads independently, waits to initialize papers, and retries without duplicate initialization', async () => {
  const elements = ['papers', 'patents', 'funding'].map(include);
  const requests = new Map();
  const initializers = [];
  const listeners = new Map();
  let alignments = 0;
  const window = {
    addEventListener(name, handler) { listeners.set(name, handler); },
    initializePaperCitations() { initializers.push('citations'); },
    loadAddFiles: element => new Promise((resolve, reject) => {
      requests.set(element.dataset.researchSection, { resolve, reject });
    })
  };
  const document = {
    addEventListener(name, handler) { listeners.set(name, handler); },
    querySelectorAll: () => elements,
    getElementById: () => ({ scrollIntoView() { alignments++; } }),
    createElement: () => ({
      children: [],
      append(...children) { this.children.push(...children); },
      addEventListener(name, handler) { this[name] = handler; },
      setAttribute() {}
    })
  };
  vm.runInNewContext(source('research.js'), {
    window, document, location: { hash: '#funding' }, requestAnimationFrame: callback => callback(),
    console: { error() {} }, initializeResearchCards() {},
    initializePaperFilters() { initializers.push('filters'); },
    initializePaperPagination() { initializers.push('pagination'); }
  });
  listeners.get('DOMContentLoaded')();
  assert.equal(requests.size, 3);
  assert.deepEqual(initializers, []);
  requests.get('funding').resolve(1);
  requests.get('patents').reject(Error('Offline'));
  await tick();
  assert.deepEqual(initializers, []);
  assert.equal(alignments, 0);
  requests.get('papers').resolve(1);
  await tick();
  assert.deepEqual(initializers, ['filters', 'citations', 'pagination']);
  assert(alignments > 0);
  const retry = elements[1].children[1];
  assert.equal(retry.textContent, 'Retry');
  retry.click();
  const aligned = alignments;
  listeners.get('wheel')();
  requests.get('patents').resolve(1);
  await tick();
  assert.deepEqual(initializers, ['filters', 'citations', 'pagination']);
  assert.equal(alignments, aligned);
});
