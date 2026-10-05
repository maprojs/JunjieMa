(() => {
  const files = new Map();
  let modal, panel, output, loading, opener, previousOverflow, closingAnimation;
  let requestVersion = 0;

  function createModal() {
    if (modal) return;
    modal = document.createElement('dialog');
    modal.id = 'file-modal';
    modal.className = 'modal';
    modal.setAttribute('aria-label', 'Details');
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <button type="button" class="close" aria-label="Close dialog" autofocus>&times;</button>
        </div>
        <div class="modal-body">
          <div class="loading" role="status" aria-label="Loading content">
            <div class="mjjLoader" aria-hidden="true">${'<div></div>'.repeat(7)}</div>
          </div>
          <div class="modal-output" aria-live="polite"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    panel = modal.querySelector('.modal-content');
    output = modal.querySelector('.modal-output');
    loading = modal.querySelector('.loading');
    modal.querySelector('.close').addEventListener('click', closeModal);
    modal.addEventListener('cancel', event => {
      event.preventDefault();
      closeModal();
    });
    modal.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const targets = [...modal.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
        .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    // A selection ending on the backdrop must not dismiss the dialog.
    let pressedBackdrop = false;
    modal.addEventListener('pointerdown', event => {
      pressedBackdrop = event.target === modal;
    });
    modal.addEventListener('click', event => {
      if (pressedBackdrop && event.target === modal) closeModal();
      pressedBackdrop = false;
    });
  }

  function finishClose() {
    modal.close();
    document.body.style.overflow = previousOverflow;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }

  function closeModal() {
    if (!modal?.open || closingAnimation) return;
    requestVersion += 1;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finishClose();
      return;
    }
    const animation = modal.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 140, easing: 'ease-out'
    });
    closingAnimation = animation;
    animation.onfinish = () => {
      closingAnimation = undefined;
      finishClose();
    };
  }

  function loadFile(fileName) {
    if (!files.has(fileName)) {
      const pending = fetch(fileName).then(response => {
        if (!response.ok) throw new Error(`Failed to load file: ${response.status}`);
        return response.text();
      }).catch(error => {
        files.delete(fileName); // Allow retry after a failed request.
        throw error;
      });
      files.set(fileName, pending);
    }
    return files.get(fileName);
  }

  async function openFileModal(fileName, options = {}) {
    createModal();
    closingAnimation?.cancel();
    closingAnimation = undefined;
    const version = ++requestVersion;
    panel.style.maxWidth = options.maxWidth || '800px';
    panel.style.textAlign = options.textAlign || 'justify';
    modal.setAttribute('aria-label', options.title || 'Details');
    output.replaceChildren();
    const isPaperAbstract = /^files\/content\/research\/papers\/abstract\//.test(fileName);
    output.classList.toggle('paper-abstract', isPaperAbstract);
    output.removeAttribute('lang');
    loading.style.display = 'flex';
    output.setAttribute('aria-busy', 'true');
    if (!modal.open) {
      opener = document.activeElement;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      modal.showModal(); // Native focus containment and background inertness.
    }
    modal.querySelector('.modal-body').scrollTop = 0;
    try {
      const html = await loadFile(fileName);
      // Ignore a slow response after switching files or closing.
      if (version !== requestVersion || !modal.open) return;
      output.innerHTML = html;
      if (isPaperAbstract) {
        // Some Chinese-journal papers have English abstracts; use the actual text language.
        output.lang = /\p{Script=Han}/u.test(output.textContent) ? 'zh-CN' : 'en';
      }
    } catch (error) {
      if (version !== requestVersion || !modal.open) return;
      console.error(error);
      const message = document.createElement('p');
      message.className = 'modal-error';
      message.textContent = 'The file cannot be loaded. Please close and try again.';
      output.appendChild(message);
    } finally {
      if (version === requestVersion) {
        loading.style.display = 'none';
        output.setAttribute('aria-busy', 'false');
      }
    }
  }

  window.openFileModal = openFileModal;
  window.closeModal = closeModal;
  // Existing three-argument links also work without per-file HTML.
  window.showModalWithFile = (_modalId, _outTextId, fileName) => openFileModal(fileName);

  // Safari may show focus-visible after programmatic focus on touch activation.
  // Track the input method while keeping focus restoration and keyboard cues.
  document.addEventListener('pointerdown', () => {
    document.documentElement.dataset.modalInput = 'pointer';
  }, { capture: true, passive: true });
  document.addEventListener('keydown', event => {
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
    delete document.documentElement.dataset.modalInput;
  }, true);

  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-modal-file]');
    if (!trigger) return;
    event.preventDefault();
    trigger.focus({ preventScroll: true });
    openFileModal(trigger.dataset.modalFile, {
      maxWidth: trigger.dataset.modalWidth,
      textAlign: trigger.dataset.modalAlign,
      title: trigger.dataset.modalTitle || trigger.textContent.trim() || 'Details'
    });
  });
})();
