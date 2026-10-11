/* Capture capabilities before the legacy PDF.js build installs its polyfills. */
export function needsPDFCompatibility(userAgent = navigator.userAgent) {
  const androidBrowser = /Android/i.test(userAgent)
    && /Quark|MQQBrowser|QQBrowser|MiuiBrowser|UCBrowser|UCWEB/i.test(userAgent);
  return androidBrowser || typeof Promise.withResolvers !== 'function'
    || typeof Promise.try !== 'function' || typeof URL.parse !== 'function'
    || typeof ArrayBuffer.prototype.transferToFixedLength !== 'function'
    || typeof Uint8Array.prototype.toBase64 !== 'function'
    || typeof globalThis.AbortSignal?.any !== 'function';
}

// Download once without Fetch streams or Range requests, then transfer the
// ArrayBuffer to PDF.js. Some Android browser download layers break streaming.
export function loadPDFBytes(url, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const fail = error => { cleanup(); reject(error); };
    request.open('GET', url);
    request.responseType = 'arraybuffer';
    request.onprogress = event => onProgress({ loaded: event.loaded, total: event.lengthComputable ? event.total : 0 });
    request.onload = () => {
      if (request.status !== 200 || !request.response?.byteLength) {
        fail(new Error(`PDF download failed (HTTP ${request.status})`));
        return;
      }
      cleanup();
      const data = new Uint8Array(request.response);
      onProgress({ loaded: data.byteLength, total: data.byteLength });
      resolve(data);
    };
    request.onerror = () => fail(new Error('PDF download network error'));
    request.onabort = () => fail(new DOMException('PDF download aborted', 'AbortError'));
    if (signal?.aborted) { request.onabort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    try { request.send(); } catch (error) { fail(error); }
  });
}
