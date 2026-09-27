const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = { document: { addEventListener() {} } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../javascripts/papers.js'), 'utf8'), context);
const records = [
  { index: 0, year: 2024, language: 'cnkiPapers', pmid: 999, impact: null, citations: null },
  { index: 1, year: 2024, language: 'pubmedPapers', pmid: 100, impact: 3, citations: 0 },
  { index: 2, year: 2025, language: 'cnkiPapers', pmid: 0, impact: null, citations: null },
  { index: 3, year: 2024, language: 'pubmedPapers', pmid: 200, impact: 3, citations: 10 },
  { index: 4, year: 2024, language: 'cnkiPapers', pmid: 9999, impact: 6, citations: 10 },
  { index: 5, year: 2026, language: 'pubmedPapers', pmid: 0, impact: 0, citations: null }
];
const order = (mode, input = records) => [...input].sort((a, b) => context.comparePaperRecords(a, b, mode));
const indices = list => list.map(record => record.index);
test('default restores immutable source order after another sort', () => {
  assert.deepEqual(indices(order('default', order('impact'))), [0, 1, 2, 3, 4, 5]);
});
test('year desc, English before Chinese within year, PMID desc, Chinese stable', () => {
  assert.deepEqual(indices(order('year')), [5, 2, 3, 1, 0, 4]);
});
test('impact desc, chronological ties, missing values last, including zero IF', () => {
  assert.deepEqual(indices(order('impact')), [4, 3, 1, 5, 2, 0]);
});
test('citations desc, chronological ties, zero precedes missing values', () => {
  assert.deepEqual(indices(order('citations')), [3, 4, 1, 5, 2, 0]);
});
