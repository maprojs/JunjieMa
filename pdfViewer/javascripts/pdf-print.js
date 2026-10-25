/* Print the original PDF bytes already held by PDF.js, preserving text and vectors. */
export function createPrintController({ getDocument, url, returnFocus }) {
  const $ = id => document.getElementById(id);
  const button = $('pdfPrint');
  const dialog = $('pdfPrintDialog');
  const status = $('pdfPrintStatus');
  const progress = $('pdfPrintProgress');
  const cancel = $('pdfPrintCancel');
  const original = $('pdfPrintOriginal');
  let active;
  let disposed = false;
  let cachedPDFURL;
  original.href = url;

  function release(job) {
    job.controller.abort();
    job.removePrintListener?.();
    job.frame?.remove();
  }
  function close() {
    if (active) release(active);
    active = null;
    button.removeAttribute('aria-busy');
    button.disabled = disposed;
    if (dialog.open) dialog.close();
    if (!disposed) returnFocus();
  }
  function check(job) {
    if (job.controller.signal.aborted || disposed) throw new DOMException('Cancelled', 'AbortError');
  }
  function loadFrame(frame, signal) {
    return new Promise((resolve, reject) => {
      const finish = error => {
        clearTimeout(timer);
        frame.removeEventListener('load', onLoad);
        frame.removeEventListener('error', onError);
        signal.removeEventListener('abort', onAbort);
        if (error) reject(error);
        else resolve();
      };
      const onLoad = () => finish();
      const onError = () => finish(new Error('Unable to load native PDF viewer'));
      const onAbort = () => finish(new DOMException('Cancelled', 'AbortError'));
      const timer = setTimeout(() => finish(new Error('Native PDF viewer timed out')), 20000);
      frame.addEventListener('load', onLoad);
      frame.addEventListener('error', onError);
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
  async function start() {
    const pdf = getDocument();
    if (!pdf || active || disposed) return;
    const job = { controller: new AbortController(), frame: null };
    active = job;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    progress.hidden = false;
    progress.removeAttribute('value');
    cancel.textContent = 'Cancel';
    status.textContent = 'Preparing original PDF…';
    dialog.showModal();
    try {
      if (!cachedPDFURL) {
        // getData reads the loaded document; no canvas or image conversion.
        const bytes = await pdf.getData();
        check(job);
        cachedPDFURL = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        original.href = cachedPDFURL;
      }
      check(job);
      if (navigator.pdfViewerEnabled === false) throw new Error('Native PDF viewer unavailable');
      const frame = job.frame = document.createElement('iframe');
      frame.className = 'pdf-print-frame';
      frame.title = 'Original PDF print';
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;
      const loaded = loadFrame(frame, job.controller.signal);
      frame.src = cachedPDFURL;
      document.body.append(frame);
      await loaded;
      check(job);
      progress.hidden = true;
      cancel.textContent = 'Close';
      status.textContent = 'The original PDF is ready for browser printing. If no print dialog appears, open the original PDF to print.';
      const afterPrint = () => {
        setTimeout(() => { if (active === job) close(); }, 0);
      };
      frame.contentWindow.addEventListener('afterprint', afterPrint);
      job.removePrintListener = () => frame.contentWindow?.removeEventListener('afterprint', afterPrint);
      // Keep focus in the dialog so Escape still cancels after printing.
      frame.contentWindow.print();
    } catch (error) {
      release(job);
      if (active !== job || disposed) return;
      progress.hidden = true;
      cancel.textContent = 'Close';
      status.textContent = 'This browser could not print the embedded PDF. Open the original PDF and use the browser print command.';
      console.error('PDF print:', error);
    }
  }
  const onCancel = event => { event.preventDefault(); close(); };
  button.addEventListener('click', start);
  cancel.addEventListener('click', close);
  dialog.addEventListener('cancel', onCancel);
  return {
    dispose() {
      disposed = true;
      close();
      if (cachedPDFURL) URL.revokeObjectURL(cachedPDFURL);
      button.removeEventListener('click', start);
      cancel.removeEventListener('click', close);
      dialog.removeEventListener('cancel', onCancel);
    }
  };
}

