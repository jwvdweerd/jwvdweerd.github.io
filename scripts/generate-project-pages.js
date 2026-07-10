const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const records = JSON.parse(fs.readFileSync(path.join(rootDir, 'records.json'), 'utf8'));
const projectsDir = path.join(rootDir, 'projects');

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeText(value) {
    return String(value ?? '').trim();
}

function descriptionFrom(record) {
    const info = normalizeText(record.info);
    if (info && !/^\.{1,3}$/.test(info)) {
        return info.replace(/\s+/g, ' ').slice(0, 180);
    }
    return `${record.title} by ${record.artist}, ${record.year}.`;
}

function projectImageMarkup(record) {
    const thumbnails = Array.isArray(record.thumbnails) ? record.thumbnails : [];
    const highres = Array.isArray(record.highres) ? record.highres : [];
    return thumbnails.map((thumbnail, index) => {
        const fullImage = highres[index] || thumbnail;
        return `
            <figure class="project-image-card">
                <button type="button" class="project-image-trigger" data-index="${index}">
                    <img src="/${encodeURI(thumbnail)}" alt="${escapeHtml(record.title)} image ${index + 1}" loading="lazy">
                </button>
            </figure>`;
    }).join('\n');
}

function projectModalMarkup() {
    return `
    <div id="modal" class="modal" style="display:none;">
        <div class="modal-content">
            <span class="close" onclick="closeModal('modal')">&times;</span>
            <div id="modal-body"></div>
        </div>
    </div>

    <div id="highResModal" class="modal" style="display:none;">
        <div class="modal-content high-res-modal-content">
            <span class="close" onclick="closeModal('highResModal')">&times;</span>
            <button id="prevImage" class="nav-btn" aria-label="Vorige" onclick="navigateHighResImage(-1)">&#9664;</button>
            <div id="highResImage" class="high-res-content"></div>
            <button id="nextImage" class="nav-btn" aria-label="Volgende" onclick="navigateHighResImage(1)">&#9654;</button>
            <div class="zoom-controls">
                <button class="zoom-btn" onclick="zoomImage('-')" title="Zoom Out">-</button>
                <select class="zoom-select" id="zoomSelect" onchange="setZoomLevel(this.value)">
                    <option value="25">25%</option>
                    <option value="50">50%</option>
                    <option value="75">75%</option>
                    <option value="100" selected>100%</option>
                    <option value="125">125%</option>
                    <option value="150">150%</option>
                    <option value="200">200%</option>
                    <option value="300">300%</option>
                    <option value="400">400%</option>
                    <option value="500">500%</option>
                </select>
                <button class="zoom-btn" onclick="zoomImage('+')" title="Zoom In">+</button>
                <button class="zoom-btn fit-btn" onclick="fitZoomLevel()" title="Fit to 100%">Fit</button>
            </div>
        </div>
    </div>`;
}

function projectPageTemplate(record) {
    const projectUrl = `projects/${record.id}/index.html`;
    const description = descriptionFrom(record);
    const info = normalizeText(record.info);
    const release = normalizeText(record.release);
    const pdf = normalizeText(record.pdf);
    const imageMarkup = projectImageMarkup(record);
    const projectImages = JSON.stringify((Array.isArray(record.highres) && record.highres.length ? record.highres : record.thumbnails) || []);
    const projectPdf = JSON.stringify(pdf || '');
    const projectRecordId = JSON.stringify(record.id);

    return `<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="color-scheme" content="light">
    <title>${escapeHtml(record.title)} - Jan Willem van der Weerd</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="/${projectUrl}">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="stylesheet" href="/css/style.css">
    <script src="/js/nav.js"></script>
</head>
<body>
    <header>
        <h1>Jan Willem van der Weerd (1943-2024) - architect</h1>
        <nav></nav>
    </header>
    <main class="project-page">
        <p class="project-backlink"><a href="/collection.html">Back to project index</a></p>
        <article class="project-detail">
            <h1 class="project-title">${escapeHtml(record.title)}</h1>
            <div class="project-hero">
                <button type="button" class="project-hero-trigger" aria-label="Open ${escapeHtml(record.title)} viewer">
                    <img src="/${encodeURI(record.cover)}" alt="${escapeHtml(record.title)}" loading="eager">
                </button>
            </div>
            <dl class="project-facts">
                <div><dt>Artist</dt><dd>${escapeHtml(record.artist)}</dd></div>
                <div><dt>Year</dt><dd>${escapeHtml(record.year)}</dd></div>
                <div><dt>Genre</dt><dd>${escapeHtml(record.genre)}</dd></div>
                <div><dt>Label</dt><dd>${escapeHtml(record.label)}</dd></div>
            </dl>
            ${info ? `<p class="project-info">${escapeHtml(info).replace(/\n/g, '<br>')}</p>` : ''}
            ${release && !/^\.{1,3}$/.test(release) ? `<p class="project-link-row"><a href="${escapeHtml(release)}" target="_blank" rel="noopener noreferrer">External reference</a></p>` : ''}
            ${pdf ? `<p class="project-link-row"><a href="/${encodeURI(pdf)}" target="_blank" rel="noopener noreferrer">Open PDF</a></p>` : ''}
            <section class="project-gallery" aria-label="Project images">
                <h3>Image gallery</h3>
                <div class="project-gallery-grid">
                    ${imageMarkup}
                </div>
            </section>
        </article>
    </main>
    ${projectModalMarkup()}
    <footer>
        <p>&copy; 2024 R. van der Weerd - Netherlands. <a rel="license" href="http://creativecommons.org/licenses/by-nc/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-nc/4.0/88x31.png" /></a></p>
    </footer>
    <script>
        window.PROJECT_VIEWER = {
            recordId: ${projectRecordId},
            images: ${projectImages},
            pdfUrl: ${projectPdf}
        };
    </script>
    <script src="/js/script.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const config = window.PROJECT_VIEWER;
            if (!config || !Array.isArray(config.images) || !config.images.length) return;
            const openViewer = (index) => openHighResViewer(config.images, index, { recordId: config.recordId, pdfUrl: config.pdfUrl });
            const heroButton = document.querySelector('.project-hero-trigger');
            if (heroButton) heroButton.addEventListener('click', () => openViewer(0));
            document.querySelectorAll('.project-image-trigger').forEach((button) => {
                const index = Number(button.getAttribute('data-index') || '0');
                button.addEventListener('click', () => openViewer(index));
            });
        });
    </script>
</body>
</html>
`;
}

fs.mkdirSync(projectsDir, { recursive: true });

for (const record of records) {
    const projectDir = path.join(projectsDir, record.id);
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'index.html'), projectPageTemplate(record), 'utf8');
}

console.log(`Generated ${records.length} project pages in ${projectsDir}`);