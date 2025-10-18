let isMainModalOpen = false; // Track if the main modal is open
let currentHighResIndex = 0; // Track the current high-resolution image index
let highResImages = []; // Store the list of high-resolution images
let lastFocusedElement = null; // For returning focus after closing modal
let currentRecordId = null; // Track current open project id for deep linking
let generatedSlugCounts = {}; // For ensuring unique fallback slugs
let pendingHashUpdate = null; // Debounce frame id for hash updates
let pendingPdfRerender = null; // Debounce frame id for pdf re-render
// PDF rendering state (for high quality vector-based re-rendering on zoom)
const pdfState = {
    doc: null,
    page: null,
    url: null,
    baseFitScale: 1, // scale that fits page to container (defines 100%)
    isActive: false,
    canvas: null,
    rendering: false,
    pendingZoom: null,
    pinch: { active: false, startDist: 0, startZoom: 100, prevZoom: 100, contentX: 0, contentY: 0, containerX: 0, containerY: 0 },
    numPages: 0,
    currentPage: 1
};
let pendingTargetPdfPage = null; // if deep-link requests a certain page

// Fetch and display records
document.addEventListener("DOMContentLoaded", function() {
    const collectionGrid = document.getElementById('collection-grid');
    if (!collectionGrid) return; // Only run on collection page
    const statusEl = document.createElement('div');
    statusEl.id = 'collection-status';
    statusEl.setAttribute('role','status');
    statusEl.style.margin = '1rem 0';
    statusEl.textContent = 'Laden...';
    collectionGrid.parentNode.insertBefore(statusEl, collectionGrid);

    const dataUrl = window.COLLECTION_JSON || 'records.json';
    fetch(dataUrl)
        .then(response => {
            if(!response.ok) throw new Error('Netwerkfout');
            return response.json();
        })
        .then(data => {
            if (!Array.isArray(data) || data.length === 0) {
                statusEl.textContent = 'Geen projecten gevonden.';
                return;
            }
            statusEl.textContent = '';
            data.forEach(record => {
                const recordDiv = document.createElement('div');
                recordDiv.className = 'record';
                recordDiv.tabIndex = 0;
                recordDiv.setAttribute('role','button');
                recordDiv.setAttribute('aria-label', `Project: ${record.title}. Klik voor details.`);
                recordDiv.addEventListener('click', () => openModal(recordDiv));
                recordDiv.addEventListener('keypress', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(recordDiv);} });
                // Ensure we have an id / slug for deep linking
                let recId = record.id || generateSlug(record.title || 'project');
                recordDiv.setAttribute('data-id', recId);
                recordDiv.setAttribute('data-title', record.title);
                recordDiv.setAttribute('data-artist', record.artist);
                recordDiv.setAttribute('data-year', record.year);
                recordDiv.setAttribute('data-genre', record.genre);
                recordDiv.setAttribute('data-label', record.label);
                recordDiv.setAttribute('data-thumbnails', JSON.stringify(record.thumbnails));
                recordDiv.setAttribute('data-highres', JSON.stringify(record.highres));
                recordDiv.setAttribute('data-info', record.info);
                recordDiv.setAttribute('data-release', record.release);

                const safeTitle = record.title.replace(/&/g, '&amp;');
                recordDiv.innerHTML = `
                    <img src="${record.cover}" alt="${safeTitle}" class="album-cover" loading="lazy">
                    <div class="info">
                        <h3 class="data-title">${safeTitle}</h3>
                        <p><strong>Artist:</strong> <span class="data-artist">${record.artist.replace(/&/g, '&<br>')}</span></p>
                        <p><strong>Year:</strong> <span class="data-year">${record.year}</span></p>
                        <p><strong>Genre:</strong> <span class="data-genre">${record.genre}</span></p>
                        <p><strong>Record Label:</strong> <span class="data-label">${record.label}</span></p>
                        <p><strong>Release:</strong> <span class="data-release">Klik voor details</span></p>
                    </div>`;
                collectionGrid.appendChild(recordDiv);
            });
            // After building grid, process deep link (hash) if any
            processDeepLink();
            window.addEventListener('hashchange', handleHashChange);
        })
        .catch(error => {
            console.error('Error fetching records:', error);
            statusEl.textContent = 'Kon projecten niet laden.';
        });
});

// Open modal function for album details
function openModal(record) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
    isMainModalOpen = true; // Set the flag to true
    lastFocusedElement = document.activeElement;
    currentRecordId = record.getAttribute('data-id') || null;
    if (currentRecordId) {
        const raw = decodeURIComponent(location.hash.replace('#',''));
        const { pid } = parseHash(raw);
        const desiredHash = '#'+encodeURIComponent(currentRecordId);
        if (pid !== currentRecordId) {
            history.replaceState(null,'',desiredHash);
        }
    }

    // Get the data for the selected album
    const title = record.getAttribute('data-title');
    const artist = record.getAttribute('data-artist');
    const year = record.getAttribute('data-year');
    const genre = record.getAttribute('data-genre');
    const label = record.getAttribute('data-label');
    const thumbnails = JSON.parse(record.getAttribute('data-thumbnails'));
    highResImages = JSON.parse(record.getAttribute('data-highres')); // Store the high-res images
    const info = record.getAttribute('data-info');
    const release = record.getAttribute('data-release'); // Get the release URL

    // Clear previous
    modalBody.innerHTML = '';

    // Build header (focus target)
    const heading = document.createElement('h2');
    heading.textContent = title;
    heading.tabIndex = -1; // allow programmatic focus
    modalBody.appendChild(heading);

    // Thumbnails container
    const thumbWrapper = document.createElement('div');
    thumbWrapper.className = 'thumbnails';
    thumbnails.forEach((thumbnail, index) => {
        if (thumbnail.endsWith('.pdf')) {
            const btn = document.createElement('button');
            btn.className = 'pdf-thumbnail';
            btn.setAttribute('aria-label', `Open PDF ${index + 1}`);
            btn.addEventListener('click', () => openHighResImage(index));
            const span = document.createElement('span');
            span.style.display = 'block';
            span.style.fontSize = '12px';
            span.textContent = 'PDF';
            btn.appendChild(span);
            thumbWrapper.appendChild(btn);
        } else {
            const img = document.createElement('img');
            img.src = thumbnail;
            img.alt = `${title} miniatuur ${index + 1}`;
            img.className = 'thumbnail';
            img.loading = 'lazy';
            img.addEventListener('click', () => openHighResImage(index));
            thumbWrapper.appendChild(img);
        }
    });
    modalBody.appendChild(thumbWrapper);

    // Details heading
    const detailsHeading = document.createElement('h3');
    detailsHeading.textContent = 'Details';
    modalBody.appendChild(detailsHeading);

    // Share link button (project level)
    if (currentRecordId) {
        const shareWrap = document.createElement('div');
        shareWrap.style.display = 'flex';
        shareWrap.style.gap = '0.5rem';
        shareWrap.style.margin = '0.25rem 0 0.75rem';
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'share-project-link icon-copy-btn';
    copyBtn.setAttribute('aria-label','Kopieer projectlink');
    copyBtn.innerHTML = getCopyIconSVG();
    copyBtn.addEventListener('click', ()=> copyProjectLink(false, copyBtn));
        shareWrap.appendChild(copyBtn);
        modalBody.appendChild(shareWrap);
    }

    // Info paragraph (with markdown -> sanitized HTML) if not placeholder
    const isPlaceholder = !info || /^(\.|\.\.|\.\.\.|\s*)$/.test(info.trim());
    let infoId = null;
    if (!isPlaceholder) {
        infoId = 'project-info-' + Math.random().toString(36).slice(2, 9);
        const infoPara = document.createElement('p');
        infoPara.className = 'modal-content-p';
        infoPara.id = infoId;
        const strongLabel = document.createElement('strong');
        strongLabel.textContent = 'Project info: ';
        infoPara.appendChild(strongLabel);
        const spanWrapper = document.createElement('span');
        spanWrapper.innerHTML = renderInfoMarkdown(info); // sanitized inline HTML
        infoPara.appendChild(spanWrapper);
        modalBody.appendChild(infoPara);
    }

    // External link
    if (release && release !== '.' && release !== '..' && release !== '#') {
        const linkPara = document.createElement('p');
        linkPara.className = 'modal-content-p';
        const strong = document.createElement('strong');
        strong.textContent = 'Externe info: ';
        linkPara.appendChild(strong);
        const a = document.createElement('a');
        a.href = release;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = 'Link';
        linkPara.appendChild(a);
        modalBody.appendChild(linkPara);
    }

    // aria-describedby for modal content (if info present)
    if (infoId) {
        modalBody.setAttribute('aria-describedby', infoId);
    } else {
        modalBody.removeAttribute('aria-describedby');
    }

    // Focus the heading for accessibility
    setTimeout(() => heading.focus(), 0);
}

// Helper function to create a properly sized image that fits the screen
function createScreenFittedImage(imageSrc) {
    return new Promise((resolve) => {
        const img = document.createElement('img');
        img.src = imageSrc;
        img.alt = "High Resolution Image";
        
        img.onload = function() {
            const highResImage = document.getElementById('highResImage');
            const container = highResImage;
            
            // Get available container dimensions
            const containerRect = container.getBoundingClientRect();
            const availableWidth = containerRect.width;
            const availableHeight = containerRect.height;
            
            // Get image natural dimensions
            const imageWidth = img.naturalWidth;
            const imageHeight = img.naturalHeight;
            
            // Calculate scale to fit within available space while maintaining aspect ratio
            const scaleX = availableWidth / imageWidth;
            const scaleY = availableHeight / imageHeight;
            const scale = Math.min(scaleX, scaleY);
            
            // Calculate the fitted dimensions
            const fittedWidth = imageWidth * scale;
            const fittedHeight = imageHeight * scale;
            
            if (isMobileDevice()) {
                // Mobile/tablet: Use full available dimensions with native zoom capabilities
                img.style.cssText = `
                    width: 100%;
                    height: 100%;
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                    object-position: center;
                    display: block;
                    margin: 0;
                    touch-action: manipulation;
                    user-select: none;
                `;
            } else {
                // Desktop: Use fitted dimensions with custom zoom controls
                // Enable touch gestures for hybrid devices (touch laptops)
                const touchAction = hasTouchCapability() ? 'touch-action: manipulation;' : '';
                img.style.cssText = `
                    width: ${fittedWidth}px;
                    height: ${fittedHeight}px;
                    object-fit: contain;
                    object-position: center;
                    display: block;
                    transition: transform 0.3s ease;
                    cursor: grab;
                    margin: auto;
                    ${touchAction}
                `;
            }
            
            resolve(img);
        };
        
        img.onerror = function() {
            // Fallback if image fails to load
            img.style.cssText = `
                max-width: 100%;
                max-height: 100%;
                width: auto;
                height: auto;
                object-fit: contain;
                display: block;
                margin: auto;
            `;
            resolve(img);
        };
    });
}

// Open high-resolution image modal
function openHighResImage(index) {
    currentHighResIndex = index; // Set the current high-res image index
    const highResModal = document.getElementById('highResModal');
    const highResImage = document.getElementById('highResImage');
    highResModal.style.display = 'block';
    // ARIA semantics for accessibility
    highResModal.setAttribute('role','dialog');
    highResModal.setAttribute('aria-modal','true');
    highResModal.setAttribute('aria-label','High resolution viewer');
    document.body.classList.add('modal-open');
    
    // Reset zoom when opening new image
    if (!isMobileDevice()) {
        resetZoom();
    } else {
        // On mobile, ensure initial zoom is baseline fit (100%) prior to any restore
        currentZoom = 100;
    }
    // Reset image pinch state
    imagePinch.active = false;
    // Reset PDF state
    resetPdfState();
    
    if (highResImages[currentHighResIndex].endsWith('.pdf')) {
        renderPDF(highResImages[currentHighResIndex], highResImage);
        // After initial render, restore per-item zoom if any
        setTimeout(restoreZoomForCurrentItemIfAny, 0);
    } else {
        // Clear container first
        highResImage.innerHTML = '';
        
        // Create and add screen-fitted image
        createScreenFittedImage(highResImages[currentHighResIndex]).then(img => {
            highResImage.appendChild(img);
            // Center vertically at baseline
            const container = document.getElementById('highResImage');
            if (container) container.classList.add('center-fit');
            restoreZoomForCurrentItemIfAny();
        });
        // On mobile, image pinch zoom is supported via global handlers
    }
    // Update hash with image index (#id:index)
    if (currentRecordId) {
        const combined = '#'+encodeURIComponent(currentRecordId)+':'+currentHighResIndex;
        if (location.hash !== combined) scheduleHashUpdate(combined);
    }
    ensureHighResShareButton();
    ensurePdfControls();
    preloadAdjacentHighRes();
}

// Ensure PDF page controls exist in the modal
function ensurePdfControls() {
    const modal = document.getElementById('highResModal');
    if (!modal) return;
    let ctrls = modal.querySelector('.pdf-controls');
    if (!ctrls) {
        ctrls = document.createElement('div');
        ctrls.className = 'pdf-controls';
        ctrls.innerHTML = `
            <button type="button" class="pdf-prev" aria-label="Vorige pagina">◀</button>
            <span class="pdf-page-indicator" aria-live="polite">Pagina 1/1</span>
            <button type="button" class="pdf-next" aria-label="Volgende pagina">▶</button>
            <label class="pdf-jump-label">Ga naar: <input type="number" min="1" class="pdf-jump" aria-label="Ga naar pagina"></label>
        `;
        modal.appendChild(ctrls);
        const prevBtn = ctrls.querySelector('.pdf-prev');
        const nextBtn = ctrls.querySelector('.pdf-next');
        const jumpInput = ctrls.querySelector('.pdf-jump');
        prevBtn.addEventListener('click', () => changePdfPage(-1));
        nextBtn.addEventListener('click', () => changePdfPage(1));
        jumpInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyPdfJump(jumpInput.value); });
        jumpInput.addEventListener('blur', () => applyPdfJump(jumpInput.value));
    }
    updatePdfControlsUI();
}

function updatePdfControlsUI() {
    const modal = document.getElementById('highResModal');
    const ctrls = modal ? modal.querySelector('.pdf-controls') : null;
    if (!ctrls) return;
    const indicator = ctrls.querySelector('.pdf-page-indicator');
    const jumpInput = ctrls.querySelector('.pdf-jump');
    const prevBtn = ctrls.querySelector('.pdf-prev');
    const nextBtn = ctrls.querySelector('.pdf-next');
    const n = pdfState.numPages || 1;
    const p = pdfState.currentPage || 1;
    if (!pdfState.isActive || n <= 1) {
        ctrls.style.display = 'none';
    } else {
        ctrls.style.display = '';
        indicator.textContent = `Pagina ${p}/${n}`;
        jumpInput.value = String(p);
        prevBtn.disabled = (p <= 1);
        nextBtn.disabled = (p >= n);
    }
}

function changePdfPage(delta) {
    if (!pdfState.isActive) return;
    const target = Math.min(Math.max(1, (pdfState.currentPage || 1) + delta), pdfState.numPages || 1);
    if (target === pdfState.currentPage) return;
    const container = document.getElementById('highResImage');
    loadPdfPage(target, container, false);
}

function applyPdfJump(val) {
    if (!pdfState.isActive) return;
    const n = pdfState.numPages || 1;
    const v = Math.min(Math.max(1, parseInt(val, 10) || 1), n);
    const container = document.getElementById('highResImage');
    loadPdfPage(v, container, false);
}

// Render PDF using pdf.js with responsive sizing
function renderPDF(url, container) {
    container.innerHTML = ''; // Clear previous content
    resetPdfState();
    pdfState.url = url;
    // Create a canvas element
    const canvas = document.createElement('canvas');
    pdfState.canvas = canvas;
    container.appendChild(canvas);
    const context = canvas.getContext('2d');
    // Default to centered when baseline fit (100%)
    const cont = document.getElementById('highResImage');
    if (cont) cont.classList.add('center-fit');

    pdfjsLib.getDocument(url).promise.then(pdf => {
        pdfState.doc = pdf;
        pdfState.numPages = pdf.numPages || 1;
        pdfState.currentPage = Math.min(Math.max(1, pendingTargetPdfPage || 1), pdfState.numPages);
        pendingTargetPdfPage = null;
        pdfState.isActive = true;
        return loadPdfPage(pdfState.currentPage, container, true);
    }).catch(err => {
        console.error('Error loading PDF:', err);
        container.innerHTML = '<p style="color: white; text-align: center;">Error loading PDF</p>';
        resetPdfState();
    });
}

// Load a specific PDF page (and render it at the current zoom). When initial is true, compute baseFitScale.
function loadPdfPage(pageNumber, container, initial=false) {
    if (!pdfState.doc) return Promise.resolve();
    pageNumber = Math.min(Math.max(1, pageNumber), pdfState.numPages || 1);
    return pdfState.doc.getPage(pageNumber).then(page => {
        pdfState.page = page;
        pdfState.currentPage = pageNumber;
        if (initial) {
            const containerRect = container.getBoundingClientRect();
            const initialViewport = page.getViewport({ scale: 1 });
            const scaleX = containerRect.width / initialViewport.width;
            const scaleY = containerRect.height / initialViewport.height;
            pdfState.baseFitScale = Math.min(scaleX, scaleY);
        } else {
            // Recompute base fit per page (pages may have different sizes)
            const containerRect = container.getBoundingClientRect();
            const initialViewport = page.getViewport({ scale: 1 });
            const scaleX = containerRect.width / initialViewport.width;
            const scaleY = containerRect.height / initialViewport.height;
            pdfState.baseFitScale = Math.min(scaleX, scaleY);
        }
        renderPdfAtCurrentZoom();
        if (isMobileDevice()) attachPdfPinchHandlers();
        ensurePdfControls();
        ensurePdfThumbnails();
        updateHashForCurrentAsset();
    });
}

function renderPdfAtCurrentZoom() {
    if (!pdfState.isActive || !pdfState.page || !pdfState.canvas) return;
    if (pdfState.rendering) { // throttle: queue latest zoom
        pdfState.pendingZoom = currentZoom;
        return;
    }
    pdfState.rendering = true;
    const desiredScale = pdfState.baseFitScale * (currentZoom / 100);
    const viewport = pdfState.page.getViewport({ scale: desiredScale });
    const canvas = pdfState.canvas;
    const ctx = canvas.getContext('2d');
    // Support high DPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = viewport.width * dpr;
    canvas.height = viewport.height * dpr;
    canvas.style.width = viewport.width + 'px';
    canvas.style.height = viewport.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Style
    const touchAction = hasTouchCapability() ? 'touch-action: manipulation;' : '';
    canvas.style.cursor = 'grab';
    canvas.style.display = 'block';
    canvas.style.transition = 'none';
    // Toggle center-fit at baseline zoom
    const container = document.getElementById('highResImage');
    if (container) {
        if (Math.round(currentZoom) === 100) container.classList.add('center-fit'); else container.classList.remove('center-fit');
    }
    // Do not force 100% width/auto height on mobile; the CSS size must reflect the zoomed viewport
    const renderTask = pdfState.page.render({ canvasContext: ctx, viewport });
    renderTask.promise.then(() => {
        pdfState.rendering = false;
        // Adjust scroll to keep pinch center stable
        try {
            const container = document.getElementById('highResImage');
            const canvasEl = pdfState.canvas;
            const p = pdfState.pinch;
            if (container && canvasEl && p && (p.containerX || p.containerY)) {
                const scaleRatio = currentZoom / (p.prevZoom || currentZoom);
                const newContentX = p.contentX * scaleRatio;
                const newContentY = p.contentY * scaleRatio;
                const canvasLeft = canvasEl.offsetLeft;
                const canvasTop = canvasEl.offsetTop;
                container.scrollLeft = Math.max(0, Math.round(canvasLeft + newContentX - p.containerX));
                container.scrollTop  = Math.max(0, Math.round(canvasTop  + newContentY - p.containerY));
            }
        } catch(_) {}
        if (pdfState.pendingZoom && pdfState.pendingZoom !== currentZoom) {
            pdfState.pendingZoom = null;
            renderPdfAtCurrentZoom();
        }
        updatePdfControlsUI();
    }).catch(e => { pdfState.rendering = false; console.error('PDF render error', e); });
}

function resetPdfState() {
    pdfState.doc = null;
    pdfState.page = null;
    pdfState.url = null;
    pdfState.baseFitScale = 1;
    pdfState.isActive = false;
    pdfState.canvas = null;
    pdfState.rendering = false;
    pdfState.pendingZoom = null;
    pdfState.pinch.active = false;
    pdfState.numPages = 0;
    pdfState.currentPage = 1;
}

// Mobile pinch zoom support for PDFs (re-renders at new scale)
function attachPdfPinchHandlers() {
    const container = document.getElementById('highResImage');
    if (!container) return;
    container.addEventListener('touchstart', onPdfTouchStart, { passive: false });
    container.addEventListener('touchmove', onPdfTouchMove, { passive: false });
    container.addEventListener('touchend', onPdfTouchEnd);
}

// Optional nicety: PDF page thumbnails for quick navigation
function ensurePdfThumbnails() {
    const modal = document.getElementById('highResModal');
    if (!modal || !pdfState.doc || !pdfState.isActive) return;
    let strip = modal.querySelector('.pdf-thumbs');
    // If only a single page, remove strip if present and bail
    if ((pdfState.numPages || 1) <= 1) {
        if (strip) strip.remove();
        return;
    }
    if (!strip) {
        strip = document.createElement('div');
        strip.className = 'pdf-thumbs';
        strip.setAttribute('aria-label','Miniaturen van pagina\'s');
        strip.setAttribute('role','list');
        modal.appendChild(strip);
    }
    // Build lazily if empty or page count changed
    if (strip.childElementCount !== (pdfState.numPages || 1)) {
        strip.innerHTML = '';
        const n = pdfState.numPages || 1;
        for (let i=1; i<=n; i++) {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'pdf-thumb';
            item.setAttribute('role','listitem');
            item.setAttribute('aria-label', 'Ga naar pagina ' + i);
            const canvas = document.createElement('canvas');
            canvas.width = 80; canvas.height = 110; // placeholder size; updated after render
            item.appendChild(canvas);
            item.addEventListener('click', ()=>{
                const container = document.getElementById('highResImage');
                loadPdfPage(i, container, false);
            });
            strip.appendChild(item);
            // Lazy render thumbnails
            pdfState.doc.getPage(i).then(page => {
                const v = page.getViewport({ scale: 0.2 });
                const dpr = window.devicePixelRatio || 1;
                canvas.width = v.width * dpr;
                canvas.height = v.height * dpr;
                canvas.style.width = Math.round(v.width) + 'px';
                canvas.style.height = Math.round(v.height) + 'px';
                const ctx = canvas.getContext('2d');
                ctx.setTransform(dpr,0,0,dpr,0,0);
                page.render({ canvasContext: ctx, viewport: v });
            });
        }
    }
    // Highlight current page
    Array.from(strip.children).forEach((btn, idx) => {
        if ((idx+1) === pdfState.currentPage) btn.classList.add('active'); else btn.classList.remove('active');
    });
}
function onPdfTouchStart(e) {
    if (!pdfState.isActive) return;
    if (e.touches.length === 2) {
        // Prevent browser default pinch-zoom to keep interaction within the canvas
        e.preventDefault();
        pdfState.pinch.active = true;
        pdfState.pinch.startDist = getTouchDistance(e.touches[0], e.touches[1]);
        pdfState.pinch.startZoom = currentZoom;
        // Add a temporary class to disable UA pinch-zoom while our gesture is active
        const container = document.getElementById('highResImage');
        if (container) container.classList.add('pinching');
    }
}
function onPdfTouchMove(e) {
    if (!pdfState.isActive || !pdfState.pinch.active || e.touches.length !== 2) return;
    e.preventDefault();
    // Record the focal point within the content before applying zoom
    const container = document.getElementById('highResImage');
    const canvas = container ? container.querySelector('canvas') : null;
    if (container && canvas) {
        const rect = container.getBoundingClientRect();
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const containerX = cx - rect.left;
        const containerY = cy - rect.top;
        pdfState.pinch.containerX = containerX;
        pdfState.pinch.containerY = containerY;
        const contentLeft = canvas.offsetLeft;
        const contentTop = canvas.offsetTop;
        pdfState.pinch.contentX = (container.scrollLeft + containerX) - contentLeft;
        pdfState.pinch.contentY = (container.scrollTop + containerY) - contentTop;
        pdfState.pinch.prevZoom = currentZoom;
    }
    const newDist = getTouchDistance(e.touches[0], e.touches[1]);
    const ratio = newDist / pdfState.pinch.startDist;
    const minZoom = isMobileDevice() ? 100 : 10;
    const target = Math.min(1000, Math.max(minZoom, Math.round(pdfState.pinch.startZoom * ratio)));
    if (Math.abs(target - currentZoom) >= 5) { // update when change significant
        currentZoom = target;
        schedulePdfRerender();
        showZoomIndicator();
    }
}
function onPdfTouchEnd(e) {
    if (e.touches.length < 2) {
        pdfState.pinch.active = false;
        // Re-enable UA gestures after pinch ends
        const container = document.getElementById('highResImage');
        if (container) container.classList.remove('pinching');
    }
}
function getTouchDistance(t1, t2) { const dx = t2.clientX - t1.clientX; const dy = t2.clientY - t1.clientY; return Math.hypot(dx, dy); }

// Navigate through high-resolution images
function navigateHighResImage(direction) {
    currentHighResIndex += direction;
    if (currentHighResIndex < 0) {
        currentHighResIndex = highResImages.length - 1;
    } else if (currentHighResIndex >= highResImages.length) {
        currentHighResIndex = 0;
    }
    const highResImage = document.getElementById('highResImage');
    
    // Reset zoom when navigating to new image
    if (!isMobileDevice()) {
        resetZoom();
    } else {
        // On mobile, ensure initial zoom is baseline fit (100%) prior to any restore
        currentZoom = 100;
    }
    resetPdfState();
    
    if (highResImages[currentHighResIndex].endsWith('.pdf')) {
        renderPDF(highResImages[currentHighResIndex], highResImage);
        // After PDF render kicks off, attempt to restore zoom shortly after
        setTimeout(restoreZoomForCurrentItemIfAny, 0);
    } else {
        // Clear container first
        highResImage.innerHTML = '';
        
        // Create and add screen-fitted image
        createScreenFittedImage(highResImages[currentHighResIndex]).then(img => {
            highResImage.appendChild(img);
            // Center vertically at baseline
            const container = document.getElementById('highResImage');
            if (container) container.classList.add('center-fit');
            restoreZoomForCurrentItemIfAny();
        });
    }
    if (currentRecordId) {
        const combined = '#'+encodeURIComponent(currentRecordId)+':'+currentHighResIndex;
        if (location.hash !== combined) scheduleHashUpdate(combined);
    }
    preloadAdjacentHighRes();
}

// Close modal function
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'none';

    // If closing the high-resolution modal, keep the main modal open if it was open before
    if (modalId === 'highResModal' && isMainModalOpen) {
        document.getElementById('modal').style.display = 'block';
    } else if (modalId === 'modal') {
        isMainModalOpen = false; // Reset the flag when closing the main modal
        document.body.classList.remove('modal-open');
        // Restore focus to previously focused element if still in DOM
        if (lastFocusedElement && document.contains(lastFocusedElement)) {
            lastFocusedElement.focus();
        }
        // Clear hash if it references this project
        const raw = decodeURIComponent(location.hash.replace('#',''));
        const { pid } = parseHash(raw);
        if (currentRecordId && pid === currentRecordId) {
            scheduleHashUpdate(window.location.pathname + window.location.search, true, true);
        }
        currentRecordId = null;
    } else if (modalId === 'highResModal' && !isMainModalOpen) {
        document.body.classList.remove('modal-open');
        if (lastFocusedElement && document.contains(lastFocusedElement)) {
            lastFocusedElement.focus();
        }
    }
}

// Close modals when tapping/clicking the backdrop, without click-through to underlying grid
function handleBackdropInteraction(e) {
    // Only act if the backdrop itself was the event target (not clicks inside modal content)
    if (e.target !== this) return;
    // Prevent the synthesized click from reaching underlying elements
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    const id = this.id === 'highResModal' ? 'highResModal' : 'modal';
    closeModal(id);
}

// Legacy window.onclick backdrop closer removed; relying on targeted handlers added to each modal.

// Close modal when pressing the Escape key
document.addEventListener('keydown', function(event) {
    const modal = document.getElementById('modal');
    const highResModal = document.getElementById('highResModal');
    if (event.key === 'Escape') {
        if (highResModal.style.display === 'block') {
            highResModal.style.display = 'none';
            if (isMainModalOpen) {
                modal.style.display = 'block';
            } else {
                document.body.classList.remove('modal-open');
                if (lastFocusedElement && document.contains(lastFocusedElement)) lastFocusedElement.focus();
            }
        } else {
            modal.style.display = 'none';
            isMainModalOpen = false;
            document.body.classList.remove('modal-open');
            if (lastFocusedElement && document.contains(lastFocusedElement)) lastFocusedElement.focus();
            const raw = decodeURIComponent(location.hash.replace('#',''));
            const { pid } = parseHash(raw);
            if (currentRecordId && pid === currentRecordId) {
                scheduleHashUpdate(window.location.pathname + window.location.search, true, true);
            }
            currentRecordId = null;
        }
    }
    // Arrow key navigation for high-res viewer
    if (highResModal && highResModal.style.display === 'block') {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            if (pdfState.isActive) changePdfPage(-1); else navigateHighResImage(-1);
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            if (pdfState.isActive) changePdfPage(1); else navigateHighResImage(1);
        }
    }
    // Basic focus trap when main modal is open and highRes not covering it
    if (isMainModalOpen && modal.style.display === 'block' && event.key === 'Tab') {
        const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable.length) {
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    }
});

// Filter albums based on search input
function filterAlbums() {
    const input = document.getElementById('searchInput');
    const filter = input.value.toLowerCase();
    const records = document.getElementsByClassName('record');

    Array.from(records).forEach(record => {
        const title = record.getAttribute('data-title').toLowerCase();
        const artist = record.getAttribute('data-artist').toLowerCase();
        const year = record.getAttribute('data-year').toLowerCase();
        const genre = record.getAttribute('data-genre').toLowerCase();
    const label = record.getAttribute('data-label').toLowerCase();
    const info = record.getAttribute('data-info')?.toLowerCase() || '';
    if (title.includes(filter) || artist.includes(filter) || year.includes(filter) || genre.includes(filter) || label.includes(filter) || info.includes(filter)) {
            record.style.display = '';
        } else {
            record.style.display = 'none';
        }
    });
}

// Ensure caption width matches corresponding image width (especially on mobile where container is wider)
function setCaptionWidths() {
    const imageBoxes = document.querySelectorAll('.image-box');
    imageBoxes.forEach(box => {
        const image = box.querySelector('.image');
        const caption = box.querySelector('.caption');
        if (!image || !caption) return;
        // Use clientWidth (after layout). Guard against 0 (not yet rendered) by retrying on next frame
        const w = image.clientWidth;
        if (w === 0) {
            requestAnimationFrame(() => setCaptionWidths());
            return;
        }
        caption.style.width = w + 'px';
    });
}

// Initial set after full load (all images, including lazy if already in viewport)
window.addEventListener('load', setCaptionWidths);

// Recalculate when any tracked image finishes loading (covers late lazy loads)
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.image-box .image').forEach(img => {
        img.addEventListener('load', setCaptionWidths, { once: true });
    });
});

// Debounced resize/orientation handling
let captionResizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(captionResizeTimeout);
    captionResizeTimeout = setTimeout(setCaptionWidths, 120);
});

// Zoom functionality variables
let currentZoom = 100;
let isDragging = false;
let startX, startY, scrollLeft, scrollTop;
// Image pinch state for mobile
const imagePinch = { active: false, startDist: 0, startZoom: 100 };
// Per-item zoom memory (session only)
const zoomMemory = {};
// Double-tap detection
let lastTapTime = 0, lastTapX = 0, lastTapY = 0;
// Zoom indicator timer
let zoomIndicatorTimeout = null;
let zoomIndicatorDismissed = false;

// Device detection - distinguishes between mobile/tablet and desktop with optional touch
function isMobileDevice() {
    // Prefer input modality and UA over viewport width
    const coarse = window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    const isMobileUserAgent = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(navigator.userAgent);
    if (coarse || isMobileUserAgent) return true;
    // fallback: extremely small screens
    return window.innerWidth <= 600;
}

// Check if device has touch capability (for hybrid desktop/laptop devices)
function hasTouchCapability() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
}

// Zoom in/out function
function zoomImage(direction) {
    // Skip zoom functionality on mobile devices
    if (isMobileDevice()) return;
    
    const zoomStep = 25;
    
    if (direction === '+') {
        currentZoom = Math.min(currentZoom + zoomStep, 1000);
    } else if (direction === '-') {
        currentZoom = Math.max(currentZoom - zoomStep, 10);
    }
    
    applyZoom();
    showZoomIndicator();
    updateZoomSelect();
}

// Set zoom level from dropdown
function setZoomLevel(level) {
    // Skip zoom functionality on mobile devices
    if (isMobileDevice()) return;
    
    const customInput = document.getElementById('customZoom');
    
    if (level === 'custom') {
        customInput.style.display = 'inline-block';
        customInput.focus();
    } else {
        customInput.style.display = 'none';
        currentZoom = parseInt(level);
        applyZoom();
        showZoomIndicator();
    }
}

// Set custom zoom level
function setCustomZoom(level) {
    // Skip zoom functionality on mobile devices
    if (isMobileDevice()) return;
    
    const zoom = parseInt(level);
    if (zoom >= 10 && zoom <= 1000) {
        currentZoom = zoom;
        applyZoom();
        showZoomIndicator();
        updateZoomSelect();
    }
}

// Apply zoom transformation
function applyZoom() {
    // On mobile, allow zoom for PDFs and for images when an image pinch gesture is active
    if (isMobileDevice() && !pdfState.isActive && !imagePinch.active) return;
    
    const highResImage = document.getElementById('highResImage');
    const img = highResImage.querySelector('img');
    const canvas = highResImage.querySelector('canvas');
    
    const scale = currentZoom / 100;
    
    if (img && !pdfState.isActive) {
        // Calculate screen-fitted dimensions (100% zoom baseline)
        const containerRect = highResImage.getBoundingClientRect();
        const availableWidth = containerRect.width;
        const availableHeight = containerRect.height;
        
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        
        // Calculate scale to fit within available space (this is our 100% baseline)
        const baseScaleX = availableWidth / naturalWidth;
        const baseScaleY = availableHeight / naturalHeight;
        const baseScale = Math.min(baseScaleX, baseScaleY);
        
        // Calculate the baseline fitted dimensions (100% zoom)
        const baseFittedWidth = naturalWidth * baseScale;
        const baseFittedHeight = naturalHeight * baseScale;
        
        // Apply the zoom scale to the baseline fitted dimensions
        const finalWidth = baseFittedWidth * scale;
        const finalHeight = baseFittedHeight * scale;
        
        img.style.width = finalWidth + 'px';
        img.style.height = finalHeight + 'px';
        img.style.maxWidth = 'none';
        img.style.maxHeight = 'none';
        img.style.transform = 'none';
        // Toggle center-fit class based on zoom level
        if (Math.round(currentZoom) === 100) {
            highResImage.classList.add('center-fit');
        } else {
            highResImage.classList.remove('center-fit');
        }
    }
    
    if (canvas && pdfState.isActive) {
        // Debounced re-render for performance
        schedulePdfRerender();
    } else if (canvas) {
        // Non-PDF (should not happen) fallback scaling
        const containerRect = highResImage.getBoundingClientRect();
        const availableWidth = containerRect.width;
        const availableHeight = containerRect.height;
        const baseScaleX = availableWidth / canvas.width;
        const baseScaleY = availableHeight / canvas.height;
        const baseScale = Math.min(baseScaleX, baseScaleY);
        const finalWidth = canvas.width * baseScale * scale;
        const finalHeight = canvas.height * baseScale * scale;
        canvas.style.width = finalWidth + 'px';
        canvas.style.height = finalHeight + 'px';
    }
    // Persist zoom per item on mobile
    if (isMobileDevice()) persistZoomForCurrentItem();
}

// Update zoom select dropdown
function updateZoomSelect() {
    const zoomSelect = document.getElementById('zoomSelect');
    const customInput = document.getElementById('customZoom');
    
    // Check if current zoom matches any preset value
    const presetValues = ['25', '50', '75', '100', '125', '150', '200', '300', '400'];
    const matchingPreset = presetValues.find(val => parseInt(val) === currentZoom);
    
    if (matchingPreset) {
        zoomSelect.value = matchingPreset;
        customInput.style.display = 'none';
    } else {
        zoomSelect.value = 'custom';
        customInput.style.display = 'inline-block';
        customInput.value = currentZoom;
    }
}

// Reset zoom when opening new image
function resetZoom() {
    currentZoom = 100;
    updateZoomSelect();
}

// --- Info markdown rendering & sanitization ---
function renderInfoMarkdown(raw) {
    if (!raw) return '';
    // Escape HTML special chars first
    let text = raw.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;');
    // Convert line breaks (double newline to paragraph separation handled later)
    text = text.replace(/\r\n?/g, '\n');
    // Basic link syntax [text](http(s)://...)
    text = text.replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // Bold **text**
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    // Split paragraphs on blank lines
    const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    if (paragraphs.length === 0) return '';
    return paragraphs.map(p => `<span>${p.replace(/\n/g, '<br>')}</span>`).join('<br>');
}

// Add drag functionality for zoomed images (desktop only)
function initializeDragging() {
    // Skip dragging functionality on mobile devices
    if (isMobileDevice()) return;
    const highResImage = document.getElementById('highResImage');
    if (!highResImage) return; // Not present on pages without the high-res modal structure
    highResImage.addEventListener('mousedown', startDragging);
    highResImage.addEventListener('mouseleave', stopDragging);
    highResImage.addEventListener('mouseup', stopDragging);
    highResImage.addEventListener('mousemove', drag);
}

function startDragging(e) {
    // Enable dragging for all zoom levels on desktop, not just when zoomed in
    if (!isMobileDevice()) {
        isDragging = true;
        const highResImage = document.getElementById('highResImage');
        
        // Use clientX/clientY for more accurate positioning
        startX = e.clientX;
        startY = e.clientY;
        scrollLeft = highResImage.scrollLeft;
        scrollTop = highResImage.scrollTop;
        
        // Prevent default behavior to avoid text selection
        e.preventDefault();
        
        // Change cursor to grabbing
        const img = highResImage.querySelector('img');
        const canvas = highResImage.querySelector('canvas');
        if (img) img.style.cursor = 'grabbing';
        if (canvas) canvas.style.cursor = 'grabbing';
    }
}

function stopDragging() {
    isDragging = false;
    
    // Reset cursor back to grab
    if (!isMobileDevice()) {
        const highResImage = document.getElementById('highResImage');
        const img = highResImage.querySelector('img');
        const canvas = highResImage.querySelector('canvas');
        if (img) img.style.cursor = 'grab';
        if (canvas) canvas.style.cursor = 'grab';
    }
}

function drag(e) {
    if (!isDragging || isMobileDevice()) return;
    e.preventDefault();
    
    const highResImage = document.getElementById('highResImage');
    
    // Calculate the distance moved using clientX/clientY
    const x = e.clientX;
    const y = e.clientY;
    
    // Calculate movement delta (how much the mouse moved)
    const deltaX = x - startX;
    const deltaY = y - startY;
    
    // Apply the movement to scroll position (opposite direction for natural dragging)
    highResImage.scrollLeft = scrollLeft - deltaX;
    highResImage.scrollTop = scrollTop - deltaY;
}

// Initialize dragging when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeDragging();
    
    // Add touch-device class only for mobile/tablet devices (not hybrid desktops)
    if (isMobileDevice()) {
        document.body.classList.add('touch-device');
    }
    
    // Add hybrid-device class for desktop devices with touch capability
    if (!isMobileDevice() && hasTouchCapability()) {
        document.body.classList.add('hybrid-device');
    }

    // Attach backdrop handlers to prevent click-through on mobile/desktop
    const modalBackdrop = document.getElementById('modal');
    const highResBackdrop = document.getElementById('highResModal');
    if (modalBackdrop) {
        modalBackdrop.addEventListener('click', handleBackdropInteraction, true);
        modalBackdrop.addEventListener('touchend', handleBackdropInteraction, { passive: false });
    }
    if (highResBackdrop) {
        highResBackdrop.addEventListener('click', handleBackdropInteraction, true);
        highResBackdrop.addEventListener('touchend', handleBackdropInteraction, { passive: false });
    }

    // Attach image pinch handlers globally (they act only when an image is shown)
    const container = document.getElementById('highResImage');
    if (container && isMobileDevice()) {
        container.addEventListener('touchstart', onImageTouchStart, { passive: false });
        container.addEventListener('touchmove', onImageTouchMove, { passive: false });
        container.addEventListener('touchend', onImageTouchEnd);
        // Double-tap to toggle zoom on mobile
        container.addEventListener('touchend', onDoubleTapToggleZoom, { passive: false });
        // Swipe navigation (one finger)
        container.addEventListener('touchstart', onSwipeStart, { passive: true });
        container.addEventListener('touchmove', onSwipeMove, { passive: true });
        container.addEventListener('touchend', onSwipeEnd, { passive: false });
    }
});

// On orientation changes, reset to default fit (100%) and center vertically
window.addEventListener('orientationchange', () => {
    const modal = document.getElementById('highResModal');
    const containerEl = document.getElementById('highResImage');
    if (!modal || modal.style.display !== 'block' || !containerEl) return;
    // Reset zoom to baseline
    currentZoom = 100;
    if (pdfState.isActive) {
        // Recompute baseFitScale on next render and keep centered
        schedulePdfRerender();
        containerEl.classList.add('center-fit');
    } else {
        imagePinch.active = true;
        applyZoom();
        imagePinch.active = false;
        containerEl.classList.add('center-fit');
    }
});

// --- Swipe navigation (mobile) ---
// Tunable constants for swipe sensitivity
const SWIPE_MIN_X = 48;     // minimum horizontal distance in px to trigger
const SWIPE_MAX_Y = 60;     // maximum vertical deviation in px allowed
const SWIPE_COOLDOWN_MS = 300; // cooldown after a swipe triggers
const EDGE_GUARD_PX = 32;   // ignore swipes that start within this many px from left/right edges

let swipeStartX = 0, swipeStartY = 0, swipeActive = false, swipeDidMove = false, swipeCooldown = false;
let lastSwipeMoveTime = 0;
function onSwipeStart(e) {
    if (!isMobileDevice()) return;
    if (pdfState.pinch.active || imagePinch.active) return; // ignore during pinch
    if (e.touches.length !== 1) return; // single-finger only
    swipeActive = true; swipeDidMove = false;
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
    // Edge guard: if gesture starts too close to edges, let OS back/forward gestures win
    const vw = window.innerWidth || document.documentElement.clientWidth;
    if (swipeStartX <= EDGE_GUARD_PX || (vw - swipeStartX) <= EDGE_GUARD_PX) {
        swipeActive = false; // don't treat as our swipe
    }
}
function onSwipeMove(e) {
    if (!swipeActive) return;
    if (e.touches.length !== 1) { swipeActive = false; return; }
    const dx = e.touches[0].clientX - swipeStartX;
    const dy = e.touches[0].clientY - swipeStartY;
    // Mark moved to help reject double-tap overlap
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) { swipeDidMove = true; lastSwipeMoveTime = performance.now(); }
}
function onSwipeEnd(e) {
    if (!swipeActive) return;
    swipeActive = false;
    if (swipeCooldown) return;
    if (pdfState.pinch.active || imagePinch.active) return; // pinch ended last, ignore
    // If zoomed in, prefer panning over swiping
    if (currentZoom > 100) return;
    // Compute deltas using changedTouches for robustness
    const touch = e.changedTouches && e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - swipeStartX;
    const dy = touch.clientY - swipeStartY;
    const absX = Math.abs(dx), absY = Math.abs(dy);
    if (absX >= SWIPE_MIN_X && absY <= SWIPE_MAX_Y) {
        // Prevent triggering links/highlighting
        if (e.cancelable) e.preventDefault();
        if (dx < 0) {
            navigateHighResImage(1);
        } else {
            navigateHighResImage(-1);
        }
        // Short cooldown to avoid accidental double-triggers
        swipeCooldown = true;
        setTimeout(()=>{ swipeCooldown = false; }, SWIPE_COOLDOWN_MS);
    }
}

// Image pinch handlers
function onImageTouchStart(e) {
    // Only when an IMG is present and PDF viewer not active
    if (pdfState.isActive) return;
    const container = document.getElementById('highResImage');
    if (!container || !container.querySelector('img')) return;
    if (e.touches.length === 2) {
        if (e.cancelable) e.preventDefault();
        imagePinch.active = true;
        imagePinch.startDist = getTouchDistance(e.touches[0], e.touches[1]);
        imagePinch.startZoom = currentZoom;
        container.classList.add('pinching');
    }
}
function onImageTouchMove(e) {
    if (!imagePinch.active || e.touches.length !== 2) return;
    if (e.cancelable) e.preventDefault();
    const container = document.getElementById('highResImage');
    const img = container ? container.querySelector('img') : null;
    // Capture focal point before zoom changes
    let containerX=0, containerY=0, contentX=0, contentY=0, prev=currentZoom;
    if (container && img) {
        const rect = container.getBoundingClientRect();
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        containerX = cx - rect.left;
        containerY = cy - rect.top;
        const contentLeft = img.offsetLeft;
        const contentTop = img.offsetTop;
        contentX = (container.scrollLeft + containerX) - contentLeft;
        contentY = (container.scrollTop + containerY) - contentTop;
    }
    const newDist = getTouchDistance(e.touches[0], e.touches[1]);
    const ratio = newDist / imagePinch.startDist;
    const minZoom = isMobileDevice() ? 100 : 10;
    const target = Math.min(1000, Math.max(minZoom, Math.round(imagePinch.startZoom * ratio)));
    if (Math.abs(target - currentZoom) >= 3) {
        currentZoom = target;
        applyZoom();
        showZoomIndicator();
        // After zoom, adjust scroll to keep focal point under fingers
        if (container && img) {
            const scaleRatio = currentZoom / (prev || currentZoom);
            const newContentX = contentX * scaleRatio;
            const newContentY = contentY * scaleRatio;
            const imgLeft = img.offsetLeft;
            const imgTop = img.offsetTop;
            container.scrollLeft = Math.max(0, Math.round(imgLeft + newContentX - containerX));
            container.scrollTop  = Math.max(0, Math.round(imgTop  + newContentY - containerY));
        }
    }
}
function onImageTouchEnd(e) {
    if (e.touches.length < 2) {
        imagePinch.active = false;
        const container = document.getElementById('highResImage');
        if (container) container.classList.remove('pinching');
    }
}

// --- Deep Linking & Share Utilities ---
function parseHash(raw) {
    if (!raw) return { pid: null, index: null, page: null };
    const parts = raw.split(':');
    const pid = parts[0] || null;
    let index = null, page = null;
    if (parts.length > 1) {
        const rest = parts[1];
        const sub = rest.split('@'); // support :index@page for PDFs
        const n = parseInt(sub[0],10);
        if (!isNaN(n) && n >= 0) index = n;
        if (sub.length > 1) {
            const p = parseInt(sub[1],10);
            if (!isNaN(p) && p >= 1) page = p;
        }
    }
    return { pid, index, page };
}
function processDeepLink() {
    const raw = decodeURIComponent(location.hash || '').replace('#','');
    if (!raw) return;
    const { pid, index, page } = parseHash(raw);
    if (!pid) return;
    const target = document.querySelector('.record[data-id="'+CSS.escape(pid)+'"]');
    if (target) {
        openModal(target);
        if (typeof index === 'number') setTimeout(()=>{ if (highResImages[index]) { pendingTargetPdfPage = page || null; openHighResImage(index); } }, 30);
        dispatchProjectOpen(pid, index);
    }
}
function handleHashChange() {
    const raw = decodeURIComponent(location.hash || '').replace('#','');
    if (!raw) {
        if (isMainModalOpen) closeModal('modal');
        return;
    }
    const { pid, index, page } = parseHash(raw);
    if (!pid) return;
    if (currentRecordId === pid) {
        if (typeof index === 'number' && highResImages[index]) { pendingTargetPdfPage = page || null; openHighResImage(index); }
        return;
    }
    const target = document.querySelector('.record[data-id="'+CSS.escape(pid)+'"]');
    if (target) {
        if (isMainModalOpen) closeModal('modal');
        openModal(target);
        if (typeof index === 'number') setTimeout(()=>{ if (highResImages[index]) { pendingTargetPdfPage = page || null; openHighResImage(index); } }, 30);
        dispatchProjectOpen(pid, index);
    }
}
function generateSlug(str) {
    let base = (str || 'project').toLowerCase().trim()
        .replace(/[^a-z0-9\s-]/g,'')
        .replace(/\s+/g,'-')
        .replace(/-+/g,'-')
        .replace(/^-|-$/g,'');
    if (!base) base = 'project';
    if (generatedSlugCounts[base] == null) generatedSlugCounts[base] = 0; else generatedSlugCounts[base] += 1;
    const c = generatedSlugCounts[base];
    return c === 0 ? base : base+'-'+c;
}
function copyProjectLink(includeImageIndex, btn) {
    if (!currentRecordId) return;
    const base = window.location.origin + window.location.pathname + window.location.search;
    let hash = '#'+encodeURIComponent(currentRecordId);
    if (includeImageIndex && typeof currentHighResIndex==='number') hash += ':'+currentHighResIndex;
    const full = base + hash;
    let originalHTML;
    if (btn) {
        if (!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
        originalHTML = btn.dataset.originalHtml;
    }
    const feedback = () => {
        if (btn) {
            btn.disabled = true; btn.textContent='Gekopieerd!';
            setTimeout(()=>{ btn.disabled=false; btn.innerHTML=originalHTML; },1600);
        } else { alert('Link gekopieerd: '+full); }
        announceCopySuccess(!!includeImageIndex);
    };
    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(full).then(feedback).catch(()=>{ fallbackCopy(full); feedback(); });
    } else { fallbackCopy(full); feedback(); }
}
function fallbackCopy(text) {
    const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.top='-1000px';
    document.body.appendChild(ta); ta.select(); try{document.execCommand('copy');}catch(e){}; document.body.removeChild(ta);
}
function ensureHighResShareButton() {
    const container = document.getElementById('highResModal');
    if (!container) return;
    let btn = container.querySelector('.share-image-link');
    if (!btn) {
        btn = document.createElement('button');
        btn.type='button';
        btn.className='share-image-link icon-copy-btn';
        btn.setAttribute('aria-label','Kopieer afbeelding link');
        btn.innerHTML = getCopyIconSVG();
        // Positioning now handled purely in CSS so it can sit to the left of the existing close button.
        // (Removed previous inline absolute positioning to avoid overlap.)
        btn.addEventListener('click', ()=> copyProjectLink(true, btn));
        container.appendChild(btn);
    }

    // Ensure Fit/Reset button exists (mobile-only via CSS)
    let fit = container.querySelector('.fit-reset-btn');
    if (!fit) {
        fit = document.createElement('button');
        fit.type = 'button';
        fit.className = 'fit-reset-btn icon-copy-btn';
        fit.setAttribute('aria-label','Passend maken');
        fit.textContent = 'Fit';
        fit.addEventListener('click', () => {
            // Reset to baseline (100%) and re-render
            if (currentZoom !== 100) {
                const prev = currentZoom;
                currentZoom = 100;
                const containerEl = document.getElementById('highResImage');
                if (pdfState.isActive) {
                    // center around current viewport center using existing pdf pinch fields
                    if (containerEl) {
                        const rect = containerEl.getBoundingClientRect();
                        const cx = rect.left + rect.width/2;
                        const cy = rect.top + rect.height/2;
                        const canvas = containerEl.querySelector('canvas');
                        if (canvas) {
                            const contentLeft = canvas.offsetLeft;
                            const contentTop = canvas.offsetTop;
                            pdfState.pinch.prevZoom = prev;
                            pdfState.pinch.containerX = rect.width/2;
                            pdfState.pinch.containerY = rect.height/2;
                            pdfState.pinch.contentX = (containerEl.scrollLeft + rect.width/2) - contentLeft;
                            pdfState.pinch.contentY = (containerEl.scrollTop + rect.height/2) - contentTop;
                        }
                    }
                    schedulePdfRerender();
                    if (containerEl) containerEl.classList.add('center-fit');
                } else {
                    // Images: allow applyZoom and center roughly on current view center
                    imagePinch.active = true;
                    applyZoom();
                    imagePinch.active = false;
                    // Center vertically at baseline
                    if (containerEl) containerEl.classList.add('center-fit');
                    if (containerEl) {
                        const img = containerEl.querySelector('img');
                        if (img) {
                            const rect = containerEl.getBoundingClientRect();
                            const imgLeft = img.offsetLeft;
                            const imgTop = img.offsetTop;
                            // Scroll so center aligns
                            containerEl.scrollLeft = Math.max(0, Math.round(imgLeft + (img.clientWidth/2) - (rect.width/2)));
                            containerEl.scrollTop  = Math.max(0, Math.round(imgTop  + (img.clientHeight/2) - (rect.height/2)));
                        }
                    }
                }
                showZoomIndicator();
            }
        });
        container.appendChild(fit);
    }
}
function dispatchProjectOpen(id, imageIndex) {
    try { window.dispatchEvent(new CustomEvent('projectModalOpen', { detail:{ id, imageIndex } })); } catch(e) {}
    console.log('[projectModalOpen]', id, imageIndex != null ? imageIndex : '');
}
function getCopyIconSVG() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
}

// ---- Debounced hash updating ----
function scheduleHashUpdate(target, immediate=false, clear=false) {
    // target: '#hash' or full path when clear
    if (immediate) {
        history.replaceState(null,'',target);
        return;
    }
    if (pendingHashUpdate) cancelAnimationFrame(pendingHashUpdate);
    pendingHashUpdate = requestAnimationFrame(()=>{
        history.replaceState(null,'',target);
        pendingHashUpdate = null;
    });
}

// Update hash to include page when viewing a PDF
function updateHashForCurrentAsset() {
    if (!currentRecordId) return;
    const base = '#'+encodeURIComponent(currentRecordId)+':'+currentHighResIndex;
    const suffix = (pdfState.isActive && pdfState.currentPage) ? ('@'+pdfState.currentPage) : '';
    const combined = base + suffix;
    if (location.hash !== combined) scheduleHashUpdate(combined);
}

// ---- Debounced PDF re-rendering ----
function schedulePdfRerender() {
    if (!pdfState.isActive) return;
    if (pendingPdfRerender) cancelAnimationFrame(pendingPdfRerender);
    pendingPdfRerender = requestAnimationFrame(()=>{
        pendingPdfRerender = null;
        renderPdfAtCurrentZoom();
    });
}

// ---- Preload adjacent images for smoother navigation ----
function preloadAdjacentHighRes() {
    if (!highResImages || !highResImages.length) return;
    if (highResImages.length < 2) return; // nothing to preload
    const nextIndex = (currentHighResIndex + 1) % highResImages.length;
    const prevIndex = (currentHighResIndex - 1 + highResImages.length) % highResImages.length;
    [nextIndex, prevIndex].forEach(i => {
        const src = highResImages[i];
        if (!src || src.endsWith('.pdf')) return; // skip PDFs
        const img = new Image();
        img.decoding = 'async';
        img.src = src;
    });
}

// ---- Live region for copy status ----
function ensureLiveRegion() {
    if (!document.getElementById('copy-status-live')) {
        const live = document.createElement('div');
        live.id = 'copy-status-live';
        live.className = 'visually-hidden';
        live.setAttribute('role','status');
        live.setAttribute('aria-live','polite');
        document.body.appendChild(live);
    }
}
function announceCopySuccess(withImage) {
    ensureLiveRegion();
    const live = document.getElementById('copy-status-live');
    if (live) live.textContent = withImage ? 'Afbeeldingslink gekopieerd' : 'Projectlink gekopieerd';
}

// ---- Zoom UI helpers (indicator, memory, double-tap) ----
function ensureZoomIndicator() {
    const modal = document.getElementById('highResModal');
    if (!modal) return null;
    let el = modal.querySelector('#zoom-indicator');
    if (!el) {
        el = document.createElement('div');
        el.id = 'zoom-indicator';
        el.setAttribute('role','status');
        el.setAttribute('aria-live','polite');
        const text = document.createElement('span');
        text.className = 'zi-text';
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'zi-close';
        close.setAttribute('aria-label','Sluit zoomindicator');
        close.textContent = '×';
        close.addEventListener('click', ()=>{ zoomIndicatorDismissed = true; el.classList.remove('visible'); });
        el.appendChild(text);
        el.appendChild(close);
        modal.appendChild(el);
    }
    return el;
}
function showZoomIndicator() {
    if (zoomIndicatorDismissed) return;
    const el = ensureZoomIndicator();
    if (!el) return;
    const text = el.querySelector('.zi-text');
    if (text) text.textContent = currentZoom + '%'; else el.textContent = currentZoom + '%';
    el.classList.add('visible');
    if (zoomIndicatorTimeout) cancelAnimationFrame(zoomIndicatorTimeout);
    const hideAt = performance.now() + 1200;
    function tick(now){
        if (now >= hideAt) {
            el.classList.remove('visible');
            zoomIndicatorTimeout = null;
        } else {
            zoomIndicatorTimeout = requestAnimationFrame(tick);
        }
    }
    zoomIndicatorTimeout = requestAnimationFrame(tick);
}
const DOUBLE_TAP_LEVELS = [100, 150, 200, 300];
function nextDoubleTapLevel(cur) {
    const sorted = DOUBLE_TAP_LEVELS.slice().sort((a,b)=>a-b);
    for (let i=0;i<sorted.length;i++) {
        if (sorted[i] > cur) return sorted[i];
    }
    return sorted[0];
}
function onDoubleTapToggleZoom(e) {
    if (!isMobileDevice()) return;
    if (e.touches && e.touches.length) return;
    if (pdfState.pinch.active || imagePinch.active) return;
    // If a swipe move just occurred, ignore a near-immediate tap
    if (lastSwipeMoveTime && (performance.now() - lastSwipeMoveTime) < 120) return;
    const now = performance.now();
    const cx = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : 0;
    const cy = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : 0;
    const dt = now - lastTapTime;
    const dx = Math.abs(cx - lastTapX);
    const dy = Math.abs(cy - lastTapY);
    if (dt < 300 && dx < 30 && dy < 30) {
        if (e.cancelable) e.preventDefault();
    // Determine next progressive level
    const prev = currentZoom;
    let target = nextDoubleTapLevel(currentZoom);
    if (isMobileDevice() && target < 100) target = 100;
        const container = document.getElementById('highResImage');
        const rect = container ? container.getBoundingClientRect() : null;
        const containerX = rect ? (cx - rect.left) : 0;
        const containerY = rect ? (cy - rect.top) : 0;
        if (pdfState.isActive) {
            // Use the existing PDF focal-point adjustment by priming pinch state
            const canvas = container ? container.querySelector('canvas') : null;
            if (canvas && container) {
                const contentLeft = canvas.offsetLeft;
                const contentTop = canvas.offsetTop;
                pdfState.pinch.prevZoom = prev;
                pdfState.pinch.containerX = containerX;
                pdfState.pinch.containerY = containerY;
                pdfState.pinch.contentX = (container.scrollLeft + containerX) - contentLeft;
                pdfState.pinch.contentY = (container.scrollTop + containerY) - contentTop;
            }
            currentZoom = target;
            schedulePdfRerender();
        } else {
            // Image case: compute focal adjustment immediately after applying zoom
            const img = container ? container.querySelector('img') : null;
            if (img && container) {
                const contentLeft = img.offsetLeft;
                const contentTop = img.offsetTop;
                const contentX = (container.scrollLeft + containerX) - contentLeft;
                const contentY = (container.scrollTop + containerY) - contentTop;
                currentZoom = target;
                imagePinch.active = true; // allow applyZoom on mobile
                applyZoom();
                imagePinch.active = false;
                const scaleRatio = currentZoom / (prev || currentZoom);
                const newContentX = contentX * scaleRatio;
                const newContentY = contentY * scaleRatio;
                const imgLeft = img.offsetLeft;
                const imgTop = img.offsetTop;
                container.scrollLeft = Math.max(0, Math.round(imgLeft + newContentX - containerX));
                container.scrollTop  = Math.max(0, Math.round(imgTop  + newContentY - containerY));
            } else {
                // Fallback: just set zoom
                currentZoom = target;
                imagePinch.active = true;
                applyZoom();
                imagePinch.active = false;
            }
        }
        showZoomIndicator();
    }
    lastTapTime = now; lastTapX = cx; lastTapY = cy;
}
function zoomKeyForCurrentItem() {
    if (currentRecordId != null && typeof currentHighResIndex === 'number') return currentRecordId + ':' + currentHighResIndex;
    if (highResImages && typeof currentHighResIndex === 'number') return 'url:' + (highResImages[currentHighResIndex] || '');
    return null;
}
function persistZoomForCurrentItem() {
    const key = zoomKeyForCurrentItem();
    if (!key) return;
    zoomMemory[key] = currentZoom;
}
function restoreZoomForCurrentItemIfAny() {
    if (!isMobileDevice()) return;
    const key = zoomKeyForCurrentItem();
    if (!key) return;
    const z = zoomMemory[key];
    if (typeof z === 'number' && z >= 10 && z <= 1000) {
        currentZoom = Math.max(100, z);
        if (pdfState.isActive) {
            schedulePdfRerender();
        } else {
            imagePinch.active = true;
            applyZoom();
            imagePinch.active = false;
        }
        showZoomIndicator();
    }
}

// --- Debug/test harness (optional) ---
function isDebugMode() {
    const qs = new URLSearchParams(window.location.search);
    const v = (qs.get('debug') || '').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
}
function runViewerSelfTest() {
    const results = [];
    try {
        // Test nextDoubleTapLevel sequence
        const seqInput = [90, 100, 120, 150, 200, 250, 300, 350];
        const seqExpect = [100, 150, 150, 200, 300, 300, 100, 100];
        const seqGot = seqInput.map(x => nextDoubleTapLevel(x));
        const okSeq = seqGot.every((v,i)=> v === seqExpect[i]);
        results.push({ name: 'nextDoubleTapLevel', pass: okSeq, detail: { input: seqInput, expect: seqExpect, got: seqGot } });
    } catch (e) {
        results.push({ name: 'nextDoubleTapLevel', pass: false, error: String(e) });
    }
    try {
        // Test zoom indicator visible/text update (requires high-res modal present)
        const modal = document.getElementById('highResModal');
        const container = document.getElementById('highResImage');
        if (modal && container && (container.querySelector('img') || container.querySelector('canvas'))) {
            currentZoom = 137;
            showZoomIndicator();
            const el = modal.querySelector('#zoom-indicator');
            const text = el ? (el.querySelector('.zi-text')?.textContent || el.textContent || '') : '';
            const hasVisible = el ? el.classList.contains('visible') : false;
            const okText = /137%/.test(text);
            results.push({ name: 'zoomIndicator', pass: !!(el && hasVisible && okText), detail: { text, hasVisible } });
        } else {
            results.push({ name: 'zoomIndicator', pass: false, skip: 'Open a high-res image/PDF first' });
        }
    } catch (e) {
        results.push({ name: 'zoomIndicator', pass: false, error: String(e) });
    }
    try {
        results.push({ name: 'edgeGuardDefined', pass: typeof EDGE_GUARD_PX === 'number', detail: { EDGE_GUARD_PX } });
    } catch (e) {
        results.push({ name: 'edgeGuardDefined', pass: false, error: String(e) });
    }
    console.group('[Viewer self-test]');
    results.forEach(r => {
        const status = r.pass ? 'PASS' : (r.skip ? 'SKIP' : 'FAIL');
        console.log(status, r.name, r.detail || r.error || r.skip || '');
    });
    const summary = {
        pass: results.filter(r=>r.pass).length,
        fail: results.filter(r=>!r.pass && !r.skip).length,
        skip: results.filter(r=>r.skip).length
    };
    console.log('Summary:', summary);
    console.groupEnd();
    return results;
}

// Expose for console usage when debugging
if (typeof window !== 'undefined') {
    window.runViewerSelfTest = runViewerSelfTest;
}

document.addEventListener('DOMContentLoaded', () => {
    if (isDebugMode()) {
        console.info('[debug] Enable ?debug=1 in the URL. After opening a high-res image/PDF, run window.runViewerSelfTest() in the console to validate.');
    }
});
