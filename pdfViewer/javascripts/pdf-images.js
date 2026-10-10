/* Embedded bitmap extraction for the bundled PDF.js version. No page screenshots. */

export function imageForPage(entries, page, preferred) {
  if (preferred && entries.includes(preferred) && preferred.pages.includes(page)) return preferred;
  const matching = entries.find(entry => entry.pages.includes(page));
  if (matching) return matching;
  let nearest = entries[0], previous = -Infinity;
  for (const entry of entries) {
    for (const number of entry.pages) if (number <= page && number > previous) { nearest = entry; previous = number; }
  }
  return nearest;
}
export function imageOperations(list, OPS) {
  const images = [];
  for (let index = 0; index < list.fnArray.length; index++) {
    const fn = list.fnArray[index], args = list.argsArray[index];
    if (fn === OPS.paintImageXObject || fn === OPS.paintImageXObjectRepeat) {
      images.push({ index, objectId: args[0] });
    } else if (fn === OPS.paintInlineImageXObject) {
      images.push({ index, inline: args[0] });
    } else if (fn === OPS.paintInlineImageXObjectGroup) {
      const seen = new Set();
      for (const { x, y, w, h } of args[1]) {
        const key = `${x},${y},${w},${h}`;
        if (seen.has(key)) continue;
        seen.add(key);
        images.push({ index, inline: args[0], crop: { x, y, w, h } });
      }
    }
  }
  return images;
}

export function imagePixels(image, ImageKind) {
  const { width, height, data, kind } = image;
  if (!data) throw new Error('Missing image pixels');
  const pixels = new Uint8ClampedArray(width * height * 4);
  if (kind === ImageKind.RGBA_32BPP) {
    if (data.length < pixels.length) throw new Error('Incomplete RGBA image');
    pixels.set(data.subarray(0, pixels.length));
  } else if (kind === ImageKind.RGB_24BPP) {
    if (data.length < width * height * 3) throw new Error('Incomplete RGB image');
    for (let src = 0, dst = 0; dst < pixels.length; src += 3, dst += 4) {
      pixels[dst] = data[src]; pixels[dst + 1] = data[src + 1];
      pixels[dst + 2] = data[src + 2]; pixels[dst + 3] = 255;
    }
  } else if (kind === ImageKind.GRAYSCALE_1BPP) {
    const stride = Math.ceil(width / 8);
    if (data.length < stride * height) throw new Error('Incomplete monochrome image');
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const value = data[y * stride + (x >> 3)] & (128 >> (x & 7)) ? 255 : 0;
        const dst = (y * width + x) * 4;
        pixels[dst] = pixels[dst + 1] = pixels[dst + 2] = value;
        pixels[dst + 3] = 255;
      }
    }
  } else throw new Error('Unsupported image pixel format');
  return pixels;
}

function resolveImage(page, operation) {
  if (operation.inline) return Promise.resolve(operation.inline);
  const objects = operation.objectId.startsWith('g_') ? page.commonObjs : page.objs;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Image decoding timed out')), 15000);
    objects.get(operation.objectId, image => { clearTimeout(timer); resolve(image); });
  });
}

async function imageBlob(image, crop, ImageKind, preview = false) {
  const width = crop?.w || image.width, height = crop?.h || image.height;
  // Match the 160px sidebar preview, allowing up to 2x pixels for high-DPI screens.
  const previewWidth = 160 * Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
  const ratio = preview ? Math.min(1, previewWidth / width, previewWidth * 2 / height) : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  let sourceCanvas;
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image canvas unavailable');
    let source = image.bitmap;
    if (!source) {
      sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = image.width; sourceCanvas.height = image.height;
      const sourceContext = sourceCanvas.getContext('2d');
      if (!sourceContext) throw new Error('Image canvas unavailable');
      sourceContext.putImageData(new ImageData(imagePixels(image, ImageKind), image.width, image.height), 0, 0);
      source = sourceCanvas;
    }
    context.drawImage(source, crop?.x || 0, crop?.y || 0, width, height, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob(blob => {
      if (blob) resolve(blob); else reject(new Error('PNG encoding failed'));
    }, 'image/png'));
  } finally {
    canvas.width = canvas.height = 0;
    if (sourceCanvas) sourceCanvas.width = sourceCanvas.height = 0;
    // PDF.js owns image.bitmap; never close a bitmap used by the page renderer.
  }
}

// Per-document LRU caches own their URLs; detaching a view does not discard its PNG.
function createImageCache(maxBytes, maxEntries) {
  const cached = new Map(), pending = new Map();
  let bytes = 0, disposed = false;
  function peek(key) {
    const asset = cached.get(key);
    if (asset) { cached.delete(key); cached.set(key, asset); }
    return asset;
  }
  return {
    peek,
    has: key => cached.has(key),
    get(key, produce) {
      if (disposed) return Promise.resolve(null);
      const hit = peek(key);
      if (hit) return Promise.resolve(hit);
      if (pending.has(key)) return pending.get(key);
      const task = Promise.resolve().then(produce).then(blob => {
        if (disposed || !blob) return null;
        const asset = { blob, url: URL.createObjectURL(blob) };
        cached.set(key, asset); bytes += blob.size;
        // Retain at least the newest image, even if it alone exceeds the byte budget.
        while (cached.size > 1 && (bytes > maxBytes || cached.size > maxEntries)) {
          const [oldKey, old] = cached.entries().next().value;
          cached.delete(oldKey); bytes -= old.blob.size; URL.revokeObjectURL(old.url);
        }
        return asset;
      }).finally(() => pending.delete(key));
      pending.set(key, task);
      return task;
    },
    dispose() {
      disposed = true;
      for (const asset of cached.values()) URL.revokeObjectURL(asset.url);
      cached.clear(); pending.clear(); bytes = 0;
    }
  };
}

export function createImagePanel({ pdfjs, getDocument, getFilename, navigate, returnFocus, canCleanup }) {
  const $ = id => document.getElementById(id);
  const panel = $('pdfImagesPanel'), list = $('pdfImagesList');
  const infoButton = $('pdfImagesInfoToggle'), info = $('pdfImagesInfo');
  function setInfo(value) {
    info.hidden = !value;
    infoButton.setAttribute('aria-expanded', String(value));
  }
  function dismissInfo(event) {
    if (!info.contains(event.target) && !infoButton.contains(event.target)) setInfo(false);
  }
  infoButton.addEventListener('click', () => setInfo(info.hidden));
  document.addEventListener('pointerdown', dismissInfo);
  document.addEventListener('focusin', dismissInfo);
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !info.hidden) {
      event.preventDefault(); event.stopPropagation(); setInfo(false); infoButton.focus();
    }
  });
  const entries = new Map(), cards = new WeakMap(), downloadURLs = new Map();
  const previewCache = createImageCache(16 * 1024 * 1024, 48);
  const fullCache = createImageCache(128 * 1024 * 1024, 16);
  const lightbox = createImageLightbox({ returnFocus });
  let open = false, disposed = false, scanning = false, nextPage = 1, errors = 0;
  let currentPage = 1, positionPending = true, positionFrame, preferredEntry;
  let work = Promise.resolve();
  let preparing = false, preloading = false, preloadTimer;

  // Serialize scan/preview/export work so cleanup cannot invalidate another extraction.
  function withPage(number, callback) {
    const result = work.then(async () => {
      if (disposed) return;
      const page = await getDocument().getPage(number);
      try {
        const operators = await page.getOperatorList({ annotationMode: pdfjs.AnnotationMode.DISABLE });
        return await callback(page, imageOperations(operators, pdfjs.OPS));
      } finally {
        // Only release pages outside PDFViewer's render buffer.
        if (!disposed && canCleanup(number)) page.cleanup();
      }
    });
    work = result.catch(() => {});
    return result;
  }
  const visible = entry => $('pdfImagesAll').checked || entry.width > 200 && entry.height > 200;
  function pendingPreviews() {
    return [...entries.values()].some(entry => visible(entry) && !entry.previewReady && !entry.previewFailed);
  }
  function updateLoading() {
    const shown = [...entries.values()].filter(visible);
    const done = shown.filter(entry => entry.previewReady).length;
    const loading = nextPage <= (getDocument()?.numPages || Infinity) || pendingPreviews();
    $('pdfImagesProgress').textContent = `${done}/${shown.length}`;
    $('pdfImagesLoading').hidden = !loading;
    list.setAttribute('aria-busy', String(loading));
  }
  function schedulePreload() {
    clearTimeout(preloadTimer);
    if (disposed || !open || preparing || scanning || preloading
      || nextPage <= (getDocument()?.numPages || Infinity) || pendingPreviews()) return;
    // One background original at a time; let clicks and preview work run first.
    preloadTimer = setTimeout(() => void preloadNext(), 120);
  }
  async function preloadNext() {
    if (disposed || !open || preparing || scanning || preloading || pendingPreviews()) return;
    const candidates = [...entries.values()].filter(entry => visible(entry) && entry.previewReady)
      .sort((a, b) => Number(b.near) - Number(a.near)
        || Math.abs(a.pages[0] - currentPage) - Math.abs(b.pages[0] - currentPage))
      .slice(0, 16);
    const entry = candidates.find(entry => !entry.prefetched && !fullCache.has(entry.key));
    if (!entry) return;
    entry.prefetched = true; preloading = true;
    try { await getAsset(entry, false); }
    catch (error) { if (!disposed) console.warn('PDF image preload:', error); }
    finally { preloading = false; schedulePreload(); }
  }
  async function preparePreviews() {
    if (preparing || disposed || !open) return;
    preparing = true;
    try {
      while (open && !disposed) {
        const entry = [...entries.values()].find(entry => visible(entry) && !entry.previewReady && !entry.previewFailed);
        if (!entry) break;
        try {
          const asset = await getPreviewAsset(entry);
          if (!asset) { if (!open || disposed) break; continue; }
          if (entry.near) void loadPreview(entry);
        } catch (error) {
          if (!disposed) {
            entry.previewFailed = true; errors++;
            console.warn('PDF image preview preparation:', error);
          }
        }
        if (!disposed) updateStatus();
      }
    } finally {
      preparing = false;
      if (!disposed) { updateLoading(); schedulePreload(); }
    }
  }
  function previewSpinner(entry) {
    const spinner = document.createElement('span');
    spinner.className = 'pdf-spinner'; spinner.setAttribute('aria-hidden', 'true');
    entry.preview.setAttribute('aria-label', 'Loading image…');
    entry.preview.setAttribute('aria-busy', 'true');
    entry.preview.replaceChildren(spinner);
  }
  function updateStatus() {
    const complete = nextPage > (getDocument()?.numPages || Infinity);
    const shown = [...entries.values()].filter(visible), count = shown.length;
    shown.forEach((entry, index) => {
      entry.number = `${index + 1}/${count}`;
      entry.caption.textContent = entry.number;
    });
    $('pdfImagesCount').textContent = String(count);
    updateLoading();
    lightbox.refresh();
    $('pdfImagesEmpty').hidden = !complete || count > 0;
    $('pdfImagesEmpty').textContent = $('pdfImagesAll').checked ? 'No embedded images found.' : 'No large images found. Try Show all.';
    $('pdfImagesErrors').hidden = errors === 0;
    updateSelection();
  }
  function revealCurrentImage() {
    if (!open || !positionPending || disposed) return;
    const shown = [...entries.values()].filter(visible);
    const current = imageForPage(shown, currentPage, preferredEntry);
    // Wait for the current page's scan before choosing the nearest preceding image.
    if (!current || !current.pages.includes(currentPage) && nextPage <= currentPage) return;
    cancelAnimationFrame(positionFrame);
    positionFrame = requestAnimationFrame(() => {
      if (!open || !positionPending || disposed) return;
      positionPending = false;
      const row = current.card.getBoundingClientRect(), viewport = list.getBoundingClientRect();
      list.scrollTop += row.top + row.height / 2 - (viewport.top + list.clientHeight / 2);
    });
  }
  function updateSelection() {
    for (const entry of entries.values()) {
      if (entry.pages.includes(currentPage)) entry.navigate.setAttribute('aria-current', 'page');
      else entry.navigate.removeAttribute('aria-current');
    }
    revealCurrentImage();
  }
  for (const event of ['wheel', 'touchstart', 'pointerdown']) list.addEventListener(event, () => {
    cancelAnimationFrame(positionFrame); positionPending = false;
  }, { passive: true });
  const listResize = new ResizeObserver(revealCurrentImage);
  listResize.observe(list);
  function releasePreview(entry) {
    if (!entry.url) return;
    entry.url = null;
    previewSpinner(entry);
  }
  const observer = new IntersectionObserver(changes => {
    for (const change of changes) {
      const entry = cards.get(change.target);
      entry.near = change.isIntersecting;
      if (entry.near && open) void loadPreview(entry);
      else if (!entry.near) releasePreview(entry);
    }
    schedulePreload();
  }, { root: list, rootMargin: '200px' });

  function getAsset(entry, preview) {
    const cache = preview ? previewCache : fullCache;
    return cache.get(entry.key, () => withPage(entry.pages[0], async (page, operations) => {
      if (preview && (!open || !visible(entry))) return null;
      const operation = operations.find(item => item.index === entry.index
        && JSON.stringify(item.crop) === JSON.stringify(entry.crop));
      if (!operation) throw new Error('Image operation unavailable');
      const image = await resolveImage(page, operation);
      if (!image) throw new Error('Image decoding failed');
      return imageBlob(image, entry.crop, pdfjs.ImageKind, preview);
    }));
  }
  async function getBlob(entry, preview) { return (await getAsset(entry, preview))?.blob; }
  async function getPreviewAsset(entry) {
    const asset = previewCache.peek(entry.key) || await getAsset(entry, true);
    if (!asset || disposed) return null;
    if (!asset.image) {
      // Visible previews and the preparation pass share one decode as well as one PNG.
      if (!asset.decoding) {
        asset.decoding = (async () => {
          const image = document.createElement('img');
          image.alt = ''; image.decoding = 'async';
          image.width = entry.width; image.height = entry.height; image.src = asset.url;
          await image.decode(); asset.image = image;
        })().finally(() => { asset.decoding = null; });
      }
      await asset.decoding;
    }
    if (disposed) return null;
    entry.previewReady = true; entry.previewFailed = false;
    updateLoading();
    return asset;
  }
  async function loadPreview(entry) {
    if (disposed || entry.url || entry.loading || !visible(entry)) return;
    entry.loading = true;
    try {
      if (!previewCache.has(entry.key)) previewSpinner(entry);
      const asset = await getPreviewAsset(entry);
      if (!asset) return;
      if (disposed || !open || !entry.near || !visible(entry)) return;
      entry.url = asset.url;
      entry.preview.replaceChildren(asset.image);
      entry.preview.removeAttribute('aria-label');
      entry.preview.setAttribute('aria-busy', 'false');
    } catch (error) {
      if (!disposed) {
        entry.preview.textContent = 'Image preview failed';
        entry.preview.removeAttribute('aria-label');
        entry.preview.setAttribute('aria-busy', 'false');
        console.warn('PDF image preview:', error);
      }
    } finally {
      entry.loading = false;
      schedulePreload();
    }
  }
  async function download(entry, button, existingBlob) {
    if (button.disabled) return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.title = 'Preparing download…';
    try {
      const blob = existingBlob || await getBlob(entry, false);
      if (disposed) return;
      const link = document.createElement('a');
      const filename = getFilename().replace(/\.pdf$/i, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 120) || 'PDF';
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}_p${entry.pages[0]}_${entry.ordinal}.png`;
      document.body.append(link); link.click(); link.remove();
      const url = link.href;
      downloadURLs.set(url, setTimeout(() => { URL.revokeObjectURL(url); downloadURLs.delete(url); }, 30000));
      button.title = 'Download image';
    } catch (error) {
      button.title = 'Download failed. Retry';
      console.warn('PDF image download:', error);
    } finally { button.disabled = false; button.removeAttribute('aria-busy'); }
  }
  function addPage(entry, number) {
    if (entry.pages.includes(number)) return;
    entry.pages.push(number);
    entry.navigate.title = `Pages ${entry.pages.join(', ')} · ${entry.width} × ${entry.height} px`;
  }
  function addEntry(data, number) {
    let entry = entries.get(data.key);
    if (entry) { addPage(entry, number); return; }
    entry = { ...data, pages: [], near: false, loading: false, url: null, ordinal: entries.size + 1 };
    entries.set(data.key, entry);
    const card = document.createElement('article'); card.className = 'pdf-image-card';
    entry.card = card; cards.set(card, entry);
    const navigation = document.createElement('button'); navigation.type = 'button';
    navigation.className = 'pdf-thumbnail pdf-image-thumbnail'; entry.navigate = navigation;
    const preview = document.createElement('span'); preview.className = 'pdf-image-preview';
    preview.style.aspectRatio = `${entry.width} / ${entry.height}`; entry.preview = preview;
    previewSpinner(entry);
    const caption = document.createElement('span'); caption.className = 'pdf-image-caption';
    const label = document.createElement('span'); label.textContent = 'Image';
    entry.caption = document.createElement('span'); entry.caption.className = 'notranslate';
    caption.append(label, entry.caption); navigation.append(preview, caption); addPage(entry, number);
    navigation.addEventListener('click', () => {
      preferredEntry = entry;
      const target = entry.pages.reduce((best, page) => Math.abs(page - currentPage) < Math.abs(best - currentPage) ? page : best);
      navigate(target);
    });
    const actions = document.createElement('div'); actions.className = 'pdf-image-actions';
    function action(label, icon) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'pdf-icon-button';
      button.title = label; button.setAttribute('aria-label', label);
      button.innerHTML = `<svg aria-hidden="true"><use href="icon/viewer-icons.svg#${icon}"/></svg>`;
      actions.append(button); return button;
    }
    const enlarge = action('Enlarge image', 'icon-expand');
    entry.enlarge = enlarge;
    enlarge.addEventListener('click', () => lightbox.open({
      key: entry.key,
      getItems: () => [...entries.values()].filter(visible).map(item => ({
        key: item.key, width: item.width, height: item.height, opener: item.enlarge,
        peekAsset: () => fullCache.peek(item.key), getAsset: () => getAsset(item, false),
        download: (button, blob) => download(item, button, blob)
      }))
    }));
    const save = action('Download image', 'icon-save-image'); save.classList.add('pdf-image-download');
    save.addEventListener('click', () => void download(entry, save));
    card.append(navigation, actions);
    card.hidden = !visible(entry); list.append(card); observer.observe(card);
  }
  async function scan() {
    if (scanning || disposed || !getDocument()) return;
    scanning = true;
    try {
      while (open && !disposed && nextPage <= getDocument().numPages) {
        const number = nextPage;
        try {
          await withPage(number, async (page, operations) => {
            const seen = new Set();
            for (const operation of operations) {
              if (disposed) return;
              // The same image can be painted hundreds of times on one page.
              const localKey = operation.objectId || `${operation.index}:${JSON.stringify(operation.crop)}`;
              if (seen.has(localKey)) continue;
              seen.add(localKey);
              try {
                const image = await resolveImage(page, operation);
                if (disposed) return;
                if (!image) throw new Error('Image decoding failed');
                const width = operation.crop?.w || image.width, height = operation.crop?.h || image.height;
                if (!(width > 0 && height > 0)) throw new Error('Invalid image size');
                // ref survives PDF.js promotion from page-local to shared image caches.
                const key = image.ref ? `ref:${image.ref}` : operation.objectId?.startsWith('g_')
                  ? operation.objectId : `p${number}:${localKey}`;
                addEntry({ key, index: operation.index, crop: operation.crop, width, height }, number);
              } catch (error) { errors++; console.warn('PDF image extraction:', error); }
            }
          });
        } catch (error) { errors++; console.warn('PDF image page:', error); }
        nextPage++;
        if (!disposed) { updateStatus(); void preparePreviews(); }
        // Yield between pages, allowing queued previews and user input to run.
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    } finally { scanning = false; schedulePreload(); }
  }
  function setActive(value) {
    if (disposed || value && !getDocument()) return;
    open = value;
    panel.inert = !value;
    panel.hidden = !value;
    if (!value) { setInfo(false); clearTimeout(preloadTimer); }
    if (value) {
      updateStatus(); void scan(); void preparePreviews(); schedulePreload();
      for (const entry of entries.values()) if (entry.near) void loadPreview(entry);
    }
  }
  $('pdfImagesAll').addEventListener('change', () => {
    for (const entry of entries.values()) {
      entry.card.hidden = !visible(entry);
      if (entry.card.hidden) releasePreview(entry);
    }
    positionPending = true; updateStatus(); void preparePreviews(); schedulePreload();
  });
  return {
    syncPage(page) {
      if (page === currentPage) return;
      currentPage = page; positionPending = true; schedulePreload();
      if (!preferredEntry?.pages.includes(page)) preferredEntry = null;
      updateSelection();
    },
    setActive,
    dispose() {
      disposed = true; clearTimeout(preloadTimer); cancelAnimationFrame(positionFrame); observer.disconnect(); listResize.disconnect(); lightbox.dispose();
      document.removeEventListener('pointerdown', dismissInfo);
      document.removeEventListener('focusin', dismissInfo);
      for (const entry of entries.values()) releasePreview(entry);
      previewCache.dispose(); fullCache.dispose();
      for (const [url, timer] of downloadURLs) { clearTimeout(timer); URL.revokeObjectURL(url); }
      entries.clear();
    }
  };
}

/* Zoom and pan an extracted bitmap independently of the PDF page scale. */
export function zoomImageAt(state, scale, point = { x: 0, y: 0 }) {
  if (!Number.isFinite(scale) || scale <= 0) return { ...state };
  const next = Math.max(.01, Math.min(10, scale));
  const ratio = next / state.scale;
  return { scale: next, x: point.x - (point.x - state.x) * ratio, y: point.y - (point.y - state.y) * ratio };
}

export function createImageLightbox({ returnFocus } = {}) {
  const $ = id => document.getElementById(id);
  const dialog = $('pdfImageDialog'), stage = $('pdfImageStage'), image = $('pdfImageFull');
  const menu = $('pdfImageScaleOptions'), scaleButton = $('pdfImageScale');
  const options = [...menu.querySelectorAll('button')];
  const pointers = new Map();
  let state = { scale: 1, x: 0, y: 0 }, width = 0, height = 0, ready = false, fitted = true;
  let frame, generation = 0, url, blob, active, opener, drag, swipe, getItems, nativeGesture, backdropDown = false;
  let ownsFullscreen = false, nativeFullscreen = false, fullscreenGeneration = 0;
  const previousButton = $('pdfImagePrevious'), nextButton = $('pdfImageNext');
  function refresh() {
    if (!active || !getItems) return;
    const items = getItems(), index = items.findIndex(item => item.key === active.key);
    const number = index < 0 ? 0 : index + 1;
    $('pdfImageDialogNumber').textContent = number;
    $('pdfImageCurrent').textContent = number;
    $('pdfImageTotal').textContent = items.length;
    const focused = document.activeElement;
    previousButton.disabled = index <= 0;
    nextButton.disabled = index < 0 || index >= items.length - 1;
    // Disabling the focused boundary button must not lose the modal shortcuts.
    if (focused === previousButton && previousButton.disabled || focused === nextButton && nextButton.disabled) {
      dialog.focus({ preventScroll: true });
    }
  }
  function select(item) {
    active = item; opener = item.opener; ready = false;
    setMenu(false);
    $('pdfImageDialogDimensions').textContent = `${item.width} × ${item.height} px`;
    refresh(); sizeDialog(); void load();
  }
  function move(direction) {
    if (!dialog.open || !active || !getItems) return;
    const items = getItems(), index = items.findIndex(item => item.key === active.key);
    if (index < 0 || !items[index + direction]) return;
    select(items[index + direction]);
  }
  previousButton.addEventListener('click', () => move(-1));
  nextButton.addEventListener('click', () => move(1));
  const fullscreenButton = $('pdfImageDialogFullscreen');
  const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  function fullscreenStyle(value) {
    dialog.classList.toggle('is-fullscreen', value);
    fullscreenButton.setAttribute('aria-pressed', String(value));
    fullscreenButton.title = value ? 'Exit full screen' : 'Full screen';
    fullscreenButton.setAttribute('aria-label', fullscreenButton.title);
  }
  async function leaveFullscreen() {
    fullscreenGeneration++;
    fullscreenStyle(false);
    const exit = ownsFullscreen && fullscreenElement() === document.documentElement;
    ownsFullscreen = nativeFullscreen = false;
    if (exit) {
      try { await (document.exitFullscreen || document.webkitExitFullscreen)?.call(document); } catch { /* Already exited. */ }
    }
  }
  async function enterFullscreen() {
    const token = ++fullscreenGeneration;
    fullscreenStyle(true);
    nativeFullscreen = !!fullscreenElement();
    if (nativeFullscreen) return;
    const root = document.documentElement;
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!request) return; // Keep the viewport-sized preview on unsupported mobile browsers.
    ownsFullscreen = true;
    try {
      await request.call(root);
      if (token !== fullscreenGeneration || !dialog.open) {
        if (fullscreenElement() === root) await (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
        return;
      }
      nativeFullscreen = true;
      // Fullscreen promotes the root above an already-open modal in the top layer.
      // Reopen the same dialog above it without resetting the image/zoom state.
      const focused = document.activeElement;
      backdropDown = false;
      resetPointers();
      dialog.close();
      dialog.showModal();
      (dialog.contains(focused) ? focused : fullscreenButton).focus({ preventScroll: true });
    } catch { if (token === fullscreenGeneration) ownsFullscreen = nativeFullscreen = false; }
  }
  function fullscreenChanged() {
    if (!fullscreenElement() && nativeFullscreen) {
      ownsFullscreen = nativeFullscreen = false;
      fullscreenStyle(false);
    }
  }
  document.addEventListener('fullscreenchange', fullscreenChanged);
  document.addEventListener('webkitfullscreenchange', fullscreenChanged);
  fullscreenButton.addEventListener('click', () => {
    if (dialog.classList.contains('is-fullscreen')) void leaveFullscreen(); else void enterFullscreen();
  });
  function escape() {
    if (!menu.hidden) setMenu(false);
    else if (dialog.classList.contains('is-fullscreen')) void leaveFullscreen();
    else close();
  }

  function sizeDialog() {
    if (!dialog.open || !active) return;
    const imageWidth = ready ? width : active.width;
    const imageHeight = ready ? height : active.height;
    if (!(imageWidth > 0 && imageHeight > 0)) return;
    // Size the image area to 70vh; header/footer are extra. Keep enough width for controls.
    const displayHeight = Math.max(1, window.innerHeight * .7 - 32);
    const minimumWidth = 400;
    const desired = Math.ceil(Math.max(minimumWidth, Math.min(imageWidth, displayHeight * imageWidth / imageHeight) + 34)) + 'px';
    if (dialog.style.getPropertyValue('--pdf-image-dialog-width') !== desired) {
      dialog.style.setProperty('--pdf-image-dialog-width', desired);
    }
    // Mobile width is fixed at 80vw; derive its height from the fitted image.
    const mobileScale = Math.min(1, Math.max(1, dialog.clientWidth - 32) / imageWidth);
    const mobileHeight = Math.ceil(Math.max(240, imageHeight * mobileScale + 32)) + 'px';
    if (dialog.style.getPropertyValue('--pdf-image-mobile-height') !== mobileHeight) {
      dialog.style.setProperty('--pdf-image-mobile-height', mobileHeight);
    }
  }
  function fitScale() { return Math.max(.01, Math.min(1, (stage.clientWidth - 32) / width, (stage.clientHeight - 32) / height)); }
  function constrain() {
    const x = Math.max(0, (width * state.scale - stage.clientWidth) / 2);
    const y = Math.max(0, (height * state.scale - stage.clientHeight) / 2);
    state.x = Math.max(-x, Math.min(x, state.x));
    state.y = Math.max(-y, Math.min(y, state.y));
  }
  function draw() {
    constrain();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      image.style.transform = `translate(-50%, -50%) translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
      scaleButton.textContent = `${Math.round(state.scale * 100)}%`;
      $('pdfImageZoomOut').disabled = !ready || state.scale <= .01;
      $('pdfImageZoomIn').disabled = !ready || state.scale >= 10;
      scaleButton.disabled = !ready;
      for (const option of options) {
        const selected = option.dataset.imageScale === 'fit' ? fitted : !fitted && Math.abs(Number(option.dataset.imageScale) - state.scale) < .001;
        option.setAttribute('aria-selected', String(selected));
      }
    });
  }
  function fit() {
    if (!ready) return;
    fitted = true; state = { scale: fitScale(), x: 0, y: 0 }; draw();
  }
  function zoom(scale, point) {
    if (!ready) return;
    swipe = null; fitted = false; state = zoomImageAt(state, scale, point); draw();
  }
  function point(clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  }
  function setMenu(open, focus = true) {
    menu.hidden = !open; scaleButton.setAttribute('aria-expanded', String(open));
    if (open && focus) (options.find(option => option.getAttribute('aria-selected') === 'true') || options[0]).focus();
    else if (!open && focus && menu.contains(document.activeElement)) scaleButton.focus();
  }
  function resetPointers() {
    for (const id of pointers.keys()) if (stage.hasPointerCapture(id)) stage.releasePointerCapture(id);
    pointers.clear(); drag = swipe = nativeGesture = null; stage.classList.remove('is-dragging');
  }
  function releaseImage() {
    image.hidden = true; image.removeAttribute('src');
    url = blob = null; // The document cache owns the URL until eviction or disposal.
  }
  function close() {
    if (!dialog.open) return;
    void leaveFullscreen();
    generation++; ready = false; cancelAnimationFrame(frame); resetPointers(); setMenu(false, false);
    dialog.close(); releaseImage();
    if (opener?.isConnected && opener.getClientRects().length) opener.focus({ preventScroll: true });
    else returnFocus?.();
    active = opener = getItems = null;
  }
  async function load() {
    const token = ++generation;
    // Move focus before disabling a zoom/download control that initiated navigation.
    dialog.focus({ preventScroll: true });
    const cached = active.peekAsset();
    ready = false; cancelAnimationFrame(frame); releaseImage(); resetPointers();
    $('pdfImageDialogStatus').hidden = !!cached;
    $('pdfImageDialogStatus').querySelector('.pdf-spinner').hidden = false;
    $('pdfImageDialogMessage').textContent = 'Loading image…'; $('pdfImageRetry').hidden = true;
    $('pdfImageDialogDownload').disabled = true;
    for (const id of ['pdfImageZoomOut', 'pdfImageZoomIn', 'pdfImageScale']) $(id).disabled = true;
    try {
      const asset = cached || await active.getAsset();
      if (token !== generation || !dialog.open) return;
      if (!asset) throw new Error('Image unavailable');
      blob = asset.blob; url = asset.url; image.src = url;
      await image.decode();
      if (token !== generation || !dialog.open) return;
      width = image.naturalWidth; height = image.naturalHeight;
      image.style.width = `${width}px`; image.style.height = `${height}px`;
      image.hidden = false; ready = true; sizeDialog();
      $('pdfImageDialogStatus').hidden = true; $('pdfImageDialogDownload').disabled = false;
      fit();
    } catch (error) {
      if (token !== generation || !dialog.open) return;
      releaseImage();
      $('pdfImageDialogStatus').hidden = false;
      $('pdfImageDialogStatus').querySelector('.pdf-spinner').hidden = true;
      $('pdfImageDialogMessage').textContent = 'Image preview failed'; $('pdfImageRetry').hidden = false;
      console.warn('PDF image lightbox:', error);
    }
  }
  $('pdfImageDialogClose').addEventListener('click', close);
  $('pdfImageRetry').addEventListener('click', () => void load());
  $('pdfImageDialogDownload').addEventListener('click', () => { if (ready) void active.download($('pdfImageDialogDownload'), blob); });
  $('pdfImageZoomOut').addEventListener('click', () => zoom(state.scale / 1.2));
  $('pdfImageZoomIn').addEventListener('click', () => zoom(state.scale * 1.2));
  scaleButton.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', event => {
    const option = event.target.closest('[data-image-scale]');
    if (!option) return;
    if (option.dataset.imageScale === 'fit') fit(); else zoom(Number(option.dataset.imageScale));
    setMenu(false); scaleButton.focus();
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); escape(); });
  dialog.addEventListener('pointerdown', event => {
    backdropDown = event.target === dialog;
    if (!event.target.closest('.pdf-image-scale-wrap')) setMenu(false, false);
  });
  dialog.addEventListener('click', event => { if (backdropDown && event.target === dialog) close(); });
  dialog.addEventListener('keydown', event => {
    // Keep the PDF's page/zoom shortcuts out of the modal.
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault(); escape(); return;
    }
    if (!menu.hidden && ['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const index = options.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[next].focus(); return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); return;
    }
    if (!ready || event.target.closest('button')) return;
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(state.scale * 1.2); }
    else if (event.key === '-') { event.preventDefault(); zoom(state.scale / 1.2); }
    else if (event.key === '0') { event.preventDefault(); fit(); }
    else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault(); fitted = false;
      state.y += event.key === 'ArrowUp' ? 40 : event.key === 'ArrowDown' ? -40 : 0;
      draw();
    }
  });
  stage.addEventListener('wheel', event => {
    event.preventDefault();
    if (!ready || nativeGesture) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1;
    const delta = Math.max(-500, Math.min(500, event.deltaY * unit));
    zoom(state.scale * Math.exp(-delta * .002), point(event.clientX, event.clientY));
  }, { passive: false });
  function gesture() {
    const values = [...pointers.values()];
    if (values.length >= 2) {
      const [a, b] = values;
      return { center: point((a.x + b.x) / 2, (a.y + b.y) / 2), distance: Math.hypot(a.x - b.x, a.y - b.y) };
    }
    return values.length ? { center: point(values[0].x, values[0].y), distance: 0 } : null;
  }
  function startDrag() { const current = gesture(); drag = current ? { ...current, state: { ...state } } : null; }
  stage.addEventListener('pointerdown', event => {
    if (!ready || event.button !== 0) return;
    event.preventDefault(); stage.focus({ preventScroll: true });
    // Only a new single-finger gesture at fit scale can switch images.
    // Once a second finger joins, the entire gesture stays zoom/pan-only.
    swipe = event.pointerType === 'touch' && pointers.size === 0 && !nativeGesture && state.scale <= fitScale() * 1.01
      ? { id: event.pointerId, x: event.clientX, y: event.clientY, maxY: 0 } : null;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    stage.setPointerCapture(event.pointerId); stage.classList.add('is-dragging'); startDrag();
  });
  stage.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId) || nativeGesture || !drag) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (swipe) {
      swipe.maxY = Math.max(swipe.maxY, Math.abs(event.clientY - swipe.y));
      return;
    }
    const current = gesture();
    state = drag.distance > 0 && current.distance > 0
      ? zoomImageAt(drag.state, drag.state.scale * current.distance / drag.distance, drag.center) : { ...drag.state };
    state.x += current.center.x - drag.center.x; state.y += current.center.y - drag.center.y;
    fitted = false; draw();
  });
  function endPointer(event) {
    if (!pointers.delete(event.pointerId)) return;
    const candidate = swipe;
    swipe = null;
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    stage.classList.toggle('is-dragging', pointers.size > 0); startDrag();
    if (event.type !== 'pointerup' || !candidate || candidate.id !== event.pointerId || pointers.size) return;
    const dx = event.clientX - candidate.x;
    const dy = Math.max(candidate.maxY, Math.abs(event.clientY - candidate.y));
    const threshold = Math.max(40, Math.min(80, stage.clientWidth * .18));
    if (Math.abs(dx) >= threshold && Math.abs(dx) > dy * 1.5) move(dx < 0 ? 1 : -1);
  }
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) stage.addEventListener(event, endPointer);
  stage.addEventListener('gesturestart', event => { event.preventDefault(); swipe = null; if (ready) nativeGesture = { ...state }; }, { passive: false });
  stage.addEventListener('gesturechange', event => {
    event.preventDefault();
    if (!nativeGesture || !Number.isFinite(event.scale)) return;
    state = zoomImageAt(nativeGesture, nativeGesture.scale * event.scale); fitted = false; draw();
  }, { passive: false });
  stage.addEventListener('gestureend', event => { event.preventDefault(); nativeGesture = null; startDrag(); }, { passive: false });
  const resize = new ResizeObserver(() => { sizeDialog(); if (ready && dialog.open) { if (fitted) fit(); else draw(); } });
  resize.observe(stage);
  resize.observe(dialog);
  return {
    open(options) {
      const item = options.getItems().find(item => item.key === options.key);
      if (!item) return;
      getItems = options.getItems;
      if (!dialog.open) dialog.showModal();
      select(item);
      dialog.focus({ preventScroll: true });
    },
    refresh,
    dispose() {
      close(); resize.disconnect();
      document.removeEventListener('fullscreenchange', fullscreenChanged);
      document.removeEventListener('webkitfullscreenchange', fullscreenChanged);
    }
  };
}
