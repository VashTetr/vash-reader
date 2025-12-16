class ZoomHandler {
    constructor() {
        this.currentZoom = 1.0;
        this.minZoom = 1.0; // Prevent zooming below 100%
        this.maxZoom = 5.0;
        this.zoomStep = 0.1;
        this.isZooming = false;

        // Store original transform origin
        this.originalTransformOrigin = null;

        // Drag-to-pan functionality
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.scrollStartX = 0;
        this.scrollStartY = 0;

        this.initializeZoom();
        this.initializeDragPan();
        this.initializePageChangeDetection();
    }

    // Check if we're currently in reader mode
    isReaderActive() {
        const readerElement = document.getElementById('reader');
        return readerElement && !readerElement.classList.contains('hidden');
    }

    // Reset zoom when leaving reader mode
    resetZoomOnPageChange() {
        if (!this.isReaderActive() && this.currentZoom !== 1.0) {
            this.resetZoom();
        }
    }

    // Initialize detection for page changes to reset zoom
    initializePageChangeDetection() {
        // Watch for changes to the reader element visibility
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    // Check if reader became hidden
                    this.resetZoomOnPageChange();
                }
            });
        });

        // Start observing the reader element if it exists
        const readerElement = document.getElementById('reader');
        if (readerElement) {
            observer.observe(readerElement, {
                attributes: true,
                attributeFilter: ['class']
            });
        }

        // Also listen for navigation events
        document.addEventListener('click', (e) => {
            // Check for navigation buttons that might leave reader mode
            if (e.target.id === 'backFromReader' ||
                e.target.id === 'homeTitle' ||
                e.target.id === 'followsBtn' ||
                e.target.classList.contains('clickable-title')) {
                // Delay the check to allow DOM to update
                setTimeout(() => this.resetZoomOnPageChange(), 100);
            }
        });
    }

    initializeZoom() {
        // Add wheel event listener for Ctrl+Scroll zoom
        document.addEventListener('wheel', (e) => {
            // Only zoom if Ctrl is held down AND we're in reader mode
            if (e.ctrlKey && this.isReaderActive()) {
                e.preventDefault();
                this.handleZoom(e);
            }
            // Let normal scrolling work natively when not holding Ctrl
        }, { passive: false });

        // Prevent default browser zoom
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '0') && this.isReaderActive()) {
                e.preventDefault();
            }
        });

        // Reset zoom on Ctrl+0
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === '0' && this.isReaderActive()) {
                e.preventDefault();
                this.resetZoom();
            }
        });
    }



    getMaxScrollValues() {
        // When using transform: scale(), we need to calculate boundaries based on 
        // the actual scaled content dimensions vs viewport size

        const appContainer = document.querySelector('.app') || document.body;

        // Get the original content dimensions by temporarily resetting transform
        // This ensures we get accurate unscaled dimensions
        const currentTransform = appContainer.style.transform;
        appContainer.style.transform = 'scale(1)';

        // Force reflow to get accurate measurements
        appContainer.offsetHeight;

        // Get dimensions at 100% scale
        const rect = appContainer.getBoundingClientRect();
        const originalWidth = rect.width;
        const originalHeight = rect.height;

        // Restore the zoom transform immediately
        appContainer.style.transform = currentTransform;

        // Calculate scaled dimensions
        const scaledWidth = originalWidth * this.currentZoom;
        const scaledHeight = originalHeight * this.currentZoom;

        // Calculate maximum scroll values based on scaled content
        // The content can scroll until the far edge is visible in the viewport
        const maxScrollX = Math.max(0, scaledWidth - window.innerWidth);
        const maxScrollY = Math.max(0, scaledHeight - window.innerHeight);



        return { maxScrollX, maxScrollY };
    }

    initializeDragPan() {
        // Mouse down - start dragging
        document.addEventListener('mousedown', (e) => {
            // Only enable drag when zoomed in above 100% AND in reader mode
            if (this.currentZoom > 1.0 && this.isReaderActive()) {
                // Don't interfere with UI elements (buttons, inputs, etc.)
                if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' ||
                    e.target.tagName === 'SELECT' || e.target.tagName === 'A' ||
                    e.target.closest('button') || e.target.closest('input') ||
                    e.target.closest('select') || e.target.closest('a')) {
                    return;
                }

                this.isDragging = true;
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;
                this.scrollStartX = window.pageXOffset || document.documentElement.scrollLeft;
                this.scrollStartY = window.pageYOffset || document.documentElement.scrollTop;

                document.body.classList.add('dragging');
                e.preventDefault();
            }
        });

        // Mouse move - handle dragging
        document.addEventListener('mousemove', (e) => {
            if (this.isDragging && this.currentZoom > 1.0 && this.isReaderActive()) {
                const deltaX = e.clientX - this.dragStartX;
                const deltaY = e.clientY - this.dragStartY;

                // Calculate new scroll position (inverted for natural feel)
                const newScrollX = this.scrollStartX - deltaX;
                const newScrollY = this.scrollStartY - deltaY;

                // Get maximum scroll values based on actual scaled content
                const { maxScrollX, maxScrollY } = this.getMaxScrollValues();

                // Clamp scroll values to valid ranges
                const clampedScrollX = Math.max(0, Math.min(newScrollX, maxScrollX));
                const clampedScrollY = Math.max(0, Math.min(newScrollY, maxScrollY));

                window.scrollTo(clampedScrollX, clampedScrollY);
                e.preventDefault();
            }
        });

        // Mouse up - stop dragging
        document.addEventListener('mouseup', (e) => {
            if (this.isDragging) {
                this.isDragging = false;
                document.body.classList.remove('dragging');
                e.preventDefault();
            }
        });

        // Mouse leave - stop dragging if mouse leaves window
        document.addEventListener('mouseleave', () => {
            if (this.isDragging) {
                this.isDragging = false;
                document.body.classList.remove('dragging');
            }
        });
    }

    handleZoom(event) {
        const delta = event.deltaY;
        const zoomIn = delta < 0;

        // Calculate new zoom level
        const zoomChange = zoomIn ? this.zoomStep : -this.zoomStep;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.currentZoom + zoomChange));

        if (newZoom === this.currentZoom) {
            return; // No change needed
        }

        // Get current scroll position
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;

        // Get cursor position relative to the page (not viewport)
        const cursorX = event.clientX + scrollX;
        const cursorY = event.clientY + scrollY;

        // Calculate the zoom factor change
        const zoomFactor = newZoom / this.currentZoom;

        // Apply the zoom first
        this.applyZoomWithoutScroll(newZoom);

        // Wait for DOM to update, then calculate and apply scroll position
        requestAnimationFrame(() => {
            // Calculate new scroll position to keep cursor point fixed
            let newScrollX = cursorX * zoomFactor - event.clientX;
            let newScrollY = cursorY * zoomFactor - event.clientY;

            // Get the maximum scroll values after zoom
            const { maxScrollX, maxScrollY } = this.getMaxScrollValues();

            // Clamp scroll values to valid ranges
            newScrollX = Math.max(0, Math.min(newScrollX, maxScrollX));
            newScrollY = Math.max(0, Math.min(newScrollY, maxScrollY));

            // Apply the new scroll position
            window.scrollTo(newScrollX, newScrollY);
        });
    }

    applyZoomWithoutScroll(zoomLevel) {
        this.currentZoom = zoomLevel;

        // Apply zoom to the main app container instead of body
        const appContainer = document.querySelector('.app') || document.body;
        const body = document.body;

        // Use top-left origin for consistent behavior
        appContainer.style.transformOrigin = '0 0';
        appContainer.style.transform = `scale(${zoomLevel})`;

        // Handle background and viewport coverage for zoom levels >= 100%
        if (zoomLevel > 1.0) {
            body.classList.add('zoomed');
            body.style.background = '#1a1a1a';
            // Don't disable overflow - let native scrolling work
            appContainer.style.background = '#1a1a1a';
        } else {
            body.classList.remove('zoomed');
            // Reset styles when at 100%
            body.style.background = '';
            appContainer.style.background = '';
        }

        // Dispatch custom event for other components to react
        const zoomEvent = new CustomEvent('zoomChanged', {
            detail: {
                zoomLevel: zoomLevel,
                originX: 0,
                originY: 0
            }
        });
        document.dispatchEvent(zoomEvent);

        // Update zoom indicator
        this.updateZoomIndicator();
    }

    applyZoom(zoomLevel) {
        // For backward compatibility, use the new method
        this.applyZoomWithoutScroll(zoomLevel);
    }

    resetZoom() {
        this.applyZoomWithoutScroll(1.0);

        // Reset transform origin
        const appContainer = document.querySelector('.app') || document.body;
        appContainer.style.transformOrigin = '';
        document.body.style.transformOrigin = '';

        // Reset scroll to top when resetting zoom
        window.scrollTo(0, 0);
    }

    zoomIn() {
        const newZoom = Math.min(this.maxZoom, this.currentZoom + this.zoomStep);

        // For button clicks, zoom towards center of viewport
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;

        // Center of viewport in page coordinates
        const centerX = scrollX + window.innerWidth / 2;
        const centerY = scrollY + window.innerHeight / 2;

        // Calculate zoom factor
        const zoomFactor = newZoom / this.currentZoom;

        // Apply zoom
        this.applyZoomWithoutScroll(newZoom);

        // Wait for DOM to update, then calculate scroll position
        requestAnimationFrame(() => {
            // Calculate new scroll position to keep center fixed
            let newScrollX = centerX * zoomFactor - window.innerWidth / 2;
            let newScrollY = centerY * zoomFactor - window.innerHeight / 2;

            // Get the maximum scroll values after zoom
            const { maxScrollX, maxScrollY } = this.getMaxScrollValues();

            // Clamp scroll values to valid ranges
            newScrollX = Math.max(0, Math.min(newScrollX, maxScrollX));
            newScrollY = Math.max(0, Math.min(newScrollY, maxScrollY));

            window.scrollTo(newScrollX, newScrollY);
        });
    }

    zoomOut() {
        const newZoom = Math.max(this.minZoom, this.currentZoom - this.zoomStep);

        // For button clicks, zoom towards center of viewport
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;

        // Center of viewport in page coordinates
        const centerX = scrollX + window.innerWidth / 2;
        const centerY = scrollY + window.innerHeight / 2;

        // Calculate zoom factor
        const zoomFactor = newZoom / this.currentZoom;

        // Apply zoom
        this.applyZoomWithoutScroll(newZoom);

        // Wait for DOM to update, then calculate scroll position
        requestAnimationFrame(() => {
            // Calculate new scroll position to keep center fixed
            let newScrollX = centerX * zoomFactor - window.innerWidth / 2;
            let newScrollY = centerY * zoomFactor - window.innerHeight / 2;

            // Get the maximum scroll values after zoom
            const { maxScrollX, maxScrollY } = this.getMaxScrollValues();

            // Clamp scroll values to valid ranges
            newScrollX = Math.max(0, Math.min(newScrollX, maxScrollX));
            newScrollY = Math.max(0, Math.min(newScrollY, maxScrollY));

            window.scrollTo(newScrollX, newScrollY);
        });
    }

    setZoom(zoomLevel) {
        const clampedZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoomLevel));
        this.applyZoomWithoutScroll(clampedZoom);
    }

    getCurrentZoom() {
        return this.currentZoom;
    }

    updateZoomIndicator() {
        // Create or update zoom indicator
        let indicator = document.getElementById('zoom-indicator');

        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'zoom-indicator';
            indicator.className = 'zoom-indicator';
            document.body.appendChild(indicator);
        }

        // Update indicator content
        const percentage = Math.round(this.currentZoom * 100);
        indicator.textContent = `${percentage}%`;

        // Show indicator
        indicator.classList.add('visible');

        // Hide indicator after 2 seconds
        clearTimeout(this.indicatorTimeout);
        this.indicatorTimeout = setTimeout(() => {
            indicator.classList.remove('visible');
        }, 2000);
    }

    // Method to get zoom-adjusted coordinates
    getZoomAdjustedCoordinates(x, y) {
        return {
            x: x / this.currentZoom,
            y: y / this.currentZoom
        };
    }

    // Method to check if currently zoomed
    isZoomed() {
        return this.currentZoom !== 1.0;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ZoomHandler;
} else {
    window.ZoomHandler = ZoomHandler;
}