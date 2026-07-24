(() => {
  const mobileQuery = window.matchMedia("(max-width: 720px)");
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const storageKey = "junjie-ma-theme";

  function readSavedTheme() {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(storageKey, theme);
    } catch {
      // The selected theme still applies for the current page.
    }
  }

  function preferredTheme() {
    if (mobileQuery.matches) {
      return darkQuery.matches ? "dark" : "light";
    }

    return readSavedTheme() || (darkQuery.matches ? "dark" : "light");
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;

    const toggle = document.getElementById("themeToggle");
    if (!toggle) return;

    const isDark = theme === "dark";
    const label = isDark ? "Switch to light mode" : "Switch to dark mode";
    const iconClass = isDark ? "sun-icon" : "moon-icon";
    toggle.innerHTML = `<span class="${iconClass}" aria-hidden="true">${isDark ? "☀" : "☾"}</span>`;
    toggle.setAttribute("aria-label", label);
    toggle.setAttribute("title", label);
    toggle.setAttribute("aria-pressed", String(isDark));
  }

  function bindToggle() {
    applyTheme(preferredTheme());

    document.getElementById("themeToggle")?.addEventListener("click", () => {
      if (mobileQuery.matches) return;

      const currentTheme = document.documentElement.dataset.theme;
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
      saveTheme(nextTheme);
    });
  }

  applyTheme(preferredTheme());

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindToggle, { once: true });
  } else {
    bindToggle();
  }

  darkQuery.addEventListener("change", (event) => {
    if (mobileQuery.matches || !readSavedTheme()) {
      applyTheme(event.matches ? "dark" : "light");
    }
  });

  mobileQuery.addEventListener("change", () => {
    applyTheme(preferredTheme());
  });
})();
