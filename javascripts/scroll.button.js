var scrollToTopButton = document.getElementById("scrollToTop");
var firstHeading = document.querySelector("section h2:first-of-type");
var scrollToSelector = document.getElementById('scrollToSection');

function isOutOfViewport(element) {
    var rect = element.getBoundingClientRect();
    return (
        rect.top >= window.innerHeight || 
        rect.bottom < 0 ||                 
        rect.right < 0 ||                  
        rect.left >= window.innerWidth     
    );
}

/*function buttonVisibility() {
    if (isOutOfViewport(firstHeading)) {
        scrollToTopButton.style.display = "block";
    } else {
        scrollToTopButton.style.display = "none";
    }
    if (window.innerWidth < 1100) {
        scrollToSelector.style.display = "block";
    } else {
        scrollToSelector.style.display = "block";
    }
}*/

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function scrollToSection(sectionId) {
  var section = document.getElementById(sectionId);
  if (section) {
    var scrollPosition = section.offsetTop - 150;
    if (scrollPosition < 0) {
      scrollPosition = 0;
    }
    window.scrollTo({
      top: scrollPosition,
      behavior: 'smooth'
    });
  }
}

function topButtonPosition() {
  const section = document.querySelector('section');
  if (section) {
    const sectionRect = section.getBoundingClientRect();
    let buttonRight = window.innerWidth - (sectionRect.right + 200);
    buttonRight = Math.max(buttonRight, 0);
    scrollToTopButton.style.right = `${buttonRight}px`;
  }
}

function sectionButtonPosition() {
  const section = document.querySelector('section');
  if (section) {
    const sectionRect = section.getBoundingClientRect();
    let buttonRight = window.innerWidth - (sectionRect.right + 200);
    buttonRight = Math.max(buttonRight, 0);
    scrollToSelector.style.right = `${buttonRight}px`;
  }
}

/*window.addEventListener("scroll", buttonVisibility);*/
/*scrollToTopButton.addEventListener("click", scrollToTop);*/

window.addEventListener('resize', () => {
  /*topButtonPosition();*/
  sectionButtonPosition();
  /*buttonVisibility(); */
});

document.addEventListener('DOMContentLoaded', () => {
  /*topButtonPosition();*/
  sectionButtonPosition();
  /*buttonVisibility(); */
});

/*buttonVisibility();*/