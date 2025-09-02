function showModal(modalId) {
  document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

function showModalWithFile(modalId, outTextId, fileName) {
  const uniqueId = outTextId.split('-')[1];
  const loadingId = 'loading-' + uniqueId;
  const loading = document.getElementById(loadingId);
  showModal(modalId);
  loading.style.display = 'flex';
  setTimeout(() => {
  fetch(fileName)
    .then(response => response.text())
    .then(data => {
      loading.style.display = 'none'; 
      document.getElementById(outTextId).innerHTML = data;
    })
    .catch(error => {
      console.error('Error fetching file:', error);
      loading.style.display = 'none';
      document.getElementById(outTextId).innerText = 'Error loading file.';
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
