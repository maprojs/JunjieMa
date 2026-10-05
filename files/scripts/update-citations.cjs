// Generate the daily citation snapshot and update its frontend reference as one commit.
const fs = require('node:fs/promises');
const path = require('node:path');
const { gzipSync } = require('node:zlib');
const root = path.resolve(__dirname, '../..');
const snapshotDirectory = 'files/content/research/publications';
const frontendFile = 'javascripts/cited.js';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function extractDois(html) {
  const uncommented = html.replace(/<!--[\s\S]*?-->/g, '');
  return [...uncommented.matchAll(/\bdata-doi\s*=\s*["']([^"']+)["']/gi)]
    .map(match => match[1].replace(/&amp;/g, '&').trim().toLowerCase()).filter(Boolean);
}
function beijingDate(now) {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
async function collect(dois, { fetchImpl = fetch, sleepImpl = sleep, timeout = 15000 } = {}) {
  const citations = {}, failures = [];
  let cursor = 0;
  async function worker() {
    while (cursor < dois.length) {
      const doi = dois[cursor++];
      let error;
      // One initial attempt plus up to three retries.
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const response = await fetchImpl(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
            headers: { Accept: 'application/json', 'User-Agent': 'JunjieMa-citations/1.0 (https://junjiema.org/research.html)' },
            signal: AbortSignal.timeout(timeout)
          });
          if (!response.ok) throw Error(`HTTP ${response.status}`);
          const data = await response.json();
          const count = data.message?.['is-referenced-by-count'];
          if (!Number.isSafeInteger(count) || count < 0) throw Error('Missing or invalid citation count');
          citations[doi] = count;
          break;
        } catch (failure) {
          error = failure.message;
          if (attempt < 3) await sleepImpl(1000 * 2 ** attempt);
        }
      }
      if (!(doi in citations)) {
        citations[doi] = null;
        failures.push({ doi, attempts: 4, error });
      }
      // Three workers, each starting no faster than once per 500 ms.
      await sleepImpl(500);
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, dois.length) }, worker));
  return { citations: Object.fromEntries(dois.map(doi => [doi, citations[doi]])), failures: failures.sort((a, b) => a.doi.localeCompare(b.doi)) };
}
async function generate({ workspace = root, now = new Date(), ...collectionOptions } = {}) {
  const sources = [await fs.readFile(path.join(workspace, 'files/content/publications/papers.html'), 'utf8')];
  const dois = [...new Set(sources.flatMap(extractDois))].sort();
  if (!dois.length) throw Error('No DOI records found; keeping the previous snapshot.');
  const frontendPath = path.join(workspace, frontendFile);
  const frontend = await fs.readFile(frontendPath, 'utf8');
  const reference = /const snapshotFile = '[^']+';/g;
  if ([...frontend.matchAll(reference)].length !== 1) throw Error('Expected exactly one snapshot reference.');
  const { citations, failures } = await collect(dois, collectionOptions);
  if (failures.length === dois.length) throw Error('All citation requests failed; keeping the previous snapshot and reference.');
  const date = beijingDate(now);
  const filename = `cited-${date}.json.gz`;
  const fallbackFilename = `cited-${date}.json`;
  const data = { schemaVersion: 1, date, timezone: 'Asia/Shanghai', generatedAt: now.toISOString(), total: dois.length,
    successful: dois.length - failures.length, failed: failures.length, citations, failures };
  const directory = path.join(workspace, snapshotDirectory);
  await fs.mkdir(directory, { recursive: true });
  const destination = path.join(directory, filename);
  const fallbackDestination = path.join(directory, fallbackFilename);
  // Write both files completely before updating the reference or deleting old snapshots.
  const json = JSON.stringify(data);
  const compressed = gzipSync(json, { level: 9, mtime: 0 });
  await Promise.all([
    fs.writeFile(destination + '.tmp', compressed),
    fs.writeFile(fallbackDestination + '.tmp', json + '\n')
  ]);
  await fs.rename(destination + '.tmp', destination);
  await fs.rename(fallbackDestination + '.tmp', fallbackDestination);
  // Let an already-open page discover a newer filename when the user forces a refresh.
  const latest = JSON.stringify({ date, file: filename });
  await Promise.all([
    fs.writeFile(path.join(directory, 'latest.json'), latest + '\n'),
    fs.writeFile(path.join(directory, 'latest.json.gz'), gzipSync(latest, { level: 9, mtime: 0 }))
  ]);
  await fs.writeFile(frontendPath, frontend.replace(reference, `const snapshotFile = '${snapshotDirectory}/${filename}';`));
  for (const old of await fs.readdir(directory)) {
    if (/^cited-\d{4}-\d{2}-\d{2}\.json(?:\.gz)?$/.test(old)
      && old !== filename && old !== fallbackFilename) await fs.unlink(path.join(directory, old));
  }
  return data;
}
module.exports = { extractDois, beijingDate, collect, generate };
if (require.main === module) {
  generate().then(data => console.log(`cited-${data.date}.json.gz: ${data.successful}/${data.total} succeeded; ${data.failed} failed after 3 retries.`))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
