/* Opt in with <a href="document.pdf" viewPDF>PDF</a> on any page.
 * Source HTML keeps its PDF href and target; Ctrl-click/context menus work.
 */
(() => {
  'use strict';
  const script = document.currentScript;
  if (!script || window.ViewPDF) return;
  const viewerURL = new URL('../pdfViewer/', script.src);
  const originals = new WeakMap();

  function sourceFor(anchor) {
    const raw = anchor.getAttribute('href');
    const previous = originals.get(anchor);
    if (previous && raw === previous.viewer) return previous.source;
    try {
      const source = new URL(raw, document.baseURI);
      if (!raw || source.origin !== location.origin || !/^https?:$/.test(source.protocol)
        || !source.pathname.toLowerCase().endsWith('.pdf')) return null;
      return source;
    } catch { return null; }
  }

  function prepare(anchor, navigating = false) {
    const source = sourceFor(anchor);
    if (!source) return;
    const url = new URL(viewerURL);
    url.searchParams.set('file', source.pathname + source.search);
    if (source.hash) url.hash = source.hash;
    const card = anchor.closest('.research-card');
    const heading = card?.querySelector('h3');
    let filename = source.pathname.split('/').pop();
    try { filename = decodeURIComponent(filename); } catch { /* Keep the original filename. */ }
    const title = anchor.getAttribute('data-pdf-title')
      || heading?.textContent.trim()
      || (anchor.textContent.trim() !== 'PDF' ? anchor.textContent.trim() : '')
      || filename;
    const authors = card?.querySelector('author');
    const authorText = anchor.getAttribute('data-pdf-author')
      || authors?.textContent
      || '';
    const firstAuthor = authorText.split(/[,，;；、]/)[0].trim()
      .replace(/[\s†‡*＊\d⁰¹²³⁴⁵⁶⁷⁸⁹]+$/u, '').replace(/\s+/g, ' ');
    const journal = anchor.getAttribute('data-pdf-journal')?.trim()
      || card?.querySelector('jt')?.textContent.trim();
    const year = anchor.getAttribute('data-pdf-year')?.trim()
      || card?.querySelector('p b')?.textContent.trim();
    url.searchParams.set('title', title.slice(0, 1000));
    const metadata = [
      firstAuthor ? firstAuthor.slice(0, 200) + ', et al.' : '',
      journal ? journal.slice(0, 300).replace(/\.+$/, '') + '.' : '',
      year ? year.slice(0, 20) : ''
    ].filter(Boolean).join(' ');
    if (metadata) url.searchParams.set('meta', metadata);
    const back = new URL(location.href);
    back.searchParams.delete('pdfReturn');
    if (navigating) {
      const token = Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
      try {
        // Shared across tabs even when the original link uses rel=noopener.
        localStorage.setItem('pdf-return:' + token, JSON.stringify({
          url: back.href, y: window.scrollY, time: Date.now()
        }));
        back.searchParams.set('pdfReturn', token);
      } catch { /* Navigation still works with storage disabled. */ }
    }
    url.searchParams.set('return', back.pathname + back.search + back.hash);
    const previous = originals.get(anchor);
    originals.set(anchor, { source, viewer: url.href });
    if (previous?.viewer !== url.href || anchor.href !== url.href) anchor.href = url.href;
  }

  function scan(root) {
    if (root.matches?.('a[viewPDF]')) prepare(root);
    root.querySelectorAll?.('a[viewPDF]').forEach(anchor => prepare(anchor));
  }
  function refresh(event) {
    const anchor = event.target.closest?.('a[viewPDF]');
    if (anchor) prepare(anchor, event.type === 'click' || event.type === 'auxclick');
  }
  document.addEventListener('click', refresh, true);
  document.addEventListener('auxclick', refresh, true);
  document.addEventListener('contextmenu', refresh, true);
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') {
        const anchor = record.target;
        if (anchor.matches('a[viewPDF]')) {
          const known = originals.get(anchor);
          if (anchor.getAttribute('href') !== known?.viewer) prepare(anchor);
        } else if (originals.has(anchor)) {
          anchor.href = originals.get(anchor).source.href;
          originals.delete(anchor);
        }
      } else record.addedNodes.forEach(node => { if (node.nodeType === 1) scan(node); });
    }
  }).observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'viewpdf']
  });
  scan(document);

  function restoreReturn() {
    const url = new URL(location.href);
    const token = url.searchParams.get('pdfReturn');
    if (!token) return;
    url.searchParams.delete('pdfReturn');
    history.replaceState(history.state, '', url);
    let state;
    try {
      state = JSON.parse(localStorage.getItem('pdf-return:' + token));
      localStorage.removeItem('pdf-return:' + token);
    } catch { return; }
    if (!state || state.url !== url.href || Date.now() - state.time > 3600000
      || !Number.isFinite(state.y) || state.y < 0) return;
    const deadline = Date.now() + 12000;
    let cancelled = false;
    const cancel = () => { cancelled = true; };
    ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(type => {
      document.addEventListener(type, cancel, { once: true, passive: true });
    });
    function restore() {
      if (cancelled) return;
      const ready = !document.querySelector('[aria-busy="true"]')
        && document.documentElement.scrollHeight - innerHeight >= state.y - 2;
      if (ready || Date.now() >= deadline) {
        requestAnimationFrame(() => {
          if (!cancelled) window.scrollTo({ top: state.y, behavior: 'instant' });
        });
      } else setTimeout(restore, 100);
    }
    requestAnimationFrame(restore);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreReturn, { once: true });
  } else restoreReturn();
  window.ViewPDF = Object.freeze({ refresh: () => scan(document) });
})();
