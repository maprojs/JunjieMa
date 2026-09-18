function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
  document.body.style.overflow = '';
}

function showModalWithFile(modalId, outTextId, fileName) {
  const uniqueId = outTextId.split('-')[1];
  const loadingId = 'loading-' + uniqueId;
  const loading = document.getElementById(loadingId);
  const modal = document.getElementById(modalId);
  const outBox = document.getElementById(outTextId);
  showModal(modalId);
  if (outBox.dataset.loadedFile === fileName) {
    loading.style.display = 'none';
    return;
  }
  if (outBox.dataset.loadingFile === fileName) return;
  outBox.dataset.loadingFile = fileName;
  loading.style.display = 'flex';
    fetch(fileName)
      .then(r => {
        if (!r.ok) throw new Error(`Failed to load file: ${r.status}`);
        return r.text();
      })
      .then(html => {
        loading.style.display = 'none';
        outBox.innerHTML = html;
        outBox.dataset.loadedFile = fileName;
        outBox.style.fontSize = '';
        outBox.style.textAlign = '';
        const content = modal.querySelector('.modal-content'); 
        const contentHeight = content.scrollHeight; 
        const viewHeight = window.innerHeight;
        if (contentHeight > viewHeight) {
          content.style.maxHeight = (viewHeight * 0.8) + 'px';
        } else {
          content.style.maxHeight = '90vh';
        }
      })
      .catch(err => {
        console.error(err);
        loading.style.display = 'none';
        outBox.style.fontSize = '20px';
        outBox.style.textAlign = 'center';
        outBox.innerText = 'The file cannot be loaded 🤨';
      })
      .finally(() => {
        delete outBox.dataset.loadingFile;
      });
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
