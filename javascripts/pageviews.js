const viewsHome="182";
const viewsResearch="145";
const viewsEducation="89";
const lastUpdated="November 30, 2025";

function displayLastUpdatedData() {
  const HomeElement=document.getElementById("viewsHome");
  const dateElement=document.getElementById("lastUpdatedDate");
  const ResearchElement=document.getElementById("viewsResearch");
  const EducationElement=document.getElementById("viewsEducation");
  const iconViews=`<img src="files/images/logo/views.webp" width="9.5" height="9.5" style="vertical-align:-1px;margin-right:1px;">`;
  const iconUpdate=`<img src="files/images/logo/update.webp" width="9.5" height="9.5" style="vertical-align:-1px;margin-right:1.2px;transform:rotate(-60deg);">`;
  const analyticsLink=`<a href="https://analytics.google.com" target="_blank">Google Analytics</a>`;
  const analyticsFile=`https://docs.junjiema.org/pageviews/analytics`;
  
  if (dateElement) {
    dateElement.innerHTML=`${iconUpdate}${' '}Time of last update:${' '}${lastUpdated}`;
  }
  if (HomeElement) {
    HomeElement.innerHTML=`${iconViews} Pageviews: ${viewsHome} (by ${analyticsLink})`;
    /*HomeElement.innerHTML=`${iconViews} <a href="${analyticsFile}" target="_blank" class="black-link">Pageviews: ${viewsHome}</a> (by ${analyticsLink})`;*/
  }
  if (ResearchElement) {
    ResearchElement.innerHTML=`${iconViews} Pageviews: ${viewsResearch} (by ${analyticsLink})`;
    /*ResearchElement.innerHTML=`${iconViews} <a href="${analyticsFile}" target="_blank" class="black-link">Pageviews: ${viewsResearch}</a> (by ${analyticsLink})`;*/
  }
  if (EducationElement) {
    EducationElement.innerHTML=`${iconViews} Pageviews: ${viewsEducation} (by ${analyticsLink})`;
    /*EducationElement.innerHTML=`${iconViews} <a href="${analyticsFile}" target="_blank" class="black-link">Pageviews: ${viewsEducation}</a> (by ${analyticsLink})`;*/
  }
}

window.onload=displayLastUpdatedData;



// visit-counts
(function () {
  const API = 'https://visit.junjiema.org/';

  function parseUrl(fullUrl) {
    const u = new URL(fullUrl);
    const domain = u.hostname;
    const page = u.pathname
      .replace(/\/index\.html?$/i, '')
      .replace(/\/$/, '')
      .replace(/^\/+/, '')
      || 'home';
    return { domain, page };
  }

  async function initExternalVisits() {
    const els = document.querySelectorAll('.page_visit[data-url]');
    if (!els.length) return;
    const unique = new Map();
    els.forEach(el => {
      const fullUrl = el.dataset.url;
      const mode = el.dataset.mode || 'read';
      const key = `${fullUrl}|${mode}`;
      if (!unique.has(key)) {
        unique.set(key, { fullUrl, mode, targets: [] });
      }
      unique.get(key).targets.push(el);
    });

    const promises = Array.from(unique.values()).map(async ({ fullUrl, mode, targets }) => {
      try {
        const { domain, page } = parseUrl(fullUrl);
        const params = new URLSearchParams({ page, domain, mode });

        const res = await fetch(`${API}?${params}`, {
          headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);

        const data = await res.json();
        targets.forEach(el => {
          el.textContent = data.count;
          el.title = `${page} · ${domain}`;
        });
      } catch (err) {
        console.error('[VisitCount]', fullUrl, err);
        targets.forEach(el => { el.textContent = '-'; });
      }
    });

    await Promise.all(promises);
  }

  function initCurrentPage() {
    const hostname = location.hostname;
    const isLocal = !hostname || hostname === 'localhost' || hostname === '127.0.0.1';

    if (isLocal) {
      document.querySelectorAll('.page_visit:not([data-url])').forEach(el => el.textContent = '-');
      document.querySelectorAll('.total_visit').forEach(el => el.textContent = '-');
      return;
    }

    // const domain = 'xy3hpb.org';
    const domain = hostname;
    const page = location.pathname
      .replace(/\/index\.html?$/i, '')
      .replace(/\/$/, '')
      .replace(/^\/+/, '')
      || 'home';

    fetch(`${API}?page=${encodeURIComponent(page)}&domain=${encodeURIComponent(domain)}`, {
      headers: { 'Accept': 'application/json' }
    })
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(data => {
        document.querySelectorAll('.page_visit:not([data-url])').forEach(el => {
          el.textContent = data.count;
        });
        document.querySelectorAll('.total_visit').forEach(el => {
          el.textContent = data.total;
        });
      })
      .catch(err => {
        console.error('[VisitCount]', err);
      });
  }
  initCurrentPage();
  initExternalVisits();
})();

