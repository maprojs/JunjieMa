/* Route reader gestures through PDF.js so zoomed pages are rendered again. */
export function bindPDFZoomGestures({ container, viewer, TouchManager, isReady, signal }) {
  const zoomDelay = 150;
  let targetScale = null;
  let lastScale = null;
  let resetTimer;
  let touchOffset = [0, 0];

  function reset() {
    clearTimeout(resetTimer);
    targetScale = lastScale = null;
  }
  function zoomBy(factor, clientOrigin) {
    if (!isReady() || !Number.isFinite(factor) || factor <= 0) return;
    const currentScale = viewer.currentScale;
    if (lastScale !== currentScale) targetScale = currentScale;
    // Keep small trackpad/touch changes that PDF.js rounds to two decimals.
    targetScale = Math.max(.25, Math.min(4, targetScale * factor));
    const rect = container.getBoundingClientRect();
    const [top, left] = viewer.containerTopLeft;
    viewer.updateScale({
      scaleFactor: targetScale / currentScale,
      drawingDelay: zoomDelay,
      // PDF.js uses layout offsets; this reader's container is inside a workspace.
      origin: [clientOrigin[0] - rect.left + left, clientOrigin[1] - rect.top + top]
    });
    lastScale = viewer.currentScale;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(reset, zoomDelay);
  }

  container.addEventListener('wheel', event => {
    if (!isReady() || (!event.ctrlKey && !event.metaKey) || !event.cancelable) return;
    event.preventDefault();
    // Trackpad pinch arrives as a Ctrl+wheel event. Read deltaMode first for Firefox.
    const mode = event.deltaMode;
    const delta = event.deltaY * (mode === 1 ? 30 : mode === 2 ? container.clientHeight : 1);
    zoomBy(Math.exp(-Math.max(-100, Math.min(100, delta)) / 100), [event.clientX, event.clientY]);
  }, { passive: false, signal });

  container.addEventListener('touchstart', event => {
    if (event.touches.length !== 2) return;
    const touch = event.touches[0];
    touchOffset = [touch.clientX - touch.screenX, touch.clientY - touch.screenY];
  }, { capture: true, passive: true, signal });
  const touchManager = new TouchManager({
    container, signal,
    isPinchingDisabled: () => !isReady(),
    onPinchStart: reset,
    onPinching: (origin, previousDistance, distance) => {
      zoomBy(distance / previousDistance, [origin[0] + touchOffset[0], origin[1] + touchOffset[1]]);
    },
    onPinchEnd: () => {
      reset();
      if (isReady()) viewer.refresh();
    }
  });
  signal.addEventListener('abort', () => {
    reset();
    touchManager.destroy();
  }, { once: true });
}
