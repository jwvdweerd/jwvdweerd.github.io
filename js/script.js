let isMainModalOpen = false; // Track if the main modal is open
let currentHighResIndex = 0; // Track the current high-resolution image index
let highResImages = []; // Store the list of high-resolution images
let lastFocusedElement = null; // For returning focus after closing modal
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
    pinch: { active: false, startDist: 0, startZoom: 100 }
};

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

    fetch('records.json')
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
    document.body.classList.add('modal-open');
    
    // Reset zoom when opening new image (desktop only)
    if (!isMobileDevice()) {
        resetZoom();
    }
    // Reset PDF state
    resetPdfState();
    
    if (highResImages[currentHighResIndex].endsWith('.pdf')) {
        renderPDF(highResImages[currentHighResIndex], highResImage);
    } else {
        // Clear container first
        highResImage.innerHTML = '';
        
        // Create and add screen-fitted image
        createScreenFittedImage(highResImages[currentHighResIndex]).then(img => {
            highResImage.appendChild(img);
        });
    }
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

    pdfjsLib.getDocument(url).promise.then(pdf => {
        pdfState.doc = pdf;
        return pdf.getPage(1);
    }).then(page => {
        pdfState.page = page;
        pdfState.isActive = true;
        // Determine fit scale
        const containerRect = container.getBoundingClientRect();
        const initialViewport = page.getViewport({ scale: 1 });
        const scaleX = containerRect.width / initialViewport.width;
        const scaleY = containerRect.height / initialViewport.height;
        pdfState.baseFitScale = Math.min(scaleX, scaleY);
        // Render at base (100%)
        renderPdfAtCurrentZoom();
        // Enable pinch zoom on mobile for PDF
        if (isMobileDevice()) attachPdfPinchHandlers();
    }).catch(err => {
        console.error('Error loading PDF:', err);
        container.innerHTML = '<p style="color: white; text-align: center;">Error loading PDF</p>';
        resetPdfState();
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
    canvas.style.margin = 'auto';
    canvas.style.display = 'block';
    canvas.style.transition = 'none';
    if (isMobileDevice()) {
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
    }
    const renderTask = pdfState.page.render({ canvasContext: ctx, viewport });
    renderTask.promise.then(() => {
        pdfState.rendering = false;
        if (pdfState.pendingZoom && pdfState.pendingZoom !== currentZoom) {
            pdfState.pendingZoom = null;
            renderPdfAtCurrentZoom();
        }
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
}

// Mobile pinch zoom support for PDFs (re-renders at new scale)
function attachPdfPinchHandlers() {
    const container = document.getElementById('highResImage');
    if (!container) return;
    container.addEventListener('touchstart', onPdfTouchStart, { passive: false });
    container.addEventListener('touchmove', onPdfTouchMove, { passive: false });
    container.addEventListener('touchend', onPdfTouchEnd);
}
function onPdfTouchStart(e) {
    if (!pdfState.isActive) return;
    if (e.touches.length === 2) {
        pdfState.pinch.active = true;
        pdfState.pinch.startDist = getTouchDistance(e.touches[0], e.touches[1]);
        pdfState.pinch.startZoom = currentZoom;
    }
}
function onPdfTouchMove(e) {
    if (!pdfState.isActive || !pdfState.pinch.active || e.touches.length !== 2) return;
    e.preventDefault();
    const newDist = getTouchDistance(e.touches[0], e.touches[1]);
    const ratio = newDist / pdfState.pinch.startDist;
    const target = Math.min(1000, Math.max(10, Math.round(pdfState.pinch.startZoom * ratio)));
    if (Math.abs(target - currentZoom) >= 5) { // update when change significant
        currentZoom = target;
        renderPdfAtCurrentZoom();
    }
}
function onPdfTouchEnd(e) {
    if (e.touches.length < 2) {
        pdfState.pinch.active = false;
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
    
    // Reset zoom when navigating to new image (desktop only)
    if (!isMobileDevice()) {
        resetZoom();
    }
    resetPdfState();
    
    if (highResImages[currentHighResIndex].endsWith('.pdf')) {
        renderPDF(highResImages[currentHighResIndex], highResImage);
    } else {
        // Clear container first
        highResImage.innerHTML = '';
        
        // Create and add screen-fitted image
        createScreenFittedImage(highResImages[currentHighResIndex]).then(img => {
            highResImage.appendChild(img);
        });
    }
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
    } else if (modalId === 'highResModal' && !isMainModalOpen) {
        document.body.classList.remove('modal-open');
        if (lastFocusedElement && document.contains(lastFocusedElement)) {
            lastFocusedElement.focus();
        }
    }
}

// Add touch event listeners to close modal when touching outside the modal content on touch devices
window.ontouchstart = function(event) {
    const modal = document.getElementById('modal');
    const highResModal = document.getElementById('highResModal');
    if (event.target == highResModal) {
        highResModal.style.display = 'none';
        if (isMainModalOpen) {
            modal.style.display = 'block';
        } else {
            document.body.classList.remove('modal-open');
        }
    } else if (event.target == modal) {
        modal.style.display = 'none';
        isMainModalOpen = false;
        document.body.classList.remove('modal-open');
    }
}

// Close modal when clicking outside the modal content
window.onclick = function(event) {
    const modal = document.getElementById('modal');
    const highResModal = document.getElementById('highResModal');
    if (event.target == highResModal) {
        highResModal.style.display = 'none';
        if (isMainModalOpen) {
            modal.style.display = 'block';
        } else {
            document.body.classList.remove('modal-open');
        }
    } else if (event.target == modal) {
        modal.style.display = 'none';
        isMainModalOpen = false;
        document.body.classList.remove('modal-open');
    }
}

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

// Device detection - distinguishes between mobile/tablet and desktop with optional touch
function isMobileDevice() {
    // Check for mobile/tablet user agents first (most reliable)
    const isMobileUserAgent = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(navigator.userAgent);
    
    // Check for small screen sizes (mobile/tablet sized)
    const isSmallScreen = window.innerWidth <= 1024;
    
    // Return true only for genuine mobile/tablet devices
    return isMobileUserAgent || isSmallScreen;
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
        updateZoomSelect();
    }
}

// Apply zoom transformation
function applyZoom() {
    // For images we skip zoom on mobile; for PDFs we still re-render (pinch zoom sets currentZoom)
    if (isMobileDevice() && !pdfState.isActive) return;
    
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
    }
    
    if (canvas && pdfState.isActive) {
        // Re-render PDF at new zoom for crisp vector display
        renderPdfAtCurrentZoom();
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
});
