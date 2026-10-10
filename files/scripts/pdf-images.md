# PDF image navigation

Image extraction and the zoom/fullscreen preview share the single module `pdfViewer/javascripts/pdf-images.js`.

The Images tab follows Bookmarks in the 240px navigation sidebar. Page thumbnails are 140px wide, image previews 160px. Labels use Image n/total. Clicking a preview navigates to its PDF page; scrolling the document selects the matching images.

Extraction starts when Images is opened and pauses when hidden. A loading animation replaces progress text. By default both dimensions must exceed 200px; Show all includes small images. The circular information button opens a blue explanation below it.

Each preview has enlarge and PNG download actions. The centered image dialog supports buttons, percentage presets, wheel zoom, touch pinch and panning. Its top-right controls are Download, Fullscreen, Close. Fullscreen preserves an existing reader fullscreen session; unsupported browsers use the viewport. Image menus use the blue fill and white text. Native English labels match this website.

The extractor uses the locally bundled PDF.js 5.4.624 document and deduplicates repeated source references. It handles bitmap objects, inline images and inline atlases, preserving image alpha. Vector drawings, independent text, page clipping and blend effects are not combined into figures. Preview resources are lazy-loaded and released outside the visible region; PNG downloads use decoded source dimensions.
