// Include trusted HTML fragments in place. Paths are relative to the page.
(() => {
  const selector = 'add-file, addfile';
  const pending = new WeakMap();

  function readFile(element) {
    if (pending.has(element)) return pending.get(element);
    const request = (async () => {
      const filepath = element.getAttribute('filepath')?.trim();
      if (!filepath) throw new Error('add-file requires a filepath');
      const response = await fetch(filepath, { cache: 'no-cache', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`${filepath}: HTTP ${response.status}`);
      const template = document.createElement('template');
      template.innerHTML = await response.text();
      return template.content;
    })();
    pending.set(element, request);
    request.finally(() => pending.delete(element)).catch(() => {});
    return request;
  }

  window.loadAddFiles = async (root = document, { prepare, automatic = false } = {}) => {
    const elements = [
      ...(root.matches?.(selector) ? [root] : []),
      ...root.querySelectorAll(selector)
    ].filter(element => !automatic || !element.hasAttribute('data-manual'));
    elements.forEach(element => element.setAttribute('aria-busy', 'true'));
    try {
      const fragments = await Promise.all(elements.map(readFile));
      if (prepare) fragments.forEach((fragment, index) => prepare(fragment, elements[index]));
      elements.forEach((element, index) => element.replaceWith(fragments[index]));
      return elements.length;
    } finally {
      elements.forEach(element => element.removeAttribute('aria-busy'));
    }
  };

  async function autoLoad() {
    try {
      await window.loadAddFiles(document, { automatic: true });
    } catch (error) {
      console.error('Failed to include HTML:', error);
      document.querySelectorAll(selector).forEach(element => {
        if (element.hasAttribute('data-manual')) return;
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = 'Retry';
        retry.addEventListener('click', autoLoad, { once: true });
        element.replaceChildren('Content could not be loaded. ', retry);
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoLoad);
  else autoLoad();
})();
