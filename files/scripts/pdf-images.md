# PDF image navigation

Image extraction and the zoom/fullscreen preview share the single module `pdfViewer/javascripts/pdf-images.js`.

The Images tab follows Bookmarks in the 240px navigation sidebar. Page thumbnails are 140px wide, image previews 160px. Labels use Image n/total. Clicking a preview navigates to its PDF page; scrolling the document selects the matching images.

Extraction starts when Images is opened and pauses when hidden. A loading animation replaces progress text. By default both dimensions must exceed 200px; Show all includes small images. The circular information button opens a blue explanation below it.

Each preview has enlarge and PNG download actions. On desktop, the image area is 70vh tall, with the header and zoom toolbar added separately. Dialog width follows the image aspect ratio with a 400px minimum; the whole dialog stays within the viewport. On mobile, the dialog is 80vw wide and its height follows the image aspect ratio, with a minimum image-area height of 240px plus the toolbars. On short screens, the image area can shrink to keep the controls visible. Fullscreen fills the viewport. The dialog supports buttons, percentage presets, wheel zoom, touch pinch and panning. Its top-right controls are Download, Fullscreen, Close. Fullscreen preserves an existing reader fullscreen session; unsupported browsers use the viewport. Image menus use the blue fill and white text. Native English labels match this website.

The extractor uses the locally bundled PDF.js 5.4.624 document and deduplicates repeated source references. It handles bitmap objects, inline images and inline atlases, preserving image alpha. Vector drawings, independent text, page clipping and blend effects are not combined into figures. Previews are generated lazily for the 160px sidebar width, allowing up to 2x pixels on high-DPI screens (at most 320px wide and 640px tall, without upscaling small images). Preview resources are released outside the visible region. Full-resolution PNGs are generated only when enlarging or downloading an image; these use decoded source dimensions.
