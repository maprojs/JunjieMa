// Daily snapshots and explicitly requested live counts use the same card markup.
(() => {
  // Updated by files/scripts/update-citations.cjs together with the snapshot.
  const snapshotFile = 'files/content/research/publications/cited-2026-09-30.json.gz';
  const directory = 'files/content/research/publications/';
  const validCount = count => Number.isSafeInteger(count) && count >= 0;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function readJson(file, refresh) {
    const read = async compressed => {
      if (compressed && !('DecompressionStream' in window)) throw Error('No gzip support');
      const response = await fetch(compressed ? file : file.replace(/\.gz$/, ''), {
        cache: refresh ? 'reload' : 'default', signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      return compressed
        ? JSON.parse(await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).text())
        : response.json();
    };
    try { return await read(true); } catch { return read(false); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const spans = [...document.querySelectorAll('.cited[data-doi]')];
    if (!spans.length) return;
    const dois = [...new Set(spans.map(span => span.dataset.doi.trim().toLowerCase()).filter(Boolean))];
    const version = document.getElementById('citeVer');
    const sourceLabel = document.getElementById('citeSourceLabel');
    const versionPopup = document.getElementById('citeVersionPopup');
    const latestVersion = document.getElementById('citeLatestVersion');
    const localSchedule = document.getElementById('citeLocalSchedule');
    function updateLocalSchedule() {
      const now = new Date();
      // Convert the next scheduled run, so daylight-saving offsets are correct.
      const nextRun = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const formatter = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      });
      const parts = formatter.formatToParts(nextRun);
      const part = type => parts.find(value => value.type === type)?.value || '';
      const zone = formatter.resolvedOptions().timeZone;
      localSchedule.textContent = `${part('hour')}:${part('minute')} in ${zone}`;
    }
    updateLocalSchedule();
    // A body-level popup avoids clipping and transformed paper/Note ancestors.
    document.body.append(versionPopup);
    function positionVersionPopup() {
      if (versionPopup.hidden) return;
      const viewport = window.visualViewport;
      const margin = 12, gap = 7;
      const left = (viewport?.offsetLeft || 0) + margin;
      const top = (viewport?.offsetTop || 0) + margin;
      const width = viewport?.width || document.documentElement.clientWidth;
      const height = viewport?.height || document.documentElement.clientHeight;
      const right = left + width - margin * 2;
      const bottom = top + height - margin * 2;
      versionPopup.style.maxWidth = `${Math.max(0, Math.min(320, width - margin * 2))}px`;
      versionPopup.style.maxHeight = `${Math.max(0, height - margin * 2)}px`;
      const anchor = version.getBoundingClientRect();
      const box = versionPopup.getBoundingClientRect();
      const below = bottom - anchor.bottom - gap;
      const above = anchor.top - gap - top;
      const placeBelow = below >= box.height || below >= above;
      versionPopup.style.maxHeight = `${Math.max(0, placeBelow ? below : above)}px`;
      const popupHeight = versionPopup.getBoundingClientRect().height;
      const y = placeBelow ? anchor.bottom + gap : anchor.top - gap - popupHeight;
      versionPopup.style.left = `${Math.max(left, Math.min(anchor.left, right - box.width))}px`;
      versionPopup.style.top = `${Math.max(top, Math.min(y, bottom - popupHeight))}px`;
    }
    function closeVersionPopup() {
      versionPopup.hidden = true;
      version.setAttribute('aria-expanded', 'false');
    }
    version.addEventListener('click', () => {
      const open = versionPopup.hidden;
      versionPopup.hidden = !open;
      version.setAttribute('aria-expanded', String(open));
      if (open) {
        updateLocalSchedule();
        positionVersionPopup();
      }
    });
    document.addEventListener('pointerdown', event => {
      if (!version.contains(event.target) && !versionPopup.contains(event.target)) closeVersionPopup();
    });
    document.addEventListener('focusin', event => {
      if (!version.contains(event.target) && !versionPopup.contains(event.target)) closeVersionPopup();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !versionPopup.hidden) {
        closeVersionPopup();
        version.focus({ preventScroll: true });
      }
    });
    window.addEventListener('resize', positionVersionPopup);
    window.addEventListener('scroll', positionVersionPopup, { passive: true, capture: true });
    window.visualViewport?.addEventListener('resize', positionVersionPopup);
    window.visualViewport?.addEventListener('scroll', positionVersionPopup);
    const status = document.getElementById('citationStatus');
    const refreshButton = document.getElementById('refreshCiteSnapshot');
    const liveButton = document.getElementById('fetchLiveCites');
    const indices = document.getElementById('paperIndices');
    let matchingPapers = [...document.querySelectorAll('#pubmedPapers .research-card, #cnkiPapers .research-card')];
    let currentCitations = {};
    let busy = false;

    function updateIndices() {
      if (!indices) return;
      // Use all filtered papers, including those on other pagination pages.
      const filteredDois = new Set(matchingPapers.map(paper =>
        paper.querySelector('.cited[data-doi]')?.dataset.doi.trim().toLowerCase()
      ).filter(Boolean));
      const counts = [...filteredDois].map(doi => currentCitations[doi])
        .filter(validCount).sort((a, b) => b - a);
      let h = 0, g = 0, total = 0;
      counts.forEach((count, index) => {
        const rank = index + 1;
        total += count;
        if (count >= rank) h = rank;
        if (total >= rank * rank) g = rank;
      });
      const i10 = counts.filter(count => count >= 10).length;
      indices.textContent = counts.length
        ? `h-index: ${h}, g-index: ${g}, i10-index: ${i10} (${counts.length} papers used)`
        : 'h-index: N/A, g-index: N/A, i10-index: N/A (0 papers used)';
    }
    document.addEventListener('papers:filtered', event => {
      matchingPapers = event.detail;
      updateIndices();
    });

    function paint(citations, source) {
      currentCitations = citations;
      spans.forEach(span => {
        const count = citations[span.dataset.doi.trim().toLowerCase()];
        span.textContent = validCount(count) ? String(count) : '-';
        span.dataset.citationSource = source;
        span.title = validCount(count) ? `Crossref · ${source}` : 'Citation count unavailable';
      });
      updateIndices();
      document.dispatchEvent(new CustomEvent('papers:citations-updated'));
    }
    async function run(action) {
      if (busy) return;
      busy = true;
      refreshButton.disabled = liveButton.disabled = true;
      try { await action(); }
      catch {
        // Preserve the last successfully displayed data if a refresh fails.
        status.textContent = 'Update failed; displayed counts are unchanged. Try again or fetch online.';
      } finally {
        busy = false;
        refreshButton.disabled = liveButton.disabled = false;
      }
    }
    async function snapshot(refresh = false) {
      status.textContent = 'Loading daily snapshot…';
      let file = snapshotFile;
      try {
        const latest = await readJson(directory + 'latest.json.gz', refresh);
        if (!/^cited-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(latest?.file)) throw Error('Invalid filename');
        file = directory + latest.file;
      } catch (error) {
        if (refresh) throw error;
      }
      const data = await readJson(file, refresh);
      if (data?.schemaVersion !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)
        || !data.generatedAt || Number.isNaN(Date.parse(data.generatedAt))
        || !data.citations || typeof data.citations !== 'object' || Array.isArray(data.citations)
        || Object.values(data.citations).some(count => count !== null && !validCount(count))) {
        throw Error('Invalid snapshot');
      }
      paint(data.citations, 'daily snapshot');
      sourceLabel.textContent = 'Snapshot: ';
      version.textContent = data.date;
      version.disabled = false;
      const localDateParts = new Intl.DateTimeFormat('en-GB', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(new Date(data.generatedAt));
      latestVersion.textContent = ['year', 'month', 'day']
        .map(type => localDateParts.find(part => part.type === type).value).join('-');
      positionVersionPopup();
      status.textContent = '';
    }
    async function live() {
      const citations = {};
      let cursor = 0, done = 0;
      status.textContent = `Fetching online: 0/${dois.length}…`;
      async function worker() {
        while (cursor < dois.length) {
          const doi = dois[cursor++];
          try {
            const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
              cache: 'no-store', signal: AbortSignal.timeout(15000)
            });
            if (!response.ok) throw Error(`HTTP ${response.status}`);
            const count = (await response.json()).message?.['is-referenced-by-count'];
            citations[doi] = validCount(count) ? count : null;
          } catch { citations[doi] = null; }
          status.textContent = `Fetching online: ${++done}/${dois.length}…`;
          await sleep(500);
        }
      }
      await Promise.all(Array.from({ length: Math.min(2, dois.length) }, worker));
      if (!Object.values(citations).some(validCount)) throw Error('All requests failed');
      paint(citations, 'online');
      sourceLabel.textContent = 'Live counts · Snapshot: ';
      status.textContent = '';
    }
    refreshButton.addEventListener('click', () => run(() => snapshot(true)));
    liveButton.addEventListener('click', () => run(live));
    run(async () => {
      try { await snapshot(); }
      catch (error) { version.textContent = 'Snapshot unavailable'; throw error; }
    });
  });
})();
