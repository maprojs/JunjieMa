document.addEventListener('DOMContentLoaded', () => {
  const controls = document.querySelector('.paper-controls');
  if (controls) {
    const closePopups = () => {
      controls.querySelectorAll('.paper-control-button').forEach(button => {
        button.setAttribute('aria-expanded', 'false');
        document.getElementById(button.getAttribute('aria-controls')).hidden = true;
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
          popup.hidden = false;
          popup.querySelector('button').focus();
        }
        return;
      }

      const trigger = button.closest('.paper-control').querySelector('.paper-control-button');
      closePopups();
      trigger.focus({ preventScroll: true });
      if (button.dataset.paperSection) {
        scrollToSection(button.dataset.paperSection);
        controls.querySelectorAll('[data-paper-section]').forEach(option => {
          option.setAttribute('aria-pressed', String(option === button));
        });
      }
      if (button.dataset.paperRole) {
        setPaperRole(button.dataset.paperRole);
        controls.querySelectorAll('[data-paper-role]').forEach(option => {
          option.setAttribute('aria-pressed', String(option === button));
        });
      }
    });

    document.addEventListener('click', event => {
      if (!controls.contains(event.target)) closePopups();
    });
    controls.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const trigger = controls.querySelector('[aria-expanded="true"]');
      closePopups();
      if (trigger) trigger.focus();
    });
    controls.addEventListener('focusout', event => {
      if (!controls.contains(event.relatedTarget)) closePopups();
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

function setPaperRole(role) {
  const firstPapers = document.querySelectorAll('.firstPaper');
  const otherPapers = document.querySelectorAll('.otherPaper');
  const firstAuthorCount = document.getElementById('firstAuthorCount');

  if (role === 'first') {
    otherPapers.forEach(p => p.style.display = 'none');
    firstPapers.forEach(p => p.style.removeProperty('display'));
    firstAuthorCount.textContent = `First/co-first author papers: ${firstPapers.length}`;
  } else {
    otherPapers.forEach(p => p.style.removeProperty('display'));
    firstPapers.forEach(p => p.style.removeProperty('display'));
    firstAuthorCount.textContent = `Total papers: ${firstPapers.length + otherPapers.length}`;
  }
}
