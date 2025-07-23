let isMainModalOpen = false; // Track if the main modal is open
let currentHighResIndex = 0; // Track the current high-resolution image index
let highResImages = []; // Store the list of high-resolution images

// Fetch and display records
document.addEventListener("DOMContentLoaded", function() {
    fetch('records.json')
        .then(response => response.json())
        .then(data => {
            const collectionGrid = document.getElementById('collection-grid');
            data.forEach(record => {
                const recordDiv = document.createElement('div');
                recordDiv.className = 'record';
                recordDiv.setAttribute('onclick', 'openModal(this)');
                recordDiv.setAttribute('data-title', record.title);
                recordDiv.setAttribute('data-artist', record.artist);
                recordDiv.setAttribute('data-year', record.year);
                recordDiv.setAttribute('data-genre', record.genre);
                recordDiv.setAttribute('data-label', record.label);
                recordDiv.setAttribute('data-thumbnails', JSON.stringify(record.thumbnails));
                recordDiv.setAttribute('data-highres', JSON.stringify(record.highres));
                recordDiv.setAttribute('data-info', record.info);
                recordDiv.setAttribute('data-release', record.release); // Add release data attribute

                recordDiv.innerHTML = `
                    <img src="${record.cover}" alt="${record.title} Cover" class="album-cover">
                    <div class="info">
                        <h3 class="data-title">${record.title}</h3>
                        <p><strong>Artist:</strong> <span class="data-artist">${record.artist.replace(/&/g, '&<br>')}</span></p>
                        <p><strong>Year:</strong> <span class="data-year">${record.year}</span></p>
                        <p><strong>Genre:</strong> <span class="data-genre">${record.genre}</span></p>
                        <p><strong>Record Label:</strong> <span class="data-label">${record.label}</span></p>
                        <p><strong>Release:</strong> <span class="data-release">Click for details</span></p>
                    </div>
                `;
                collectionGrid.appendChild(recordDiv);
            });
        })
        .catch(error => console.error('Error fetching records:', error));
});

// Open modal function for album details
function openModal(record) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
    isMainModalOpen = true; // Set the flag to true

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

    // Generate the content for the modal
    let content = `
        <h2>${title}</h2>
        <div class="thumbnails">`;

    // Add the thumbnails
    thumbnails.forEach((thumbnail, index) => {
        if (thumbnail.endsWith('.pdf')) {
            content += `<div class="pdf-thumbnail" onclick="openHighResImage(${index})">
                            <img src="path/to/pdf-icon.png" alt="PDF Thumbnail"> <!-- Placeholder for PDF icon -->
                        </div>`;
        } else {
            content += `<img src="${thumbnail}" alt="${title} Thumbnail ${index + 1}" class="thumbnail" onclick="openHighResImage(${index})">`;
        }
    });

    content += `</div>
        <p class="modal-content-p"><strong><br>Project info: </strong>${info}</p>
        <p class="modal-content-p"><strong>Externe info:</strong> <a href="${release}" target="_blank">Link</a></p>`;

    modalBody.innerHTML = content;
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
                // Mobile: Use full available dimensions with native zoom capabilities
                // Account for mobile padding and ensure full screen usage
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
                img.style.cssText = `
                    width: ${fittedWidth}px;
                    height: ${fittedHeight}px;
                    object-fit: contain;
                    object-position: center;
                    display: block;
                    transition: transform 0.3s ease;
                    cursor: grab;
                    margin: auto;
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

    // Create a canvas element
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    const context = canvas.getContext('2d');

    // Load the PDF
    pdfjsLib.getDocument(url).promise.then(pdf => {
        // Fetch the first page
        pdf.getPage(1).then(page => {
            // Get container dimensions
            const containerRect = container.getBoundingClientRect();
            const availableWidth = containerRect.width;
            const availableHeight = containerRect.height;
            
            // Get initial viewport to calculate dimensions
            const initialViewport = page.getViewport({ scale: 1 });
            
            // Calculate scale to fit within available space while maintaining aspect ratio
            const scaleX = availableWidth / initialViewport.width;
            const scaleY = availableHeight / initialViewport.height;
            const scale = Math.min(scaleX, scaleY);
            
            const viewport = page.getViewport({ scale: scale });
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            // Calculate the fitted dimensions for screen fitting
            const fittedWidth = viewport.width;
            const fittedHeight = viewport.height;
            
            if (isMobileDevice()) {
                // Mobile: Use full available dimensions with native zoom capabilities
                canvas.style.cssText = `
                    width: 100%;
                    height: 100%;
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                    display: block;
                    margin: 0;
                    touch-action: manipulation;
                    user-select: none;
                `;
            } else {
                // Desktop: Use fitted dimensions with custom zoom controls
                canvas.style.cssText = `
                    width: ${fittedWidth}px;
                    height: ${fittedHeight}px;
                    object-fit: contain;
                    display: block;
                    transition: transform 0.3s ease;
                    cursor: grab;
                    margin: auto;
                `;
            }

            // Render the page into the canvas context
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            page.render(renderContext);
        });
    }).catch(error => {
        console.error('Error loading PDF:', error);
        container.innerHTML = '<p style="color: white; text-align: center;">Error loading PDF</p>';
    });
}

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
    } else if (modalId === 'highResModal' && !isMainModalOpen) {
        document.body.classList.remove('modal-open');
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
            }
        } else {
            modal.style.display = 'none';
            isMainModalOpen = false;
            document.body.classList.remove('modal-open');
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

        if (title.includes(filter) || artist.includes(filter) || year.includes(filter) || genre.includes(filter) || label.includes(filter)) {
            record.style.display = '';
        } else {
            record.style.display = 'none';
        }
    });
}

window.addEventListener('load', function() {
    // Get all image-box elements
    const imageBoxes = document.querySelectorAll('.image-box');

    imageBoxes.forEach(box => {
        // Get the image and caption elements
        const image = box.querySelector('.image');
        const caption = box.querySelector('.caption');

        // Set the caption width to match the image width
        caption.style.width = `${image.clientWidth}px`;
    });
});

// Zoom functionality variables
let currentZoom = 100;
let isDragging = false;
let startX, startY, scrollLeft, scrollTop;

// Mobile/tablet device detection - prioritizes mobile user agents and small screens
function isMobileDevice() {
    // Check for mobile/tablet user agents first (most reliable)
    const isMobileUserAgent = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(navigator.userAgent);
    
    // Check for small screen sizes (mobile/tablet sized)
    const isSmallScreen = window.innerWidth <= 1024;
    
    // Check for touch capability
    const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
    
    // Return true if it's a known mobile/tablet OR has a small screen with touch
    return isMobileUserAgent || (isSmallScreen && hasTouchScreen);
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
    // Skip zoom functionality on mobile devices
    if (isMobileDevice()) return;
    
    const highResImage = document.getElementById('highResImage');
    const img = highResImage.querySelector('img');
    const canvas = highResImage.querySelector('canvas');
    
    const scale = currentZoom / 100;
    
    if (img) {
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
    
    if (canvas) {
        // For canvas, we need to handle scaling differently
        // Get the original dimensions that the canvas was rendered at
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        
        // Calculate scale to fit within available space (this is our 100% baseline)
        const containerRect = highResImage.getBoundingClientRect();
        const availableWidth = containerRect.width;
        const availableHeight = containerRect.height;
        
        const baseScaleX = availableWidth / canvasWidth;
        const baseScaleY = availableHeight / canvasHeight;
        const baseScale = Math.min(baseScaleX, baseScaleY);
        
        // Calculate the baseline fitted dimensions (100% zoom)
        const baseFittedWidth = canvasWidth * baseScale;
        const baseFittedHeight = canvasHeight * baseScale;
        
        // Apply the zoom scale to the baseline fitted dimensions
        const finalWidth = baseFittedWidth * scale;
        const finalHeight = baseFittedHeight * scale;
        
        canvas.style.width = finalWidth + 'px';
        canvas.style.height = finalHeight + 'px';
        canvas.style.maxWidth = 'none';
        canvas.style.maxHeight = 'none';
        canvas.style.transform = 'none';
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
    
    // Add touch-device class to body for touch-capable devices
    if (isMobileDevice()) {
        document.body.classList.add('touch-device');
    }
});
