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

function projectIndexMarkup(records) {
    const projects = records.map(record => {
        const info = normalizeText(record.info);
        const release = normalizeText(record.release);
        const pdf = normalizeText(record.pdf);
        const cover = imageSource(record.cover);
        const projectUrl = `projects/${record.id}/index.html`;
        const metadata = [
            ['Artist', record.artist],
            ['Year', record.year],
            ['Genre', record.genre],
            ['Label', record.label]
        ].map(([label, value]) => `<strong>${label}:</strong> ${escapeHtml(value)}`).join('<br>');

        return `            <article class="seo-project" id="seo-${escapeHtml(record.id)}">
                <a class="seo-project-link" href="${escapeHtml(encodeURI(projectUrl))}" aria-label="Open ${escapeHtml(record.title)}">
                    <img src="/${escapeHtml(encodeURI(cover))}" alt="${escapeHtml(record.title)}" loading="lazy">
                    <h3>${escapeHtml(record.title)}</h3>
                </a>
                <p class="seo-project-meta">${metadata}</p>
${!isPlaceholder(info) ? `                <p class="seo-project-info">${formatInfo(info)}</p>\n` : ''}${!isPlaceholder(release) ? `                <p class="seo-project-release"><a href="${escapeHtml(release)}" target="_blank" rel="noopener noreferrer">External reference</a></p>\n` : ''}${pdf ? `                <p class="seo-project-pdf"><a href="/${escapeHtml(encodeURI(pdf))}" target="_blank" rel="noopener noreferrer">Open PDF</a></p>\n` : ''}            </article>`;
    }).join('\n');

    return `
        <section id="project-index" class="project-index" aria-label="Project index">
            <h2 class="project-index-title">Project index</h2>
            <p class="project-index-lead">Crawlable overview of the archive. Each item links to the interactive project view below.</p>
${projects}
        </section>`.replace(/^\s+$/gm, '');
}

function generateCollectionPage({ dataFile = 'records.json', pageFile = 'collection.html' } = {}) {
    const records = JSON.parse(fs.readFileSync(path.join(rootDir, dataFile), 'utf8'));
    const pagePath = path.join(rootDir, pageFile);
    const page = fs.readFileSync(pagePath, 'utf8');
    const markerPattern = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`);

    if (!markerPattern.test(page)) {
        throw new Error(`Could not find collection markers in ${pageFile}`);
    }

    const generatedSection = `${startMarker}${projectIndexMarkup(records)}\n        ${endMarker}`
        .replace(/^\s+$/gm, '');
    fs.writeFileSync(pagePath, page.replace(markerPattern, generatedSection), 'utf8');
    console.log(`Generated collection index with ${records.length} projects in ${pagePath}`);
}

if (require.main === module) generateCollectionPage();

module.exports = { generateCollectionPage };
