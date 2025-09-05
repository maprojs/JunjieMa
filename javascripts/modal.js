function showModal(modalId) {
  document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

function showModalWithFile(modalId, outTextId, fileName) {
  const uniqueId   = outTextId.split('-')[1];
  const loadingId  = 'loading-' + uniqueId;
  const loading    = document.getElementById(loadingId);
  const modal      = document.getElementById(modalId);
  const outBox     = document.getElementById(outTextId);
  showModal(modalId);
  loading.style.display = 'flex';
  setTimeout(() => {
    fetch(fileName)
      .then(r => r.text())
      .then(html => {
        loading.style.display = 'none';
        outBox.innerHTML = html;
        const content = modal.querySelector('.modal-content'); 
        const contentHeight = content.scrollHeight; 
        const viewHeight    = window.innerHeight;
        if (contentHeight > viewHeight) {
          content.style.maxHeight = (viewHeight * 0.75) + 'px';
        } else {
          content.style.maxHeight = '90vh';
        }
      })
      .catch(err => {
        console.error(err);
        loading.style.display = 'none';
        outBox.innerText = 'Error loading file.';
      });
  }, 500);
}

window.onclick = function(event) {
    var modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
      if (event.target === modal) {
        closeModal(modal.id); 
      }
    });
};

document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape' || event.keyCode === 27) {
    document.querySelectorAll('.modal').forEach(modal => {
      if (modal.style.display === 'flex') {
        closeModal(modal.id);
      }
    });
  }
});
