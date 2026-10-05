document.addEventListener('DOMContentLoaded', () => {
  const includes = [...document.querySelectorAll('add-file[data-research-section]')];
  if (!includes.length) return;
  const states = new Map(includes.map(element => [element, { loading: false, ready: false }]));
  let userScrolled = false;
  const markUserScroll = () => { userScrolled = true; };
  window.addEventListener('wheel', markUserScroll, { passive: true });
  window.addEventListener('touchmove', markUserScroll, { passive: true });
  window.addEventListener('keydown', event => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) markUserScroll();
  });
  window.addEventListener('hashchange', () => { userScrolled = false; });

  function restoreSectionAnchor() {
    if (userScrolled || [...states.values()].some(state => state.loading)) return;
    const id = location.hash.slice(1);
    if (!['papers', 'patents', 'funding'].includes(id)) return;
    requestAnimationFrame(() => {
      if (!userScrolled && location.hash === `#${id}`) {
        document.getElementById(id)?.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    });
  }

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
    } catch (error) {
      console.error('Failed to load research section:', error);
      notice.className = 'research-load-error';
      notice.textContent = 'Content could not be loaded. ';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = 'Retry';
      retry.addEventListener('click', () => loadSection(element), { once: true });
      element.append(retry);
      return;
    } finally {
      state.loading = false;
      restoreSectionAnchor();
    }
    state.ready = true;
    if (element.dataset.researchSection === 'papers') {
      // Register citation/filter listeners before pagination emits the first filter event.
      initializePaperFilters();
      window.initializePaperCitations();
      initializePaperPagination();
    }
    restoreSectionAnchor();
  }

  includes.forEach(element => { loadSection(element); });
});
