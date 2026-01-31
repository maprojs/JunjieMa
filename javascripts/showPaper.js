let showAllPapers = false;

function toggleFirstAuthor() {
  const firstPapers = document.querySelectorAll('.firstPaper');
  const otherPapers = document.querySelectorAll('.otherPaper');
  const filterBtn = document.getElementById('paperFilter');

  if (!showAllPapers) {
    otherPapers.forEach(p => p.style.display = 'none');
    firstPapers.forEach(p => p.style.display = 'block');
    filterBtn.innerText = 'allPapers';
    showAllPapers = true;
  } else {
    otherPapers.forEach(p => p.style.display = 'block');
    firstPapers.forEach(p => p.style.display = 'block');
    filterBtn.innerText = '1stAuthor';
    showAllPapers = false;
  }
}