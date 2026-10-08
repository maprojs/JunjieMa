const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const readerSource = fs.readFileSync(path.join(__dirname, '../../pdfViewer/javascripts/pdf-viewer.js'), 'utf8');
const parserSource = readerSource.slice(readerSource.indexOf('function readPDFMetadata('), readerSource.indexOf('const { title, meta }'));
const context = vm.createContext({ URLSearchParams });
vm.runInContext(parserSource, context);
const read = params => ({ ...context.readPDFMetadata(params) });
const linkSource = fs.readFileSync(path.join(__dirname, '../../javascripts/view-pdf.js'), 'utf8');

function prepareLink(attributes = {}, cardText = {}) {
  let href = '/files/paper.pdf#page=3';
  const card = Object.keys(cardText).length ? {
    querySelector: selector => cardText[selector] === undefined ? null : { textContent: cardText[selector] }
  } : null;
  const anchor = {
    getAttribute: key => key === 'href' ? href : attributes[key] ?? null,
    get href() { return href; },
    set href(value) { href = value; },
    closest: () => card, textContent: 'PDF'
  };
  const document = {
    currentScript: { src: 'https://example.org/javascripts/view-pdf.js' },
    baseURI: 'https://example.org/research.html', readyState: 'loading',
    documentElement: {}, addEventListener() {}, querySelectorAll: () => [anchor]
  };
  const window = {};
  vm.runInNewContext(linkSource, {
    document, window, URL, location: new URL(document.baseURI),
    MutationObserver: class { observe() {} }
  });
  window.ViewPDF.refresh();
  return new URL(href);
}

test('card metadata generates a separate title and plain-text meta', () => {
  const url = prepareLink({}, {
    h3: '细胞 "A & B" · Study', author: '张三¹*, Jane Doe',
    jt: 'Nature · Methods', 'p b': '2026'
  });
  assert.deepEqual([...url.searchParams.keys()], ['file', 'title', 'meta', 'return']);
  assert.equal(url.searchParams.get('file'), '/files/paper.pdf');
  assert.equal(url.hash, '#page=3');
  assert.deepEqual(read(url.searchParams), {
    title: '细胞 "A & B" · Study', meta: '张三, et al. Nature · Methods. 2026'
  });
});

test('explicit data attributes override the card and filename supplies a missing title', () => {
  const url = prepareLink({ 'data-pdf-title': 'Custom title', 'data-pdf-author': 'Other Author' }, { h3: 'Card title' });
  assert.equal(read(url.searchParams).title, 'Custom title');
  assert.equal(read(url.searchParams).meta, 'Other Author, et al.');
  assert.deepEqual(read(prepareLink().searchParams), { title: 'paper.pdf', meta: '' });
});

test('old separate parameters and plain-text meta links remain readable', () => {
  assert.deepEqual(read(new URLSearchParams({ title: 'Old title', author: 'Old author', meta: 'Old journal · 2025' })), {
    title: 'Old title', meta: 'Old author, et al. Old journal. 2025'
  });
  assert.equal(read(new URLSearchParams({ journal: 'Explicit journal', meta: 'Legacy journal · 2025' })).meta, 'Explicit journal. 2025');
});

test('citation format preserves the full date and does not duplicate journal punctuation', () => {
  const url = prepareLink({}, { h3: 'Study', author: 'Junjie Ma*, Other Author', jt: 'Biology Direct.', 'p b': '2026-09-23' });
  assert.equal(url.searchParams.get('meta'), 'Junjie Ma, et al. Biology Direct. 2026-09-23');
  assert.equal(read(url.searchParams).meta, url.searchParams.get('meta'));
});

test('previous JSON links remain readable and invalid JSON does not break the reader', () => {
  assert.deepEqual(read(new URLSearchParams({ meta: JSON.stringify({ title: ' New ', author: 'Junjie Ma', journal: 'Biology Direct', year: '2026-09-23' }) })), {
    title: 'New', meta: 'Junjie Ma, et al. Biology Direct. 2026-09-23'
  });
  for (const meta of ['{broken', '{"title":42,"author":{}}', '']) {
    assert.deepEqual(read(new URLSearchParams({ meta })), { title: '', meta: '' });
  }
});
