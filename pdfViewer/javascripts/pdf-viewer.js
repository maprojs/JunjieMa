/* Independent PDF reader. PDF.js, its worker, fonts and CMaps are hosted locally. */
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const siteRoot = new URL('../../', import.meta.url);
const mobile = matchMedia('(max-width: 640px)');
const title = params.get('title')?.trim();
function setTitle(text) {
  $('pdfTitleText').textContent = text;
  $('pdfTitle').title = text;
  document.title = text + ' | PDF Reader';
}
if (title) setTitle(title);
const firstAuthor = params.get('author')?.trim();
const journal = params.get('journal')?.trim() || params.get('meta')?.split(' · ')[0].trim();
const year = params.get('year')?.trim() || params.get('meta')?.split(' · ')[1]?.trim();
if (firstAuthor || journal || year) {
  $('pdfMetadata').hidden = false;
  $('pdfCitation').hidden = !(firstAuthor || journal);
  $('pdfDetails').hidden = !year;
  if (firstAuthor) {
    $('pdfAuthor').textContent = $('pdfAuthor').title = firstAuthor + ', et al';
    $('pdfAuthor').hidden = false;
  }
  if (journal) {
    $('pdfJournal').textContent = $('pdfJournal').title = journal;
    $('pdfJournal').hidden = false;
  }
  if (year) {
    $('pdfYear').textContent = year;
    $('pdfYear').hidden = false;
  }
}
let headerScrollFrame;
function updateHeaderScroll() {
  cancelAnimationFrame(headerScrollFrame);
  headerScrollFrame = requestAnimationFrame(() => {
    for (const [outerId, innerId, prefix] of [
      ['pdfTitle', 'pdfTitleText', 'title'],
      ['pdfMetadata', 'pdfMetadataContent', 'metadata']
    ]) {
      const outer = $(outerId);
      const overflow = $(innerId).scrollWidth - outer.clientWidth;
      const scroll = mobile.matches && !outer.hidden && overflow > 2;
      outer.style.setProperty(`--${prefix}-travel`, -Math.max(0, overflow) + 'px');
      outer.style.setProperty(`--${prefix}-duration`, Math.max(6, overflow / 30 + 3) + 's');
      outer.classList.toggle('is-marquee', scroll);
    }
  });
}
const headerObserver = new ResizeObserver(updateHeaderScroll);
for (const id of ['pdfTitle', 'pdfTitleText', 'pdfMetadata', 'pdfMetadataContent']) headerObserver.observe($(id));
mobile.addEventListener('change', updateHeaderScroll);
document.fonts.ready.then(updateHeaderScroll);

const toolbar = $('pdfToolbar');
const pageTools = $('pdfPageTools');
const pageControls = $('pdfPageControls');
const pageToggle = $('pdfPageToggle');
const pageInput = $('pdfPage');
const moreControls = $('pdfMoreControls');
const toolsToggle = $('pdfToolsToggle');
function syncPageInput(reset = false) {
  if (reset || document.activeElement !== pageInput) {
    pageInput.value = mobile.matches ? '' : pageInput.placeholder;
  }
}
function setPageControlsExpanded(open) {
  const expanded = toolbar.classList.contains('is-page-compact') && open;
  pageToggle.setAttribute('aria-expanded', String(expanded));
  pageControls.hidden = toolbar.classList.contains('is-page-compact') && !expanded;
  if (pageControls.hidden && pageControls.contains(document.activeElement)) pageToggle.focus({ preventScroll: true });
}
function setToolsExpanded(open) {
  const compact = toolbar.classList.contains('is-page-compact');
  toolsToggle.setAttribute('aria-expanded', String(compact && open));
  moreControls.hidden = compact && !open;
  if (moreControls.hidden && moreControls.contains(document.activeElement)) toolsToggle.focus({ preventScroll: true });
}
function updateToolbarLayout() {
  const compact = mobile.matches;
  const focused = document.activeElement;
  toolbar.classList.toggle('is-page-compact', compact);
  pageToggle.hidden = toolsToggle.hidden = !compact;
  // Entering mobile layout always starts with both panels collapsed.
  setPageControlsExpanded(false);
  setToolsExpanded(false);
  syncPageInput(true);
  if (!compact && focused === pageToggle) $('pdfPage').focus({ preventScroll: true });
  if (!compact && focused === toolsToggle) {
    moreControls.querySelector('button:not(:disabled):not([hidden])')?.focus({ preventScroll: true });
  }
}
mobile.addEventListener('change', updateToolbarLayout);
pageToggle.addEventListener('click', () => {
  const open = pageControls.hidden;
  setToolsExpanded(false);
  setPageControlsExpanded(open);
  if (open) {
    syncPageInput(true);
    pageInput.focus({ preventScroll: true });
  }
});
toolsToggle.addEventListener('click', () => {
  const open = moreControls.hidden;
  setPageControlsExpanded(false);
  setToolsExpanded(open);
});
moreControls.addEventListener('click', event => {
  if (event.target.closest('button')) setToolsExpanded(false);
});
document.addEventListener('pointerdown', event => {
  if (!pageTools.contains(event.target)) setPageControlsExpanded(false);
  if (!moreControls.contains(event.target) && !toolsToggle.contains(event.target)) setToolsExpanded(false);
});
document.addEventListener('focusin', event => {
  if (!pageTools.contains(event.target)) setPageControlsExpanded(false);
  if (!moreControls.contains(event.target) && !toolsToggle.contains(event.target)) setToolsExpanded(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && pageToggle.getAttribute('aria-expanded') === 'true') {
    setPageControlsExpanded(false);
    pageToggle.focus({ preventScroll: true });
  }
  if (event.key === 'Escape' && toolsToggle.getAttribute('aria-expanded') === 'true') {
    setToolsExpanded(false);
    toolsToggle.focus({ preventScroll: true });
  }
});
updateToolbarLayout();
try {
  const back = new URL(params.get('return') || 'research.html', siteRoot);
  if (back.origin === location.origin && /^https?:$/.test(back.protocol)
    && back.pathname !== location.pathname) {
    $('pdfBack').href = back.href;
  }
} catch { /* Keep the default link. */ }

let pdfURL;
try {
  const file = params.get('file');
  if (!file) throw new Error('Open a PDF link on the Research page, or provide a PDF file URL.');
  pdfURL = new URL(file, siteRoot);
  if (pdfURL.origin !== location.origin || !/^https?:$/.test(pdfURL.protocol)
    || !pdfURL.pathname.toLowerCase().endsWith('.pdf')) {
    throw new Error('This file URL is not supported. Please choose a PDF hosted on this website.');
  }
  pdfURL.hash = '';
} catch (error) { showError(error.message, false); }

function showError(message, retry = true) {
  $('pdfStatus').hidden = false;
  $('pdfSpinner').hidden = true;
  $('pdfStatusIcon').hidden = false;
  $('pdfProgress').hidden = true;
  $('pdfStatusTitle').textContent = 'Unable to open PDF';
  $('pdfStatusMessage').textContent = message;
  $('pdfRetry').hidden = !retry;
  $('pdfPageBadge').hidden = true;
  $('pdfViewerContainer').setAttribute('aria-busy', 'false');
  $('pdfReadingStatus').textContent = 'Loading failed';
}
$('pdfRetry').addEventListener('click', () => location.reload());
const fullscreenButton = $('pdfFullscreen');
let useNativeFullscreen = typeof document.documentElement.requestFullscreen === 'function'
  && typeof document.exitFullscreen === 'function' && document.fullscreenEnabled !== false;
let focusMode = false;
let fullscreenRequestPending = false;
function syncReadingModeButton() {
  const active = focusMode || Boolean(document.fullscreenElement);
  const label = focusMode || !useNativeFullscreen
    ? active ? 'Exit focus mode' : 'Focus mode'
    : active ? 'Exit fullscreen' : 'Fullscreen';
  fullscreenButton.setAttribute('aria-pressed', String(active));
  fullscreenButton.setAttribute('aria-label', label);
  fullscreenButton.title = label;
}
function setFocusMode(active) {
  focusMode = active;
  document.body.classList.toggle('pdf-focus-mode', active);
  syncReadingModeButton();
}
fullscreenButton.addEventListener('click', async () => {
  if (fullscreenRequestPending) return;
  if (focusMode || !useNativeFullscreen) {
    setFocusMode(!focusMode);
    return;
  }
  fullscreenRequestPending = true;
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    if (!document.fullscreenElement) {
      // Some embedded browsers expose the API but reject the request.
      useNativeFullscreen = false;
      setFocusMode(true);
    } else {
      $('pdfReadingStatus').textContent = 'Unable to exit fullscreen. Use your browser’s exit control.';
    }
  } finally {
    fullscreenRequestPending = false;
    syncReadingModeButton();
  }
});
document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement && focusMode) setFocusMode(false);
  else syncReadingModeButton();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && focusMode) setFocusMode(false);
});
syncReadingModeButton();

let readerPromise;
let cachedDownloadURL;
let downloadBusy = false;
if (pdfURL) {
  $('pdfDownload').href = pdfURL.href;
  $('pdfDownload').hidden = false;
  let filename = pdfURL.pathname.split('/').pop();
  try { filename = decodeURIComponent(filename); } catch { /* Use the encoded filename. */ }
  if (!title) {
    setTitle(filename);
  }
  const downloadTitle = $('pdfTitleText').textContent.trim().replace(/\.pdf$/i, '');
  const downloadFilename = (downloadTitle.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/, '') || 'document') + '.pdf';
  $('pdfDownload').download = downloadFilename;
  $('pdfDownload').addEventListener('click', async event => {
    event.preventDefault();
    if (downloadBusy) return;
    downloadBusy = true;
    $('pdfDownload').setAttribute('aria-busy', 'true');
    $('pdfDownload').title = 'Preparing download…';
    let downloadURL;
    try {
      if (!cachedDownloadURL) {
        // Await the existing loader and ask its worker for the bytes it already has.
        const documentPDF = await readerPromise;
        const bytes = await documentPDF.getData();
        cachedDownloadURL = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        $('pdfDownload').href = cachedDownloadURL;
      }
      downloadURL = cachedDownloadURL;
    } catch {
      // If PDF.js cannot read the file, its original download is still available.
      downloadURL = pdfURL.href;
    }
    const link = document.createElement('a');
    link.href = downloadURL;
    link.download = downloadFilename;
    document.body.append(link);
    link.click();
    link.remove();
    downloadBusy = false;
    $('pdfDownload').removeAttribute('aria-busy');
    $('pdfDownload').title = 'Download PDF';
  });
  window.addEventListener('pagehide', event => {
    if (!event.persisted && cachedDownloadURL) URL.revokeObjectURL(cachedDownloadURL);
  });
  readerPromise = initializeReader();
  try { await readerPromise; }
  catch (error) {
    console.error('PDF reader:', error);
    const message = error.name === 'InvalidPDFException' ? 'The file is not a valid PDF, or its contents are damaged.'
      : /404|MissingPDF/.test(error.message) ? 'This PDF could not be found. Return to the previous page to choose another file.'
      : 'The file could not be loaded. Check your connection and retry.';
    showError(message);
  }
}

async function initializeReader() {
  const pdfjs = await import('../pdfjs/build/pdf.mjs');
  const { PDFViewer, PDFLinkService, PDFFindController, EventBus, LinkTarget, FindState, DownloadManager, GenericL10n, SpreadMode } =
    await import('../pdfjs/web/pdf_viewer.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../pdfjs/build/pdf.worker.mjs', import.meta.url).href;
  const assets = new URL('../pdfjs/', import.meta.url);
  const eventBus = new EventBus();
  const linkService = new PDFLinkService({ eventBus, externalLinkTarget: LinkTarget.BLANK, externalLinkRel: 'noopener noreferrer' });
  const findController = new PDFFindController({ eventBus, linkService });
  const container = $('pdfViewerContainer');
  const viewer = new PDFViewer({
    container, viewer: $('pdfPages'), eventBus, linkService, findController,
    downloadManager: new DownloadManager(), l10n: new GenericL10n('en-US'),
    annotationEditorMode: pdfjs.AnnotationEditorType.DISABLE,
    annotationMode: pdfjs.AnnotationMode.ENABLE, enableScripting: false,
    imageResourcesPath: new URL('../icon/', import.meta.url).href,
    maxCanvasPixels: 10000000, maxCanvasDim: 8192,
    // Redraw the visible area at full resolution when the full-page canvas is capped.
    enableDetailCanvas: true, enableAutoLinking: false
  });
  linkService.setViewer(viewer);
  let documentPDF;
  let ready = false;
  let searchQuery = '';
  let searchHasRun = false;
  let scaleCloseTimer;
  let resizeFrame;
  let saveTimer;
  let thumbnailFrame;
  let thumbnailPage = 0;
  let thumbnailPositionPending = false;
  let spreadFitPreset = null;
  let adjustingSpreadFit = false;
  let navigationTab = 'pages';
  const outlineEntries = [];
  let currentOutlineEntry;
  let clickedOutlineEntry;
  let outlineNavigationVersion = 0;
  const progressKey = 'pdf-page:' + pdfURL.pathname + pdfURL.search;
  const buttons = ['pdfPrev', 'pdfNext', 'pdfPage', 'pdfPageToggle', 'pdfScale', 'pdfZoomOut', 'pdfZoomIn', 'pdfSearchToggle', 'pdfSidebarToggle', 'pdfSpreadToggle'];
  let remembered = 1;
  try { remembered = Number(localStorage.getItem(progressKey)) || 1; } catch { /* Start at page one. */ }
  const requested = Number(new URLSearchParams(location.hash.slice(1)).get('page'));
  const initialPage = Number.isSafeInteger(requested) && requested > 0 ? requested : remembered;

  function savePage() {
    if (!ready) return;
    try { localStorage.setItem(progressKey, String(viewer.currentPageNumber)); } catch { /* Optional persistence. */ }
  }
  function changePage(page) {
    if (!ready || !Number.isFinite(page)) return;
    clearClickedOutlineSelection();
    viewer.currentPageNumber = Math.max(1, Math.min(documentPDF.numPages, Math.trunc(page)));
    updatePage();
  }
  function turnPage(direction) {
    if (!ready) return;
    const page = viewer.currentPageNumber;
    const double = viewer.spreadMode !== SpreadMode.NONE;
    const first = double ? Math.floor((page - 1) / 2) * 2 + 1 : page;
    changePage(first + direction * (double ? 2 : 1));
  }
  function revealCurrentThumbnail() {
    if (!thumbnailPositionPending || $('pdfSidebar').hidden || $('pdfThumbnails').hidden) return;
    cancelAnimationFrame(thumbnailFrame);
    thumbnailFrame = requestAnimationFrame(() => {
      if (!thumbnailPositionPending || $('pdfSidebar').hidden || $('pdfThumbnails').hidden) return;
      const list = $('pdfThumbnails');
      const current = list.children[viewer.currentPageNumber - 1];
      if (!current) return;
      thumbnailPositionPending = false;
      const row = current.getBoundingClientRect();
      const viewport = list.getBoundingClientRect();
      // Normal scroll limits keep the first and last thumbnails near the edges.
      list.scrollTop += row.top + row.height / 2 - (viewport.top + list.clientHeight / 2);
    });
  }
  for (const event of ['wheel', 'touchstart', 'pointerdown']) {
    $('pdfThumbnails').addEventListener(event, () => {
      cancelAnimationFrame(thumbnailFrame);
      thumbnailPositionPending = false;
    }, { passive: true });
  }
  function updatePage() {
    const page = viewer.currentPageNumber;
    if (page !== thumbnailPage) {
      thumbnailPage = page;
      thumbnailPositionPending = true;
    }
    const double = viewer.spreadMode !== SpreadMode.NONE;
    const first = double ? Math.floor((page - 1) / 2) * 2 + 1 : page;
    const last = double ? Math.min(first + 1, documentPDF.numPages) : page;
    const pageChanged = pageInput.placeholder !== String(page);
    pageInput.placeholder = String(page);
    syncPageInput(pageChanged);
    $('pdfPrev').disabled = first <= 1;
    $('pdfNext').disabled = last >= documentPDF.numPages;
    $('pdfReadingStatus').textContent = `Page ${page} of ${documentPDF.numPages}`;
    $('pdfBadgeCurrent').textContent = page;
    $('pdfBadgeTotal').textContent = documentPDF.numPages;
    document.querySelectorAll('.pdf-thumbnail[aria-current]').forEach(button => button.removeAttribute('aria-current'));
    $('pdfThumbnails').children[page - 1]?.setAttribute('aria-current', 'page');
    revealCurrentThumbnail();
    updateOutlineSelection();
    const url = new URL(location.href);
    const hash = new URLSearchParams(url.hash.slice(1));
    hash.set('page', String(page));
    url.hash = hash.toString();
    history.replaceState(history.state, '', url);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(savePage, 300);
  }
  function scaleValue() { return spreadFitPreset || viewer.currentScaleValue; }
  function updateScale() {
    if (!adjustingSpreadFit) spreadFitPreset = null;
    const value = scaleValue();
    const options = [...$('pdfScaleOptions').querySelectorAll('[data-scale]')];
    const exact = options.find(option => option.dataset.scale === value);
    $('pdfScaleCaption').textContent = exact?.textContent || Math.round(viewer.currentScale * 100) + '%';
    options.forEach(option => {
      const selected = option === exact;
      option.classList.toggle('active', selected);
      option.setAttribute('aria-selected', String(selected));
    });
    $('pdfZoomOut').disabled = viewer.currentScale <= .25;
    $('pdfZoomIn').disabled = viewer.currentScale >= 4;
    // A previous manual zoom can leave a horizontal offset after refitting.
    if (['page-width', 'page-fit'].includes(value)) {
      requestAnimationFrame(() => { container.scrollLeft = 0; });
    }
  }
  function refit() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      if (!ready) return;
      const value = scaleValue();
      if (['page-width', 'page-fit'].includes(value)) {
        if (viewer.spreadMode === SpreadMode.NONE) viewer.currentScaleValue = value;
        else {
          // A spread can mix portrait and landscape pages. Fit both actual
          // dimensions instead of assuming that the second page has the first's width.
          const first = Math.floor((viewer.currentPageNumber - 1) / 2) * 2;
          const pages = [viewer.getPageView(first), viewer.getPageView(first + 1)].filter(Boolean);
          const baseWidth = pages.reduce((sum, page) => sum + page.width / viewer.currentScale, 0);
          const baseHeight = Math.max(...pages.map(page => page.height / viewer.currentScale));
          const widthScale = Math.max(1, container.clientWidth - 40) / baseWidth;
          const heightScale = Math.max(1, container.clientHeight - 5) / baseHeight;
          spreadFitPreset = value;
          adjustingSpreadFit = true;
          try {
            viewer.currentScale = value === 'page-fit' ? Math.min(widthScale, heightScale) : widthScale;
            updateScale();
          } finally { adjustingSpreadFit = false; }
        }
      }
      viewer.update();
      if (['page-width', 'page-fit'].includes(scaleValue())) container.scrollLeft = 0;
    });
  }
  new ResizeObserver(refit).observe(container);
  container.addEventListener('scroll', () => {
    // Finding a match can move the text layer horizontally even when the entire
    // page fits. Keep the fitted page centered while preserving vertical jumps.
    if (ready && container.scrollLeft && ['page-width', 'page-fit'].includes(scaleValue())) {
      container.scrollLeft = 0;
    }
  }, { passive: true });
  $('pdfPrev').addEventListener('click', () => turnPage(-1));
  $('pdfNext').addEventListener('click', () => turnPage(1));
  $('pdfSpreadToggle').addEventListener('click', () => {
    if (!ready) return;
    const preset = scaleValue();
    const double = viewer.spreadMode === SpreadMode.NONE;
    viewer.spreadMode = double ? SpreadMode.ODD : SpreadMode.NONE;
    if (['page-width', 'page-fit'].includes(preset)) viewer.currentScaleValue = preset;
    $('pdfSpreadToggle').setAttribute('aria-pressed', String(double));
    updatePage();
    refit();
  });
  function submitPageInput() {
    // An empty field shows the current page as a hint, without navigating to page 1.
    if (pageInput.value.trim()) changePage(Number(pageInput.value));
    syncPageInput(true);
  }
  pageInput.addEventListener('change', submitPageInput);
  pageInput.addEventListener('blur', () => syncPageInput(true));
  pageInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitPageInput();
      pageInput.blur();
    }
  });
  function setScaleMenu(open, focusOption = false) {
    const menu = $('pdfScaleOptions');
    const wasOpen = $('pdfScale').getAttribute('aria-expanded') === 'true';
    if (!open && !wasOpen) return;
    clearTimeout(scaleCloseTimer);
    $('pdfScale').setAttribute('aria-expanded', String(open));
    if (open) {
      menu.hidden = false;
      menu.inert = false;
      const space = innerHeight - $('pdfScale').getBoundingClientRect().bottom - 20;
      menu.style.maxHeight = Math.max(96, Math.min(420, space)) + 'px';
      // Commit the closed style so the entry transition also runs after display:none.
      void menu.offsetWidth;
      menu.classList.add('show');
      if (focusOption) (menu.querySelector('[aria-selected="true"]') || menu.firstElementChild).focus();
    } else {
      menu.classList.remove('show');
      menu.inert = true;
      scaleCloseTimer = setTimeout(() => { menu.hidden = true; }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
    }
  }
  $('pdfScale').addEventListener('click', () => setScaleMenu($('pdfScale').getAttribute('aria-expanded') !== 'true'));
  $('pdfScale').addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault(); setScaleMenu(true, true);
    }
    if (event.key === 'Escape') setScaleMenu(false);
  });
  $('pdfScaleOptions').addEventListener('click', event => {
    const option = event.target.closest('[data-scale]');
    if (!option) return;
    viewer.currentScaleValue = option.dataset.scale;
    refit();
    setScaleMenu(false);
    $('pdfScale').focus({ preventScroll: true });
  });
  $('pdfScaleOptions').addEventListener('keydown', event => {
    const options = [...$('pdfScaleOptions').querySelectorAll('[data-scale]')];
    const index = options.indexOf(document.activeElement);
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % options.length;
    if (event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = options.length - 1;
    if (next !== undefined) { event.preventDefault(); options[next].focus(); }
    if (event.key === 'Escape') {
      event.preventDefault(); setScaleMenu(false); $('pdfScale').focus({ preventScroll: true });
    }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.pdf-scale-wrap')) setScaleMenu(false);
  });
  document.addEventListener('focusin', event => {
    if (!event.target.closest('.pdf-scale-wrap')) setScaleMenu(false);
  });
  $('pdfZoomOut').addEventListener('click', () => { viewer.currentScale = Math.max(.25, viewer.currentScale / 1.2); });
  $('pdfZoomIn').addEventListener('click', () => { viewer.currentScale = Math.min(4, viewer.currentScale * 1.2); });

  function setSidebar(open) {
    $('pdfSidebar').hidden = !open;
    $('pdfWorkspace').classList.toggle('sidebar-open', open);
    $('pdfSidebarToggle').setAttribute('aria-expanded', String(open));
    $('pdfSidebarScrim').hidden = !open || !mobile.matches;
    if (open) { revealCurrentThumbnail(); revealOutlineSelection(); }
    refit();
  }
  $('pdfSidebarToggle').addEventListener('click', () => setSidebar($('pdfSidebar').hidden));
  $('pdfSidebarClose').addEventListener('click', () => { setSidebar(false); $('pdfSidebarToggle').focus(); });
  $('pdfSidebarScrim').addEventListener('click', () => setSidebar(false));
  mobile.addEventListener('change', () => setSidebar(false));

  function setNavigationTab(tab) {
    navigationTab = tab;
    const outline = tab === 'outline';
    $('pdfOutlinePanel').hidden = !outline;
    $('pdfThumbnails').hidden = outline;
    for (const [id, selected] of [['pdfOutlineTab', outline], ['pdfThumbnailsTab', !outline]]) {
      $(id).setAttribute('aria-selected', String(selected));
      $(id).tabIndex = selected ? 0 : -1;
    }
    if (outline) revealOutlineSelection();
    else revealCurrentThumbnail();
  }
  $('pdfOutlineTab').addEventListener('click', () => setNavigationTab('outline'));
  $('pdfThumbnailsTab').addEventListener('click', () => setNavigationTab('pages'));
  document.querySelector('.pdf-sidebar-tabs').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tab = event.key === 'Home' ? 'pages' : event.key === 'End' ? 'outline'
      : navigationTab === 'outline' ? 'pages' : 'outline';
    setNavigationTab(tab);
    $(tab === 'outline' ? 'pdfOutlineTab' : 'pdfThumbnailsTab').focus();
  });
  function revealOutlineSelection() {
    if (!currentOutlineEntry || $('pdfSidebar').hidden || $('pdfOutlinePanel').hidden) return;
    const panel = $('pdfOutlinePanel');
    const row = currentOutlineEntry.link.getBoundingClientRect();
    const viewport = panel.getBoundingClientRect();
    if (row.top < viewport.top + 8) panel.scrollTop += row.top - viewport.top - 8;
    else if (row.bottom > viewport.bottom - 8) panel.scrollTop += row.bottom - viewport.bottom + 8;
  }
  function updateOutlineSelection() {
    if (!ready) return;
    let selected;
    // Several subsections can share a page. Page-based tracking must not
    // replace the bookmark the reader explicitly chose on that page.
    if (clickedOutlineEntry) {
      selected = clickedOutlineEntry;
    } else {
      clickedOutlineEntry = null;
      for (const entry of outlineEntries) {
        if (entry.page && entry.page <= viewer.currentPageNumber
          && (!selected || entry.page >= selected.page)) selected = entry;
      }
    }
    // Highlight a collapsed ancestor when its current subsection is hidden.
    for (let parent = selected?.parent; parent; parent = parent.parent) {
      if (parent.children.hidden) selected = parent;
    }
    if (selected === currentOutlineEntry) return;
    currentOutlineEntry?.link.removeAttribute('aria-current');
    currentOutlineEntry = selected;
    selected?.link.setAttribute('aria-current', 'location');
    revealOutlineSelection();
  }
  function clearClickedOutlineSelection() {
    if (!clickedOutlineEntry) return;
    clickedOutlineEntry = null;
    ++outlineNavigationVersion;
    updateOutlineSelection();
  }
  // Programmatic scrolling can make the next page more visible than a
  // destination near the page bottom. Resume automatic tracking only when
  // the reader starts another navigation, not when PDF.js updates its page.
  for (const type of ['wheel', 'touchmove']) {
    container.addEventListener(type, clearClickedOutlineSelection, { passive: true });
  }
  container.addEventListener('pointerdown', event => {
    if (event.target === container) clearClickedOutlineSelection();
  });
  container.addEventListener('click', event => {
    if (event.target.closest('a')) clearClickedOutlineSelection();
  });
  container.addEventListener('keydown', event => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
      clearClickedOutlineSelection();
    }
  });
  const destinations = new Map();
  async function destinationPage(dest) {
    if (!dest) return null;
    const key = JSON.stringify(dest);
    if (!destinations.has(key)) destinations.set(key, (async () => {
      const explicit = typeof dest === 'string' ? await documentPDF.getDestination(dest) : dest;
      if (!Array.isArray(explicit)) return null;
      const ref = explicit[0];
      return Number.isInteger(ref) ? ref + 1 : (await documentPDF.getPageIndex(ref)) + 1;
    })());
    return destinations.get(key);
  }
  async function loadOutline() {
    try {
      const items = await documentPDF.getOutline();
      if (!items?.length) {
        $('pdfOutlineStatus').textContent = 'No embedded bookmarks. Use thumbnails to navigate.';
        return;
      }
      function appendItems(items, list, parent = null, depth = 1) {
        for (const item of items) {
          const li = document.createElement('li');
          const row = document.createElement('div'); row.className = 'pdf-outline-row';
          const link = document.createElement('button');
          link.type = 'button'; link.className = 'pdf-outline-link';
          link.textContent = item.title?.trim() || 'Untitled bookmark';
          if (item.bold) link.style.fontWeight = '600';
          if (item.italic) link.style.fontStyle = 'italic';
          link.disabled = !item.dest;
          const entry = {link, dest: item.dest, page: null, parent, children: null};
          outlineEntries.push(entry);
          const hasChildren = item.items?.length > 0;
          const toggle = document.createElement(hasChildren ? 'button' : 'span');
          toggle.className = hasChildren ? 'pdf-outline-toggle' : 'pdf-outline-spacer';
          if (hasChildren) {
            const expanded = depth < 2;
            toggle.type = 'button'; toggle.setAttribute('aria-label', 'Expand or collapse nested bookmarks');
            toggle.setAttribute('aria-expanded', String(expanded));
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttribute('href', new URL('../icon/viewer-icons.svg#icon-next', import.meta.url).href); svg.setAttribute('aria-hidden', 'true');
            svg.append(use); toggle.append(svg);
            const children = document.createElement('ul');
            children.hidden = !expanded; entry.children = children;
            toggle.addEventListener('click', () => {
              children.hidden = !children.hidden;
              toggle.setAttribute('aria-expanded', String(!children.hidden));
              updateOutlineSelection();
            });
            appendItems(item.items, children, entry, depth + 1);
            li.append(children);
          }
          link.addEventListener('click', async () => {
            const version = ++outlineNavigationVersion;
            const previous = clickedOutlineEntry;
            clickedOutlineEntry = entry;
            updateOutlineSelection();
            try {
              entry.page = await destinationPage(item.dest);
              if (version !== outlineNavigationVersion) return;
              await linkService.goToDestination(item.dest);
              if (version !== outlineNavigationVersion) return;
              if (mobile.matches) setSidebar(false);
            } catch {
              if (version === outlineNavigationVersion) {
                clickedOutlineEntry = previous;
                $('pdfReadingStatus').textContent = 'This bookmark destination is unavailable';
              }
            } finally {
              if (version === outlineNavigationVersion) {
                updateOutlineSelection();
              }
            }
          });
          row.append(toggle, link); li.prepend(row); list.append(li);
        }
      }
      appendItems(items, $('pdfOutline'));
      $('pdfOutlineStatus').hidden = true;
      $('pdfOutline').hidden = false;
      let next = 0;
      await Promise.all(Array.from({length: Math.min(3, outlineEntries.length)}, async () => {
        while (next < outlineEntries.length) {
          const entry = outlineEntries[next++];
          try { entry.page = await destinationPage(entry.dest); } catch { /* Keep other headings usable. */ }
          updateOutlineSelection();
        }
      }));
    } catch (error) {
      console.warn('PDF outline:', error);
      $('pdfOutlineStatus').textContent = 'Bookmarks could not be loaded. Use thumbnails to navigate.';
    }
  }

  function find(type = '', previous = false) {
    clearClickedOutlineSelection();
    eventBus.dispatch('find', {
      source: document, type, query: searchQuery,
      phraseSearch: true, caseSensitive: false, entireWord: false,
      highlightAll: true, findPrevious: previous, matchDiacritics: false
    });
  }
  let searchCloseTimer;
  function setSearch(open) {
    const panel = $('pdfSearchPanel');
    const wasOpen = $('pdfSearchToggle').getAttribute('aria-expanded') === 'true';
    if (!open && !wasOpen) return;
    clearTimeout(searchCloseTimer);
    $('pdfSearchToggle').setAttribute('aria-expanded', String(open));
    if (open) {
      panel.hidden = false;
      panel.inert = false;
      // Commit the starting style before animating a previously hidden panel.
      void panel.offsetWidth;
      panel.classList.add('show');
      $('pdfSearch').focus({ preventScroll: true });
      $('pdfSearch').select();
    } else {
      panel.classList.remove('show');
      panel.inert = true;
      eventBus.dispatch('findbarclose', { source: document });
      (moreControls.hidden ? toolsToggle : $('pdfSearchToggle')).focus({ preventScroll: true });
      searchCloseTimer = setTimeout(() => { panel.hidden = true; }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
    }
  }
  function searchIsCurrent() { return searchHasRun && $('pdfSearch').value.trim() === searchQuery; }
  function setMatchButtons(enabled) {
    $('pdfFindPrev').disabled = $('pdfFindNext').disabled = !enabled;
  }
  function clearSearch() {
    $('pdfSearch').value = searchQuery = '';
    searchHasRun = false;
    find();
    $('pdfSearchStatus').textContent = 'Enter a search term';
    setMatchButtons(false);
    $('pdfSearch').focus();
  }
  $('pdfSearchToggle').addEventListener('click', () => setSearch($('pdfSearchToggle').getAttribute('aria-expanded') !== 'true'));
  $('pdfSearchClose').addEventListener('click', () => setSearch(false));
  $('pdfSearch').addEventListener('input', () => {
    if (!searchIsCurrent()) {
      $('pdfSearchStatus').textContent = $('pdfSearch').value.trim() ? 'Press Enter or select Search' : 'Enter a search term';
      setMatchButtons(false);
    }
  });
  $('pdfSearchPanel').addEventListener('submit', event => {
    event.preventDefault();
    const query = $('pdfSearch').value.trim();
    if (!query) { clearSearch(); return; }
    const again = searchIsCurrent();
    searchQuery = query;
    searchHasRun = true;
    find(again ? 'again' : '');
  });
  $('pdfSearchClear').addEventListener('click', clearSearch);
  $('pdfFindPrev').addEventListener('click', () => { if (searchIsCurrent()) find('again', true); });
  $('pdfFindNext').addEventListener('click', () => { if (searchIsCurrent()) find('again'); });
  eventBus.on('updatefindmatchescount', ({ matchesCount }) => {
    if (!searchIsCurrent()) return;
    $('pdfSearchStatus').textContent = matchesCount.total ? `${matchesCount.current} / ${matchesCount.total} matches` : '';
    setMatchButtons(matchesCount.total > 0);
  });
  eventBus.on('updatefindcontrolstate', ({ state, matchesCount }) => {
    if (!searchIsCurrent()) return;
    $('pdfSearchStatus').textContent = state === FindState.PENDING ? 'Searching…'
      : state === FindState.NOT_FOUND ? 'No matches found'
      : `${matchesCount.current} / ${matchesCount.total} matches`;
    setMatchButtons(state !== FindState.PENDING && state !== FindState.NOT_FOUND && matchesCount.total > 0);
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && ready) {
      event.preventDefault(); setSearch(true); return;
    }
    if (event.key === 'Escape') {
      setScaleMenu(false);
      if ($('pdfSearchToggle').getAttribute('aria-expanded') === 'true') setSearch(false);
      if (!$('pdfSidebar').hidden && mobile.matches) setSidebar(false);
    }
    if (!ready || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey
      || event.target.closest('input, select, textarea, button, a, [contenteditable]')) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); turnPage(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); turnPage(1); }
  });
  window.addEventListener('hashchange', () => {
    if (ready) {
      clearClickedOutlineSelection();
      linkService.setHash(location.hash.slice(1));
    }
  });
  window.addEventListener('pagehide', savePage);

  // Only thumbnails near the visible sidebar area are painted, two at a time.
  const thumbnailQueue = [];
  let thumbnailsRunning = 0;
  let stopped = false;
  const thumbnailObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      thumbnailObserver.unobserve(entry.target);
      thumbnailQueue.push(entry.target);
    }
    paintThumbnails();
  }, { root: $('pdfThumbnails'), rootMargin: '200px' });
  async function paintThumbnail(button) {
    const page = await documentPDF.getPage(Number(button.dataset.page));
    if (stopped) return;
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 130 / base.width });
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width * ratio);
    canvas.height = Math.ceil(viewport.height * ratio);
    canvas.setAttribute('aria-hidden', 'true');
    const paper = button.querySelector('.pdf-thumbnail-paper');
    await page.render({ canvasContext: canvas.getContext('2d'), viewport,
      transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0], annotationMode: pdfjs.AnnotationMode.DISABLE }).promise;
    if (!stopped) paper.replaceChildren(canvas);
  }
  function paintThumbnails() {
    while (!stopped && thumbnailsRunning < 2 && thumbnailQueue.length) {
      const button = thumbnailQueue.shift();
      thumbnailsRunning++;
      paintThumbnail(button).catch(error => { console.warn('PDF thumbnail:', error); })
        .finally(() => { thumbnailsRunning--; paintThumbnails(); });
    }
  }
  function createThumbnails() {
    const fragment = document.createDocumentFragment();
    for (let page = 1; page <= documentPDF.numPages; page++) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'pdf-thumbnail'; button.dataset.page = page;
      button.setAttribute('aria-label', `Go to page ${page}`);
      const paper = document.createElement('span'); paper.className = 'pdf-thumbnail-paper';
      // Reserve space before lazy painting so loading cannot move the scroll position.
      const viewport = viewer.getPageView(page - 1)?.viewport;
      if (viewport) paper.style.height = 130 * viewport.height / viewport.width + 'px';
      const number = document.createElement('span'); number.textContent = page;
      button.append(paper, number);
      button.addEventListener('click', () => { changePage(page); if (mobile.matches) setSidebar(false); });
      fragment.append(button);
      thumbnailObserver.observe(button);
    }
    $('pdfThumbnails').replaceChildren(fragment);
  }

  eventBus.on('pagesinit', () => {
    ready = true;
    buttons.forEach(id => { $(id).disabled = false; });
    $('pdfSpreadToggle').disabled = documentPDF.numPages < 2;
    $('pdfPageCount').textContent = documentPDF.numPages;
    $('pdfPage').max = documentPDF.numPages;
    viewer.currentScaleValue = 'page-fit';
    createThumbnails();
    changePage(initialPage);
    setSidebar(false);
  });
  eventBus.on('pagechanging', () => {
    if (!ready) return;
    updatePage();
    if (viewer.spreadMode !== SpreadMode.NONE) refit();
  });
  eventBus.on('scalechanging', updateScale);
  eventBus.on('pagerendered', ({ error }) => {
    if (error) { showError('This page could not be rendered. Please retry.'); return; }
    $('pdfStatus').hidden = true;
    $('pdfPageBadge').hidden = false;
    container.setAttribute('aria-busy', 'false');
    clearTimeout(loadTimeout);
    if (viewer.spreadMode !== SpreadMode.NONE) refit();
  });
  const task = pdfjs.getDocument({
    url: pdfURL.href, cMapUrl: new URL('cmaps/', assets).href, cMapPacked: true,
    standardFontDataUrl: new URL('standard_fonts/', assets).href,
    wasmUrl: new URL('wasm/', assets).href, isEvalSupported: false
  });
  const loadTimeout = setTimeout(() => {
    $('pdfStatusMessage').textContent = 'Loading is taking longer than expected. You can keep waiting or retry.';
    $('pdfRetry').hidden = false;
  }, 20000);
  task.onProgress = ({ loaded, total }) => {
    const hasTotal = Number.isFinite(total) && total > 0;
    const percent = hasTotal ? Math.max(0, Math.min(100, loaded / total * 100)) : 0;
    const formatBytes = bytes => bytes < 1024 ? `${Math.round(bytes)} B`
      : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    $('pdfProgress').classList.toggle('indeterminate', !hasTotal);
    $('pdfProgressBar').style.width = hasTotal ? percent + '%' : '';
    if (hasTotal) $('pdfProgressTrack').setAttribute('aria-valuenow', String(Math.round(percent)));
    else $('pdfProgressTrack').removeAttribute('aria-valuenow');
    $('pdfProgressText').textContent = hasTotal
      ? `${formatBytes(loaded)} / ${formatBytes(total)} · ${Math.round(percent)}%`
      : `Downloaded ${formatBytes(loaded)}`;
    $('pdfStatusMessage').textContent = hasTotal && percent === 100 ? 'Download complete. Preparing pages…' : 'Downloading PDF…';
  };
  task.onPassword = (submit, reason) => {
    const password = window.prompt(reason === pdfjs.PasswordResponses.INCORRECT_PASSWORD
      ? 'Incorrect password. Enter the PDF password again:' : 'This PDF is password protected. Enter its password:');
    if (password !== null) submit(password);
    else { clearTimeout(loadTimeout); showError('Password entry cancelled. Please retry.'); task.destroy(); }
  };
  try {
    documentPDF = await task.promise;
    linkService.setDocument(documentPDF);
    viewer.setDocument(documentPDF);
    void loadOutline();
  } catch (error) { clearTimeout(loadTimeout); throw error; }
  window.addEventListener('pagehide', event => {
    if (!event.persisted) { stopped = true; thumbnailObserver.disconnect(); task.destroy(); }
  });
  return documentPDF;
}
