function getCitationCount(doi) {
  const api = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
  return fetch(api)
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(data => data.message['is-referenced-by-count'] ?? 0);
}
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.cited').forEach(async (span) => {
    const doi = span.dataset.doi;
    if (!doi) return;
    try {
      const count = await getCitationCount(doi);
      span.textContent = count;
    } catch {
      span.textContent = 0;
    }
  });
});