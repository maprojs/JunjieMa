document.addEventListener('DOMContentLoaded', () => {
  // Keep journal metrics editable as plain <jif>IF=5.5, Q1</jif> in HTML.
  document.querySelectorAll('.research-page :is(#pubmedPapers, #cnkiPapers) .research-card jif').forEach(badge => {
    if (badge.classList.contains('journal-metrics')) return;
    const metrics = badge.textContent.trim().match(/^(IF\s*=\s*\d+(?:\.\d+)?),\s*(Q[1-4]|N\/A)$/i);
    if (!metrics) return;

    const impact = document.createElement('span');
    impact.className = 'journal-impact';
    impact.textContent = metrics[1].replace(/\s/g, '').toUpperCase();

    const quartile = document.createElement('span');
    quartile.className = 'journal-quartile';
    quartile.dataset.quartile = metrics[2].toUpperCase();
    quartile.textContent = quartile.dataset.quartile;

    badge.classList.add('journal-metrics');
    badge.replaceChildren(impact, document.createTextNode(' '), quartile);
  });

  const sections = ['pubmedPapers', 'cnkiPapers'].map(id => document.getElementById(id));
  if (sections.some(section => !section)) return;
  const papers = sections.flatMap(section => [...section.querySelectorAll('.research-card')]);
  let matches = papers;
  let page = 1;
  let size = 10;

  const pagination = document.createElement('nav');
  pagination.className = 'papers-pagination';
  pagination.setAttribute('aria-label', 'Paper pagination');
  const sizeMenu = document.createElement('details');
  sizeMenu.className = 'papers-page-size';
  const sizeToggle = document.createElement('summary');
  sizeToggle.setAttribute('aria-label', 'Papers per page');
  const options = document.createElement('div');
  options.className = 'papers-page-options';
  [10, 20, 30, 50, 'all'].forEach(value => {
    const option = document.createElement('button');
    option.type = 'button';
    option.dataset.size = String(value);
    option.textContent = value === 'all' ? 'All' : String(value);
    option.addEventListener('click', () => {
      size = value;
      page = 1;
      sizeMenu.open = false;
      render(true);
      sizeToggle.focus({ preventScroll: true });
    });
    options.append(option);
  });
  sizeMenu.append(sizeToggle, options);
  const pages = document.createElement('div');
  pages.className = 'papers-page-buttons';
  pagination.append(sizeMenu, pages);
  sections[1].after(pagination);

  function render(scroll = false) {
    const perPage = size === 'all' ? Math.max(1, matches.length) : size;
    const totalPages = Math.max(1, Math.ceil(matches.length / perPage));
    page = Math.max(1, Math.min(page, totalPages));
    const start = (page - 1) * perPage;
    const visible = new Set(matches.slice(start, start + perPage));
    papers.forEach(paper => { paper.style.display = visible.has(paper) ? '' : 'none'; });
    sections.forEach(section => {
      section.style.display = [...visible].some(paper => section.contains(paper)) ? '' : 'none';
    });
    pagination.hidden = matches.length === 0;
    if (size === 'all') {
      sizeToggle.textContent = 'Show all ▾';
    } else {
      const label = document.createElement('span');
      label.className = 'papers-per-page-label';
      label.textContent = 'page';
      // Offset only "page", keeping the number, slash and arrow in place.
      sizeToggle.replaceChildren(document.createTextNode(`${size}\u00a0/\u00a0`), label, document.createTextNode('\u00a0▾'));
    }
    options.querySelectorAll('button').forEach(option => {
      option.setAttribute('aria-pressed', String(option.dataset.size === String(size)));
    });
    pages.replaceChildren();
    pages.hidden = totalPages <= 1;
    const addPage = (label, number, disabled = false) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'papers-page-button';
      button.textContent = label;
      button.disabled = disabled;
      button.dataset.page = String(number);
      if (/^\d+$/.test(label)) {
        button.setAttribute('aria-label', `Page ${number}`);
        if (number === page) button.setAttribute('aria-current', 'page');
      }
      button.addEventListener('click', () => {
        if (number === page) return;
        page = number;
        render(true);
        pages.querySelector('[aria-current="page"]')?.focus({ preventScroll: true });
      });
      pages.append(button);
    };
    addPage('Previous', page - 1, page === 1);
    // Keep the first, last and current pages reachable without a long row.
    const numbers = totalPages <= 5 ? Array.from({ length: totalPages }, (_, i) => i + 1)
      : [...new Set([1, 2, page, totalPages - 1, totalPages])].sort((a, b) => a - b);
    numbers.forEach((number, index) => {
      if (index && number - numbers[index - 1] > 1) {
        const ellipsis = document.createElement('span');
        ellipsis.textContent = '…';
        ellipsis.setAttribute('aria-hidden', 'true');
        pages.append(ellipsis);
      }
      addPage(String(number), number);
    });
    addPage('Next', page + 1, page === totalPages);
    if (scroll) document.getElementById('firstAuthorCount')?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start'
    });
  }

  document.addEventListener('papers:filtered', event => {
    matches = event.detail;
    page = 1;
    render();
  });
  document.addEventListener('pointerdown', event => {
    if (!sizeMenu.contains(event.target)) sizeMenu.open = false;
  });
  sizeMenu.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      sizeMenu.open = false;
      sizeToggle.focus();
    }
  });
  sizeMenu.addEventListener('focusout', event => {
    if (event.relatedTarget && !sizeMenu.contains(event.relatedTarget)) sizeMenu.open = false;
  });
  applyPaperFilters();
});
