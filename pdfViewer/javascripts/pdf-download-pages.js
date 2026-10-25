/* Copy selected original PDF pages; never render them to images. */
export function parsePageSelection(value, total) {
  // Treat a final separator (and whitespace after it) as an unfinished delimiter, not a page.
  value = value.trim().replace(/[,，、]\s*$/, '');
  if (!value.trim()) throw new Error('empty');
  const selected = new Set();
  for (const part of value.split(/[,，、]/)) {
    const match = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(part);
    if (!match) throw new Error('format');
    const first = Number(match[1]);
    const last = Number(match[2] || match[1]);
    if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < 1 || last > total) throw new Error('bounds');
    if (first > last) throw new Error('reversed');
    for (let n = first; n <= last; n++) selected.add(n - 1);
  }
  return [...selected].sort((a, b) => a - b);
}

export function pageSelectionLabel(pages) {
  const ranges = [];
  for (let i = 0; i < pages.length; i++) {
    const first = pages[i] + 1;
    let last = first;
    while (i + 1 < pages.length && pages[i + 1] === pages[i] + 1) last = pages[++i] + 1;
    ranges.push(first === last ? String(first) : `${first}-${last}`);
  }
  return ranges.join('_');
}

export function createPartialDownload({ getDocument, getBytes, getFilename }) {
  const text = {
    prompt: 'Save selected pages?', toggle: 'Enter pages to download', pages: 'Pages',
    placeholder: 'e.g. 1-3、5、8-10', download: 'Download selected pages',
    hint: 'Ranges: 1-3; separators: 、，,', loading: 'Loading document…',
    close: 'Close', clear: 'Clear pages', first: 'Save first page', odd: 'Odd pages', even: 'Even pages',
    generating: 'Creating PDF…', complete: 'Selected pages downloaded.',
    empty: 'Enter the pages to save.', format: 'Use a format such as 1-3、5、8-10.',
    reversed: 'The start page must not exceed the end page.',
    bounds: total => `Pages must be between 1 and ${total}.`,
    count: n => `${n} page${n === 1 ? '' : 's'} selected; separators: 、，,`,
    failed: 'Could not extract these pages. Please try another PDF.',
    encrypted: 'This encrypted PDF cannot be split. Download the original file instead.'
  };
  const anchor = document.getElementById('pdfDownload');
  const panel = document.createElement('div');
  panel.id = 'pdfPartialDownload';
  panel.className = 'pdf-partial-download';
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', text.prompt);
  panel.innerHTML = `<div class="pdf-partial-heading"><button id="pdfPartialToggle" class="pdf-partial-toggle" type="button" aria-controls="pdfPartialForm" aria-expanded="false"></button><button id="pdfPartialClose" class="pdf-icon-button" type="button"><svg aria-hidden="true"><use href="icon/viewer-icons.svg#icon-close"/></svg></button></div>
    <form id="pdfPartialForm" hidden novalidate><div class="pdf-partial-input-row"><div class="pdf-partial-field"><input id="pdfPartialPages" type="text" maxlength="512" autocomplete="off" spellcheck="false" aria-describedby="pdfPartialMessage"><div class="pdf-search-actions"><button id="pdfPartialClear" class="pdf-icon-button" type="button"><svg aria-hidden="true"><use href="icon/viewer-icons.svg#icon-circle-x"/></svg></button></div></div><button id="pdfPartialSave" class="pdf-icon-button" type="submit"><svg aria-hidden="true"><use href="icon/viewer-icons.svg#icon-save-image"/></svg></button></div><p id="pdfPartialMessage" role="status" aria-live="polite"></p>
    <div class="pdf-partial-presets"><button type="button" data-preset="first" disabled></button><button type="button" data-preset="odd" disabled></button><button type="button" data-preset="even" disabled></button></div></form>`;
  const toggle = panel.querySelector('#pdfPartialToggle');
  toggle.textContent = text.prompt;
  const form = panel.querySelector('form');
  const input = panel.querySelector('input');
  const clear = panel.querySelector('#pdfPartialClear');
  clear.title = text.clear;
  clear.setAttribute('aria-label', text.clear);
  const save = panel.querySelector('#pdfPartialSave');
  const message = panel.querySelector('p');
  const closeButton = panel.querySelector('#pdfPartialClose');
  const presets = [...panel.querySelectorAll('[data-preset]')];
  closeButton.title = text.close;
  closeButton.setAttribute('aria-label', text.close);
  for (const preset of presets) preset.textContent = text[preset.dataset.preset];
  toggle.title = text.toggle;
  toggle.setAttribute('aria-label', text.toggle);
  input.placeholder = text.placeholder;
  input.setAttribute('aria-label', text.pages);
  save.title = text.download;
  save.setAttribute('aria-label', text.download);
  document.body.append(panel);
  let total = 0;
  let busy = false;
  let disposed = false;
  let sourcePromise;
  let outsideClicks = 0;
  const downloads = new Map();

  function position() {
    if (panel.hidden) return;
    const rect = anchor.getBoundingClientRect();
    const width = panel.getBoundingClientRect().width;
    panel.style.left = Math.max(8, Math.min(rect.right - width, innerWidth - width - 8)) + 'px';
    panel.style.top = Math.max(8, Math.min(rect.bottom + 8, innerHeight - panel.offsetHeight - 8)) + 'px';
  }
  function notify(value, error = false) {
    message.textContent = value;
    input.setAttribute('aria-invalid', String(error));
    panel.classList.toggle('has-error', error);
    position();
  }
  function validate() {
    for (const preset of presets) preset.disabled = busy || !total || (preset.dataset.preset === 'even' && total < 2);
    if (busy) return;
    if (!total) { save.disabled = true; notify(text.loading); return; }
    if (!input.value.trim()) { save.disabled = true; notify(text.hint); return; }
    try {
      const pages = parsePageSelection(input.value, total);
      save.disabled = false;
      notify(text.count(pages.length));
    } catch (error) {
      save.disabled = true;
      notify(error.message === 'bounds' ? text.bounds(total) : text[error.message] || text.format, true);
    }
  }
  function hide(focus = false) {
    panel.hidden = true;
    if (focus) anchor.focus({ preventScroll: true });
  }
  function outside(event) {
    if (!event.isTrusted || panel.hidden || panel.contains(event.target) || anchor.contains(event.target)) return;
    if (++outsideClicks >= 2) hide();
  }
  function keydown(event) {
    if (!panel.hidden && event.key === 'Escape') {
      event.preventDefault(); hide(true);
    }
  }
  toggle.addEventListener('click', () => {
    form.hidden = !form.hidden;
    toggle.setAttribute('aria-expanded', String(!form.hidden));
    if (!form.hidden) { validate(); input.focus({ preventScroll: true }); }
    position();
  });
  input.addEventListener('input', validate);
  clear.addEventListener('click', () => {
    input.value = '';
    validate();
    input.focus({ preventScroll: true });
  });
  closeButton.addEventListener('click', () => hide(true));
  async function downloadPages(presetPages) {
    if (busy || !total) return;
    let pages;
    try { pages = presetPages || parsePageSelection(input.value, total); }
    catch (error) { notify(error.message === 'bounds' ? text.bounds(total) : text[error.message] || text.format, true); return; }
    busy = true;
    for (const preset of presets) preset.disabled = true;
    input.disabled = save.disabled = clear.disabled = true;
    form.setAttribute('aria-busy', 'true');
    notify(text.generating);
    // Let the status paint before parsing a large document.
    await new Promise(resolve => setTimeout(resolve, 0));
    try {
      const { PDFDocument } = await import('../vendor/pdf-lib.esm.min.js?v=1.17.1');
      if (!sourcePromise) {
        sourcePromise = getBytes().then(bytes => PDFDocument.load(bytes, { updateMetadata: false }));
        sourcePromise.catch(() => { sourcePromise = null; });
      }
      const source = await sourcePromise;
      const output = await PDFDocument.create();
      const copied = await output.copyPages(source, pages);
      copied.forEach(page => output.addPage(page));
      const title = source.getTitle();
      if (title) output.setTitle(title);
      const bytes = await output.save();
      if (disposed) return;
      const objectURL = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const link = document.createElement('a');
      const base = getFilename().replace(/\.pdf$/i, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim() || 'document';
      const label = pageSelectionLabel(pages);
      link.download = `${base}_pages_${label.length <= 80 ? label : pages.length + '-selected'}.pdf`;
      link.href = objectURL;
      document.body.append(link); link.click(); link.remove();
      // Do not revoke until the browser has had time to start the download.
      const timer = setTimeout(() => { URL.revokeObjectURL(objectURL); downloads.delete(objectURL); }, 60000);
      downloads.set(objectURL, timer);
      notify(text.complete);
    } catch (error) {
      if (!disposed) notify(/encrypt/i.test(error.message) ? text.encrypted : text.failed, true);
      console.error('PDF page download:', error);
    } finally {
      busy = false;
      if (!disposed) {
        input.disabled = save.disabled = clear.disabled = false;
        form.removeAttribute('aria-busy');
        for (const preset of presets) preset.disabled = preset.dataset.preset === 'even' && total < 2;
        position();
      }
    }
  }
  form.addEventListener('submit', event => { event.preventDefault(); void downloadPages(); });
  for (const preset of presets) preset.addEventListener('click', () => {
    if (busy || !total) return;
    const type = preset.dataset.preset;
    const pages = type === 'first' ? [0] : Array.from({ length: total }, (_, i) => i)
      .filter(i => i % 2 === (type === 'odd' ? 0 : 1));
    if (!pages.length) return;
    input.value = pages.map(i => i + 1).join('、');
    form.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    void downloadPages(pages);
  });
  document.addEventListener('click', outside);
  document.addEventListener('keydown', keydown);
  window.addEventListener('resize', position);
  const observer = new ResizeObserver(position);
  observer.observe(anchor);
  observer.observe(panel);
  const dispose = event => {
    if (event.persisted) return;
    disposed = true;
    document.removeEventListener('click', outside);
    document.removeEventListener('keydown', keydown);
    window.removeEventListener('resize', position);
    observer.disconnect();
    for (const [url, timer] of downloads) { clearTimeout(timer); URL.revokeObjectURL(url); }
    downloads.clear(); panel.remove(); sourcePromise = null;
  };
  window.addEventListener('pagehide', dispose);
  return {
    show() {
      if (disposed) return;
      panel.hidden = false;
      outsideClicks = 0;
      position();
      void getDocument().then(pdf => { if (!disposed) { total = pdf.numPages; validate(); } })
        .catch(() => { if (!disposed) { save.disabled = true; notify(text.failed, true); } });
    }
  };
}
