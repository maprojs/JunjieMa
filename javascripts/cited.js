const MAX_REQUESTS = 50;
const MAX_CONCURRENT = 5;

function getCitationCount(doi) {
  const api = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
  return fetch(api)
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(data => data.message['is-referenced-by-count'] ?? 0);
}

const queue = [];
let activeCount = 0;
let lastTime = Date.now();
let requestCount = 0;

function processQueue() {
  if (queue.length === 0) return;
  const now = Date.now();
  if (now - lastTime >= 1000) {
    requestCount = 0;
    lastTime = now;
  }
  while (activeCount < MAX_CONCURRENT && requestCount < MAX_REQUESTS && queue.length > 0) {
    const { doi, span, resolve, reject } = queue.shift();
    activeCount++;
    requestCount++;
    getCitationCount(doi)
      .then(count => {
        span.textContent = count;
        resolve(count);
      })
      .catch(() => {
        span.textContent = 0;
        reject();
      })
      .finally(() => {
        activeCount--;
        processQueue();
      });
  }
  if (queue.length > 0) {
    setTimeout(processQueue, 50);
  }
}

function enqueueRequest(doi, span) {
  return new Promise((resolve, reject) => {
    queue.push({ doi, span, resolve, reject });
    processQueue();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.cited').forEach((span) => {
    const doi = span.dataset.doi;
    if (!doi) return;
    enqueueRequest(doi, span);
  });
});
