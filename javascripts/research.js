// Query parameters are the shareable state; default values stay out of the URL.
window.researchQuery = (() => {
  const defaults = { section: 'papers', language: 'all', role: 'all', sort: 'default', page: '1', size: '10' };
  const parameterNames = {
    section: 'section', language: 'papersLang', role: 'papersRole',
    sort: 'papersSort', page: 'papersPage', size: 'papersSize'
  };
  const choices = {
    section: ['papers', 'projects', 'works'], language: ['all', 'english', 'chinese'],
    role: ['all', 'first', 'corresponding'], sort: ['default', 'year', 'impact', 'citations'],
    size: ['10', '20', '30', '50', 'all']
  };
  function read() {
    const params = new URLSearchParams(location.search);
    return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => {
      const value = params.get(parameterNames[key]);
      const valid = key === 'page' ? /^[1-9]\d*$/.test(value || '') && Number.isSafeInteger(Number(value))
        : choices[key].includes(value);
      return [key, valid ? value : fallback];
    }));
  }
  function url(patch = {}) {
    const target = new URL(location.href);
    const state = { ...read(), ...patch };
    for (const [key, fallback] of Object.entries(defaults)) {
      if (String(state[key]) === fallback) target.searchParams.delete(parameterNames[key]);
      else target.searchParams.set(parameterNames[key], state[key]);
    }
    return target.pathname + target.search + target.hash;
  }
  function write(patch = {}, mode = 'replace') {
    const target = url(patch);
    if (target !== location.pathname + location.search + location.hash) {
      history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', target);
      document.dispatchEvent(new Event('research:query-updated'));
    }
  }
  return { read, write, url };
})();

document.addEventListener('DOMContentLoaded', () => {
  const tabs = [...document.querySelectorAll('[data-research-tab]')];
  if (!tabs.length) return;
  const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
  const includes = panels.map(panel => panel.querySelector('add-file'));
  const states = new Map(includes.map(element => [element, { loading: false, ready: false }]));

  async function loadSection(element) {
    const state = states.get(element);
    if (state.loading || state.ready) return;
    state.loading = true;
    const notice = document.createElement('div');
    notice.className = 'research-loading';
    notice.setAttribute('role', 'status');
    const spinner = document.createElement('span');
    spinner.className = 'research-loading-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = 'Loading content…';
    notice.append(spinner, label);
    element.replaceChildren(notice);
    try {
      await window.loadAddFiles(element, { prepare: initializeResearchCards });
      if (element.dataset.researchSection === 'papers') {
        initializePaperFilters();
        window.initializePaperCitations();
        initializePaperPagination();
      }
      state.ready = true;
    } catch (error) {
      console.error('Failed to load research section:', error);
      notice.className = 'research-load-error';
      notice.textContent = 'Content could not be loaded. ';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = 'Retry';
      retry.addEventListener('click', () => loadSection(element), { once: true });
      notice.append(retry);
    } finally {
      state.loading = false;
    }
  }

  function updateLinks() {
    tabs.forEach(tab => { tab.href = window.researchQuery.url({ section: tab.dataset.researchTab }); });
  }
  function restore() {
    const { section } = window.researchQuery.read();
    tabs.forEach((tab, index) => {
      const active = tab.dataset.researchTab === section;
      if (active) tab.setAttribute('aria-current', 'true');
      else tab.removeAttribute('aria-current');
      panels[index].hidden = !active;
      if (active) loadSection(includes[index]);
    });
    updateLinks();
    document.dispatchEvent(new Event('research:restore'));
  }
  tabs.forEach(tab => tab.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.researchQuery.write({ section: tab.dataset.researchTab }, 'push');
    restore();
  }));
  document.addEventListener('research:query-updated', updateLinks);
  window.addEventListener('popstate', restore);
  window.researchQuery.write();
  restore();
});
