const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const startMarker = '<!-- PROJECT_INDEX_START -->';
const endMarker = '<!-- PROJECT_INDEX_END -->';

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

function imageSource(image) {
    if (typeof image === 'string') return image;
    return image && typeof image.src === 'string' ? image.src : '';
}

function isPlaceholder(value) {
    return !value || /^\.{1,3}$/.test(value);
}

function formatInfo(value) {
    return escapeHtml(value).replace(/[ \t]+$/gm, '');
}

function projectIndexMarkup(records, { outputDir = 'projects' } = {}) {
    const projects = records.map((record, index) => {
        const info = normalizeText(record.info);
        const release = normalizeText(record.release);
        const pdf = normalizeText(record.pdf);
        const cover = imageSource(record.cover);
        const projectUrl = `${outputDir}/${record.id}/index.html`;
        const selectedClass = index === 0 ? 'record is-selected' : 'record';
        return `            <article class="${selectedClass}" id="seo-${escapeHtml(record.id)}" tabindex="0" role="button" aria-label="Project: ${escapeHtml(record.title)}. Klik voor details."
                data-id="${escapeHtml(record.id)}"
                data-title="${escapeHtml(record.title)}"
                data-artist="${escapeHtml(record.artist)}"
                data-year="${escapeHtml(record.year)}"
                data-genre="${escapeHtml(record.genre)}"
                data-label="${escapeHtml(record.label)}"
                data-thumbnails="${escapeHtml(JSON.stringify(record.thumbnails || []))}"
                data-highres="${escapeHtml(JSON.stringify(record.highres || []))}"
                data-info="${escapeHtml(info)}"
                data-release="${escapeHtml(release)}"${pdf ? `
                data-pdf="${escapeHtml(pdf)}"` : ''}>
                <a class="record-project-link visually-hidden" href="/${escapeHtml(encodeURI(projectUrl))}" tabindex="-1" aria-hidden="true">Open ${escapeHtml(record.title)}</a>
                <img src="/${escapeHtml(encodeURI(cover))}" alt="${escapeHtml(record.title)}" class="album-cover" loading="lazy">
                <div class="info">
                    <h3 class="data-title">${escapeHtml(record.title)}</h3>
                    <p><strong>Ontwerp:</strong> <span class="data-artist">${escapeHtml(record.artist).replace(/&amp;/g, '&amp;<br>')}</span></p>
                    <p><strong>Jaar:</strong> <span class="data-year">${escapeHtml(record.year)}</span></p>
                    <p><strong>Status:</strong> <span class="data-genre">${escapeHtml(record.genre)}</span></p>
                    <p><strong>Bureau:</strong> <span class="data-label">${escapeHtml(record.label)}</span></p>
                </div>
${!isPlaceholder(info) ? `                <details class="project-description">
                    <summary><span class="description-arrow" aria-hidden="true"></span><span>Beschrijving</span></summary>
                    <p>${formatInfo(info)}</p>
                </details>\n` : ''}
            </article>`;
    }).join('\n');

    return `
        <section id="project-index" class="project-index" aria-label="Project index">
            <h2 class="project-index-title">Project index</h2>
            <input type="text" id="searchInput" placeholder="Zoek projecten..." onkeyup="filterAlbums()" style="margin: 0 0 1rem;">
            <div id="collection-grid" aria-live="polite">
${projects}
            </div>
        </section>`.replace(/^\s+$/gm, '');
}

function generateCollectionPage({ dataFile = 'records.json', pageFile = 'collection.html', outputDir = 'projects' } = {}) {
    const records = JSON.parse(fs.readFileSync(path.join(rootDir, dataFile), 'utf8'));
    const pagePath = path.join(rootDir, pageFile);
    const page = fs.readFileSync(pagePath, 'utf8');
    const markerPattern = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`);

    if (!markerPattern.test(page)) {
        throw new Error(`Could not find collection markers in ${pageFile}`);
    }

    const generatedSection = `${startMarker}${projectIndexMarkup(records, { outputDir })}\n        ${endMarker}`
        .replace(/^\s+$/gm, '');
    fs.writeFileSync(pagePath, page.replace(markerPattern, generatedSection), 'utf8');
    console.log(`Generated collection index with ${records.length} projects in ${pagePath}`);
}

if (require.main === module) generateCollectionPage();

module.exports = { generateCollectionPage };
