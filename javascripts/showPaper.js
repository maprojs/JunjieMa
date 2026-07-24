let showAllPapers = false;

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#pubmedPapers > .firstPaper, #pubmedPapers > .otherPaper, #cnkiPapers > .firstPaper, #cnkiPapers > .otherPaper')
    .forEach(paper => {
      if (!paper.dataset.article) {
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

  if (!showAllPapers) {
    otherPapers.forEach(p => p.style.display = 'none');
    firstPapers.forEach(p => p.style.removeProperty('display'));
    filterBtn.innerText = 'allPapers';
    showAllPapers = true;
  } else {
    otherPapers.forEach(p => p.style.removeProperty('display'));
    firstPapers.forEach(p => p.style.removeProperty('display'));
    filterBtn.innerText = '1stAuthor';
    showAllPapers = false;
  }
}
