const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { gunzipSync } = require('node:zlib');
const { extractDois, beijingDate, collect, generate } = require('./update-citations.cjs');

test('ignores commented papers and uses the Beijing calendar date', () => {
  assert.deepEqual(extractDois('<!-- <span data-doi="ignored"> --><span data-doi=" 10.X/ABC ">'), ['10.x/abc']);
  assert.equal(beijingDate(new Date('2026-09-27T16:01:00Z')), '2026-09-28');
});

test('retries failures, preserves zero, and never converts missing counts into zero', async () => {
  const attempts = {};
  const result = await collect(['zero', 'retry', 'missing'], {
    sleepImpl: async () => {},
    fetchImpl: async url => {
      const doi = url.split('/').pop();
      attempts[doi] = (attempts[doi] || 0) + 1;
      if (doi === 'retry' && attempts[doi] < 3) throw Error('Temporary failure');
      return { ok: true, json: async () => ({ message: doi === 'missing' ? {} : { 'is-referenced-by-count': doi === 'zero' ? 0 : 7 } }) };
    }
  });
  assert.deepEqual(result.citations, { zero: 0, retry: 7, missing: null });
  assert.equal(attempts.retry, 3);
  assert.equal(attempts.missing, 4);
});

test('publishes consistent gzip/JSON snapshots and preserves files on total failure', async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'junjiema-citations-'));
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  await fs.mkdir(path.join(workspace, 'javascripts'));
  const frontend = path.join(workspace, 'javascripts/cited.js');
  await fs.writeFile(frontend, "const snapshotFile = 'old.json.gz';");
  await fs.writeFile(path.join(workspace, 'research.html'), '<span data-doi="10.a/b"><span data-doi="10.a/b">');
  const options = { workspace, now: new Date('2026-09-27T16:01:00Z'), sleepImpl: async () => {} };
  const result = await generate({ ...options, fetchImpl: async () => ({ ok: true, json: async () => ({ message: { 'is-referenced-by-count': 0 } }) }) });
  assert.equal(result.total, 1);
  const directory = path.join(workspace, 'files/content/research/publications');
  const latest = JSON.parse(await fs.readFile(path.join(directory, 'latest.json')));
  const compressed = await fs.readFile(path.join(directory, latest.file));
  assert.deepEqual(JSON.parse(gunzipSync(compressed)), result);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory, latest.file.replace(/\.gz$/, '')))), result);
  const before = await fs.readFile(frontend, 'utf8');
  assert.match(before, /cited-2026-09-28\.json\.gz/);
  await assert.rejects(generate({ ...options, fetchImpl: async () => { throw Error('Offline'); } }), /All citation requests failed/);
  assert.equal(await fs.readFile(frontend, 'utf8'), before);
  assert.deepEqual(await fs.readFile(path.join(directory, latest.file)), compressed);
});
