# Personal Website
Repository for Junjie Ma's academic research website.

You can access the website through the following link: [Junjie Ma](https://junjiema.org).

## File modals

All pages share one native dialog, created by `javascripts/modal.js` on demand. To add an Abstract link, only add the content file and this link; no modal HTML or unique IDs are needed:

```html
<a href="files/content/research/papers/abstract/202205042.txt"
   data-modal-file="files/content/research/papers/abstract/202205042.txt"
   class="research-link">Abstract</a>
```

Optional attributes: `data-modal-width="700px"`, `data-modal-align="left"`, and `data-modal-title="Achievements"`. Content files contain trusted repository HTML. Successful requests are cached for the page session; failed requests can be retried by reopening. The dialog supports Escape, backdrop click, keyboard focus containment, focus restoration, and reduced motion. JavaScript callers can use `openFileModal(fileName, { maxWidth, textAlign, title })`; the old three-argument `showModalWithFile` call remains supported.

## Paper citation counts

The `Update Daily Publication Citations` GitHub Actions workflow fetches Crossref counts daily at 24:00 UTC (00:00 the next day; scheduled runs may be delayed). It also supports manual runs from the Actions tab. Push these files to the default branch to enable the schedule; Actions must be allowed to write repository contents.

The script reads active `data-doi` attributes from `research.html`, excluding HTML comments, and saves compressed snapshots with a plain JSON fallback. Failed requests are retried three times and recorded as `null`; an entirely failed run preserves the previous snapshot.

Run locally with Node.js 22 or later:

```sh
node files/scripts/update-citations.cjs
node --test files/scripts/update-citations.test.cjs
node --test files/scripts/paper-order.test.cjs
```

The page loads the saved snapshot by default. **Force update** bypasses the browser cache to reload the latest published snapshot; it does not trigger GitHub Actions. **Fetch online** queries Crossref directly for all DOI-bearing papers, with bounded concurrency and request timeouts. Missing counts appear as `-`, while a genuine zero remains `0`. Both actions appear as borderless links inside the paper list's Note, without an unavailable-count summary.

The paper controls display the selected language, author role, and order. Default order restores the exact HTML source order. Year order uses descending publication year, then English before Chinese, then descending PMID for English papers; Chinese ties retain source order. Impact-factor and citation orders put known numeric values first, descending, with year ordering for ties and unavailable values. Filters and ordering apply before pagination. Citation ordering updates after a snapshot or live refresh.
