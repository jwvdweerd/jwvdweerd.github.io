# jwvdweerd.github.io

Static archival/portfolio site for architect Jan Willem van der Weerd.

## Features
- Responsive static pages (home, collection, archive, contact)
- Data-driven project gallery (`records.json`) with client-side search (now includes project info in search)
- Accessible modal viewer with:
  - Image & PDF support (single-page PDF rendering via pdf.js)
  - High-res viewer with keyboard navigation, wrap-around, drag-pan, zoom (desktop) and native pinch-zoom (touch)
  - Reduced UI for mobile
- Lazy-loaded images for performance
- Graceful loading / error message for project data
- External link shown only when a valid URL exists
- Basic accessibility: focusable records, aria-labels, status region, focus outlines
- Contact form via Formspree with honeypot field against simple bots

## Running locally
Because it uses fetch() for `records.json`, serve over HTTP (not just file://).

Example with Python 3:
```bash
python -m http.server 8000
```
Open: http://localhost:8000/

## Data format (`records.json`)
Each entry contains: id, title, artist, year, genre, label, cover, thumbnails[], highres[], info, release.
IDs should be unique (duplicate 744 split into 744-stedenbouw and 744-hoogbouw).

## Adding a project
1. Place images/PDFs under `resources/<project-id>/`.
2. Add thumbnails (low/medium), highres (full), cover (thumbnail path) to `records.json`.
3. Optionally fill `info` and `release` (set `release` to `.` or omit if none).

## Accessibility notes
- Records are keyboard-activatable (Enter/Space).
- High-res modal can be closed with Escape.
- Navigation / zoom controls have visible focus outlines.

## Future ideas
- Multi-page PDF navigation
- Image captions/metadata
- Filtering by year range or tag pills
- Service worker caching

## License
Content © 2024 R. van der Weerd (see footer CC BY-NC 4.0 image). Code examples permissive.
