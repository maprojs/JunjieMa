# PDF printing

The desktop Print PDF button follows Search and precedes Download. On mobile it appears between Search and Fullscreen in More tools. The preparation dialog stays centered; the original-PDF link uses font weight 500.

The controller reads the loaded PDF.js document with getData(), caches the original application/pdf Blob, and loads it in a native PDF iframe for printing. It does not rasterize pages or request the original file again. Repeated printing and the fallback link reuse the cached Blob. Cancel and Escape remove the temporary iframe; page disposal also revokes the Blob URL.

Native PDF printing depends on browser support. If embedding or printing fails, open the original PDF using the fallback link. The browser or printer driver may still rasterize output (including some Microsoft Print to PDF configurations); downloading the original PDF preserves its original bytes.
