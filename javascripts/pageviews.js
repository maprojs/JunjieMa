const viewsHome="170";
const viewsResearch="145";
const viewsEducation="89";
const lastUpdated="September 30, 2025";

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
  HomeElement.innerHTML=`${iconViews} <a href="${analyticsFile}" target="_blank" class="black-link">Pageviews: ${viewsHome}</a> (by ${analyticsLink})`;
  if (ResearchElement) {
    ResearchElement.innerHTML=`${iconViews}${' '}<a href="${analyticsFile}" target="_blank" class="black-link">Pageviews: ${viewsResearch}${' '}(by ${analyticsLink})`;
  }
  if (EducationElement) {
    EducationElement.innerHTML=`${iconViews}${' '}<a href="${analyticsFile}" target="_blank" class="black-link">Pageviews: ${viewsEducation}${' '}(by ${analyticsLink})`;
  }
}

window.onload=displayLastUpdatedData;
