# Download selected PDF pages

Clicking Download PDF still downloads the complete original file and opens a small panel underneath the button. Click the Save selected pages? text to enter pages such as 1-3、5、8-10. Separators include English comma (,), Chinese comma (，), and enumeration comma (、). Duplicate pages are removed and the original page order is preserved. Numbers refer to actual PDF page positions, starting at 1.

The panel uses z-index 5, one level above the search panel (4), and stays inside the mobile viewport. After each opening, the first outside click keeps it visible; the second closes it. The top-right close button or Escape closes it immediately. Text presets below download the first, odd or even pages directly, using actual PDF page positions. The hint lists all three separators. Invalid ranges are shown inline.

The local, lazily imported pdf-lib 1.17.1 (MIT) copies original pages from the loaded PDF bytes. It does not use screenshots or printing. Encrypted documents show an extraction error while the original download remains available. Exported files use the original name followed by _pages_ and the selected ranges.
