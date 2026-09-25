document.addEventListener('DOMContentLoaded', () => {
  const controls = document.querySelector('.paper-controls');
  if (controls) {
    controls.querySelectorAll('[data-paper-section], [data-paper-role]').forEach(option => {
      option.dataset.label = option.textContent.trim();
    });
    updatePaperOptionCounts('all', 'all');

    const popupAnimations = new Map();
    const animatePopup = (popup, opening) => {
      popupAnimations.get(popup)?.cancel();
      popupAnimations.delete(popup);
      popup.inert = !opening;
      if (opening) popup.hidden = false;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        popup.hidden = !opening;
        return;
      }
      const collapsed = { opacity: 0, transform: 'translateY(-6px) scale(0.98)' };
      const expanded = { opacity: 1, transform: 'translateY(0) scale(1)' };
      const animation = popup.animate(opening ? [collapsed, expanded] : [expanded, collapsed], {
        duration: opening ? 180 : 140,
        easing: 'ease-out',
        fill: 'forwards'
      });
      popupAnimations.set(popup, animation);
      animation.onfinish = () => {
        if (popupAnimations.get(popup) !== animation) return;
        popup.hidden = !opening;
        popupAnimations.delete(popup);
        animation.cancel();
      };
    };

    const closePopups = () => {
      controls.querySelectorAll('.paper-control-button').forEach(button => {
        if (button.getAttribute('aria-expanded') !== 'true') return;
        button.setAttribute('aria-expanded', 'false');
        animatePopup(document.getElementById(button.getAttribute('aria-controls')), false);
      });
    };

    controls.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.classList.contains('paper-control-button')) {
        const wasOpen = button.getAttribute('aria-expanded') === 'true';
        closePopups();
        if (!wasOpen) {
          button.setAttribute('aria-expanded', 'true');
          const popup = document.getElementById(button.getAttribute('aria-controls'));
          animatePopup(popup, true);
          // Only keyboard activation needs focus moved into the popup.
          if (event.detail === 0) {
            popup.querySelector('button').focus({ preventScroll: true });
          }
        }
        return;
      }

      const trigger = button.closest('.paper-control').querySelector('.paper-control-button');
      closePopups();
      if (event.detail === 0) trigger.focus({ preventScroll: true });
      if (button.dataset.paperSection) {
        controls.querySelectorAll('[data-paper-section]').forEach(option => {
          option.setAttribute('aria-pressed', String(option === button));
        });
      }
      if (button.dataset.paperRole) {
        controls.querySelectorAll('[data-paper-role]').forEach(option => {
          option.setAttribute('aria-pressed', String(option === button));
        });
      }
      applyPaperFilters();
    });

    const closeOnOutsideInteraction = event => {
      const trigger = controls.querySelector('[aria-expanded="true"]');
      if (trigger && !event.composedPath().includes(trigger.closest('.paper-control'))) {
        closePopups();
      }
    };
    // Capture touch/mouse presses before scrolling or other handlers can cancel click.
    document.addEventListener('pointerdown', closeOnOutsideInteraction, { capture: true, passive: true });
    document.addEventListener('click', closeOnOutsideInteraction, true);
    controls.addEventListener('keydown', event => {
      if (event.key === 'Tab') {
        setTimeout(() => {
          if (!controls.contains(document.activeElement)) closePopups();
        }, 0);
        return;
      }
      if (event.key !== 'Escape') return;
      const trigger = controls.querySelector('[aria-expanded="true"]');
      closePopups();
      if (trigger) trigger.focus();
    });
    controls.addEventListener('focusout', event => {
      // Touch browsers may blur a button without assigning a new focus target.
      // Outside clicks and keyboard Tab handle those cases explicitly.
      if (event.relatedTarget && !controls.contains(event.relatedTarget)) closePopups();
    });
  }
  const paperCount = document.getElementById('firstAuthorCount');
  if (paperCount) {
    paperCount.textContent = `Total papers: ${document.querySelectorAll('.firstPaper, .otherPaper').length}`;
  }
  document.querySelectorAll('.research-page .research-card')
    .forEach(paper => {
      if (paper.matches('.firstPaper, .otherPaper') && !paper.dataset.article) {
        paper.dataset.article = 'Article';
      }

      const image = paper.querySelector(':scope > .paper-image');
      if (!image || paper.querySelector(':scope > .paper-copy')) return;

      const copy = document.createElement('div');
      copy.className = 'paper-copy';
      while (image.nextSibling) {
        copy.appendChild(image.nextSibling);
      }
      paper.appendChild(copy);
    });
});

function matchesPaperRole(paper, role) {
  if (role === 'first') return paper.classList.contains('firstPaper');
  if (role === 'corresponding') {
    const authors = paper.querySelector('author')?.textContent || '';
    return authors.split(/[,，;；]/).some(author =>
      /^(?:Junjie\s+Ma|马俊杰)(?=[\s\d†‡*＊]|$).*[*＊]/i.test(author.trim())
    );
  }
  return true;
}

function matchesPaperLanguage(paper, sectionId) {
  return sectionId === 'all' || Boolean(paper.closest(`#${sectionId}`));
}

function updatePaperOptionCounts(sectionId, role) {
  const papers = [...document.querySelectorAll('.firstPaper, .otherPaper')];
  document.querySelectorAll('.paper-controls [data-paper-section], .paper-controls [data-paper-role]')
    .forEach(option => {
      // Show the result of choosing this option while keeping the other filter.
      const optionSection = option.dataset.paperSection || sectionId;
      const optionRole = option.dataset.paperRole || role;
      const count = papers.filter(paper =>
        matchesPaperLanguage(paper, optionSection) && matchesPaperRole(paper, optionRole)
      ).length;
      option.textContent = `${option.dataset.label}: ${count}`;
    });
}

function applyPaperFilters() {
  const sectionId = document.querySelector('[data-paper-section][aria-pressed="true"]').dataset.paperSection;
  const role = document.querySelector('[data-paper-role][aria-pressed="true"]').dataset.paperRole;
  const papers = document.querySelectorAll('.firstPaper, .otherPaper');
  let count = 0;
  papers.forEach(paper => {
    const matchesLanguage = matchesPaperLanguage(paper, sectionId);
    if (matchesLanguage && matchesPaperRole(paper, role)) {
      paper.style.removeProperty('display');
      count += 1;
    } else {
      paper.style.display = 'none';
    }
  });
  ['pubmedPapers', 'cnkiPapers'].forEach(id => {
    const section = document.getElementById(id);
    const hasVisiblePapers = [...section.querySelectorAll('.firstPaper, .otherPaper')]
      .some(paper => paper.style.display !== 'none');
    section.style.display = hasVisiblePapers ? '' : 'none';
  });
  const labels = {
    all: 'Total papers',
    first: 'First/co-first author papers',
    corresponding: 'Corresponding author papers'
  };
  const languages = { all: '', pubmedPapers: 'English · ', cnkiPapers: 'Chinese · ' };
  document.getElementById('firstAuthorCount').textContent = `${languages[sectionId]}${labels[role]}: ${count}`;
  updatePaperOptionCounts(sectionId, role);
  document.dispatchEvent(new CustomEvent('papers:filtered', {
    detail: [...papers].filter(paper => matchesPaperLanguage(paper, sectionId) && matchesPaperRole(paper, role))
  }));
}
