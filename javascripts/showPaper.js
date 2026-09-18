let showAllPapers = false;

document.addEventListener('DOMContentLoaded', () => {
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

function toggleFirstAuthor() {
  const firstPapers = document.querySelectorAll('.firstPaper');
  const otherPapers = document.querySelectorAll('.otherPaper');
  const filterBtn = document.getElementById('paperFilter');
  const firstAuthorCount = document.getElementById('firstAuthorCount');

  if (!showAllPapers) {
    otherPapers.forEach(p => p.style.display = 'none');
    firstPapers.forEach(p => p.style.removeProperty('display'));
    filterBtn.innerText = 'allPapers';
    firstAuthorCount.textContent = `First/co-first author papers: ${firstPapers.length}`;
    showAllPapers = true;
  } else {
    otherPapers.forEach(p => p.style.removeProperty('display'));
    firstPapers.forEach(p => p.style.removeProperty('display'));
    filterBtn.innerText = '1stAuthor';
    firstAuthorCount.textContent = `Total papers: ${firstPapers.length + otherPapers.length}`;
    showAllPapers = false;
  }
}
