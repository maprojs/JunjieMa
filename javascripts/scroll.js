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
    highlightH3AfterScroll(section, scrollPosition);
  }
}

function highlightH3AfterScroll(sectionElement, targetScrollY) {
  var start = performance.now();
  var timeout = 1600; 
  var threshold = 6; 
  function step() {
    var now = performance.now();
    var currentY = window.scrollY || window.pageYOffset;
    var distance = Math.abs(currentY - targetScrollY);
    if (distance <= threshold || now - start >= timeout) {
      var others = document.querySelectorAll('.pub-item h3.author-highlight');
      others.forEach(function(h) {
        if (!sectionElement.contains(h)) {
          h.classList.remove('author-highlight');
        }
      });
      var h3 = sectionElement.querySelector('h3');
      if (h3) {
        h3.classList.add('author-highlight');
      }
      return;
    }
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function sectionButtonPosition() {
  const section = document.querySelector('section');
  if (section) {
    const sectionRect = section.getBoundingClientRect();
    let buttonRight = window.innerWidth - (sectionRect.right + 200);
    buttonRight = Math.max(buttonRight, 0);
    if (scrollToSelector) {
      scrollToSelector.style.right = `${buttonRight}px`;
    }
  }
}

window.addEventListener('resize', () => {
  sectionButtonPosition();
});
document.addEventListener('DOMContentLoaded', () => {
  sectionButtonPosition();
});

(function () {
  'use strict';
  function computeHoverSrcFrom(src) {
    if (!src) return '';
    const qIndex = src.indexOf('?');
    const hIndex = src.indexOf('#');
    const suffixIndex = Math.min(qIndex === -1 ? Infinity : qIndex, hIndex === -1 ? Infinity : hIndex);
    const main = suffixIndex === Infinity ? src : src.slice(0, suffixIndex);
    const tail = suffixIndex === Infinity ? '' : src.slice(suffixIndex);
    const lastDot = main.lastIndexOf('.');
    const lastSlash = main.lastIndexOf('/');
    if (lastDot > lastSlash) {
      return main.slice(0, lastDot) + '-a' + main.slice(lastDot) + tail;
    } else {
      return main + '-a' + tail;
    }
  }
  function initHoverSwap(root, opts) {
    root = root || document;
    opts = opts || {};
    const selector = opts.processAll
      ? 'img'
      : (opts.selector || 'img[data-hover-src], img[data-hover="auto"]');
    const imgs = Array.from(root.querySelectorAll(selector));
    imgs.forEach(img => {
      if (!img || img.__hoverSwapInitialized) return;
      img.__hoverSwapInitialized = true;
      const normalSrc = img.getAttribute('data-normal-src') || img.src || '';
      let hoverSrc = img.getAttribute('data-hover-src') || '';
      if (!hoverSrc && (img.getAttribute('data-hover') === 'auto' || img.getAttribute('data-hover') === 'true')) {
        hoverSrc = computeHoverSrcFrom(normalSrc);
      }
      if (!hoverSrc || hoverSrc === normalSrc) return;
      const pre = new Image();
      let enabled = false;
      pre.onload = function () {
        enabled = true;
        const applyHover = () => { try { img.src = hoverSrc; } catch (e) {} };
        const removeHover = () => { try { img.src = normalSrc; } catch (e) {} };
        img.addEventListener('mouseenter', applyHover);
        img.addEventListener('mouseleave', removeHover);
        const parentLink = img.closest('a');
        if (parentLink) {
          parentLink.addEventListener('focus', applyHover, true);
          parentLink.addEventListener('blur', removeHover, true);
        } else {
          img.addEventListener('focus', applyHover);
          img.addEventListener('blur', removeHover);
        }
        img.setAttribute('data-normal-src', normalSrc);
      };
      pre.onerror = function () {
        img.setAttribute('data-normal-src', normalSrc);
      };
      pre.src = hoverSrc;
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initHoverSwap(document); });
  } else {
    initHoverSwap(document);
  }
  window.initHoverSwap = initHoverSwap;
  window.computeHoverSrcFrom = computeHoverSrcFrom;
})();

(function () {
  'use strict';
  const BTN_SIZE = 44;
  const RIGHT_DESKTOP = 15;
  const BOTTOM_DESKTOP = 20;
  const RIGHT_MOBILE = 10;
  const BOTTOM_MOBILE = 18;
  const VELOCITY_THRESHOLD = 0.6;
  const CHECK_WINDOW = 150;
  const HIDE_DELAY = 2000;
  const EDGE_MARGIN = 80;

  function injectStyles() {
    if (document.getElementById('scroll-float-style')) return;
    const style = document.createElement('style');
    style.id = 'scroll-float-style';
    style.textContent = `
      #scroll-float-buttons {
        position: fixed;
        right: ${RIGHT_DESKTOP}px;
        bottom: ${BOTTOM_DESKTOP}px;
        z-index: 9999;
        width: ${BTN_SIZE}px;
        height: ${BTN_SIZE}px;
        pointer-events: none;
      }
      .scroll-float-btn {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        border: 1px solid var(--border);
        background: var(--bg);
        color: #fff;
        font-size: 1.25rem;
        line-height: 1;
        cursor: pointer;
        opacity: 0;
        transform: translateY(12px) scale(0.88);
        pointer-events: none;
        transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        margin: 0;
      }
      .scroll-float-btn.visible {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }
      @media (max-width: 640px) {
        #scroll-float-buttons {
          right: ${RIGHT_MOBILE}px;
          bottom: ${BOTTOM_MOBILE}px;
          width: 40px;
          height: 40px;
        }
        .scroll-float-btn {
          font-size: 1.1rem;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createButtons() {
    if (document.getElementById('scroll-float-buttons')) return;
    const wrap = document.createElement('div');
    wrap.id = 'scroll-float-buttons';
    wrap.innerHTML =
      '<button id="scrollToTopBtn" class="scroll-float-btn" aria-label="Top" title="Top">' +
        '<img src="https://xy3hpb.org/files/images/logo/top.webp" data-hover-src="https://xy3hpb.org/files/images/logo/top-a.webp" alt="Top" style="width:40px;height:40px;display:block;">' +
      '</button>' +
      '<button id="scrollToBottomBtn" class="scroll-float-btn" aria-label="Bottom" title="Bottom">' +
        '<img src="https://xy3hpb.org/files/images/logo/top.webp" data-hover-src="https://xy3hpb.org/files/images/logo/top-a.webp" alt="Bottom" style="width:40px;height:40px;display:block;transform:rotate(180deg);">' +
      '</button>';
    document.body.appendChild(wrap);

    if (window.initHoverSwap) {
      window.initHoverSwap(wrap, { selector: 'img[data-hover-src]' });
    }

    document.getElementById('scrollToTopBtn').addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.getElementById('scrollToBottomBtn').addEventListener('click', function () {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: max > 0 ? max : 0, behavior: 'smooth' });
    });

    const topBtn = document.getElementById('scrollToTopBtn');
    const bottomBtn = document.getElementById('scrollToBottomBtn');
    [topBtn, bottomBtn].forEach(function (btn) {
      btn.addEventListener('mouseenter', function () {
        clearTimeout(scrollTimeout);
      });
      btn.addEventListener('touchstart', function () {
        clearTimeout(scrollTimeout);
      }, { passive: true });

      function restartHideTimer() {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(function () {
          topBtn.classList.remove('visible');
          bottomBtn.classList.remove('visible');
          scrollHistory = [];
        }, HIDE_DELAY);
      }

      btn.addEventListener('mouseleave', restartHideTimer);
      btn.addEventListener('touchend', restartHideTimer);
    });
  }

  function init() {
    injectStyles();
    createButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  let scrollTimeout;
  let scrollHistory = [];

  function resetHideTimer(topBtn, bottomBtn) {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(function () {
      topBtn.classList.remove('visible');
      bottomBtn.classList.remove('visible');
      scrollHistory = [];
    }, HIDE_DELAY);
  }

  function onScroll() {
    const now = Date.now();
    const currentY = window.scrollY || window.pageYOffset;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

    scrollHistory.push({ y: currentY, t: now });
    scrollHistory = scrollHistory.filter(h => now - h.t <= CHECK_WINDOW);

    const topBtn = document.getElementById('scrollToTopBtn');
    const bottomBtn = document.getElementById('scrollToBottomBtn');
    if (!topBtn || !bottomBtn) return;

    let showTop = false;
    let showBottom = false;

    if (scrollHistory.length >= 2) {
      const first = scrollHistory[0];
      const last = scrollHistory[scrollHistory.length - 1];
      const deltaY = last.y - first.y;
      const deltaT = last.t - first.t;

      if (deltaT > 0) {
        const velocity = deltaY / deltaT;

        if (velocity > VELOCITY_THRESHOLD && currentY < maxScroll - EDGE_MARGIN) {
          showBottom = true;
        } else if (velocity < -VELOCITY_THRESHOLD && currentY > EDGE_MARGIN) {
          showTop = true;
        }
      }
    }

    if (showTop) {
      topBtn.classList.add('visible');
      bottomBtn.classList.remove('visible');
      resetHideTimer(topBtn, bottomBtn);
    } else if (showBottom) {
      bottomBtn.classList.add('visible');
      topBtn.classList.remove('visible');
      resetHideTimer(topBtn, bottomBtn);
    }
    // showTop/showBottom 都为 false 时：不操作 DOM，保持当前显示状态
  }

  window.addEventListener('scroll', onScroll, { passive: true });
})();