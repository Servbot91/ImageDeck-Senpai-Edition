import { getPluginConfig, injectDynamicStyles, PLUGIN_NAME } from './config.js';
import { detectContext, fetchContextImages, getVisibleImages, getVisibleGalleryCovers } from './context.js';
import { initSwiper } from './swiper.js';
import { isMobile } from './utils.js';

let pluginConfig = null;
let currentSwiper = null;
let currentImages = [];
let autoPlayInterval = null;
let isAutoPlaying = false;
let contextInfo = null;
let loadingQueue = [];
let currentChunkPage = 1;
let chunkSize = 50;
let totalImageCount = 0;
let totalPages = 0;
let storedContextInfo = null;

export async function openDeck() {
    console.log('[Image Deck] Opening deck...');
    console.log('[Image Deck] Current URL:', window.location.pathname);
    
    try {
        // Reset chunk tracking
        currentChunkPage = 1;
        chunkSize = 50;
        totalImageCount = 0;
        totalPages = 0;

        // Load config
        pluginConfig = await getPluginConfig();
        console.log('[Image Deck] Plugin config loaded:', pluginConfig);

        // Inject dynamic styles
        injectDynamicStyles(pluginConfig);

        // Get context - STORE IT IN MODULE SCOPE
        const detectedContext = detectContext();
        storedContextInfo = detectedContext;
        contextInfo = detectedContext;

        console.log('[Image Deck] Context detected:', storedContextInfo);
        
        // Enhanced manual context creation for single galleries
        if ((!detectedContext || detectedContext.isGalleryListing) && window.location.pathname.startsWith('/galleries')) {
            const galleryIdMatch = window.location.pathname.match(/^\/galleries\/(\d+)/);
            if (galleryIdMatch) {
                const manualContext = {
                    type: 'galleries',
                    id: galleryIdMatch[1],
                    isSingleGallery: true
                };
                storedContextInfo = manualContext;
                contextInfo = manualContext;
                console.log('[Image Deck] Manual context override created:', manualContext);
            }
        }
        
        
        // Determine what content to show
        let imageResult;
        if (storedContextInfo) {
            console.log('[Image Deck] Using context-based fetching');
            imageResult = await fetchContextImages(storedContextInfo, 1, chunkSize);
        } else if (window.location.pathname.startsWith('/galleries')) {
            console.log('[Image Deck] Checking gallery page type');
            // Check if we're on a single gallery page
            const galleryIdMatch = window.location.pathname.match(/^\/galleries\/(\d+)/);
            if (galleryIdMatch) {
                console.log('[Image Deck] Single gallery page detected');
                // We're on a single gallery page, fetch images from this gallery
                const galleryContext = {
                    type: 'galleries',
                    id: galleryIdMatch[1],
                    isSingleGallery: true
                };
                imageResult = await fetchContextImages(galleryContext, 1, chunkSize);
            } else {
                console.log('[Image Deck] Gallery listing page detected');
                // On galleries listing page, get visible gallery covers
                imageResult = getVisibleGalleryCovers();
            }
        } else {
            console.log('[Image Deck] Falling back to visible images');
            // Default to visible images
            imageResult = getVisibleImages();
        }
        
        // Handle both return formats
        if (Array.isArray(imageResult)) {
            currentImages = imageResult;
            totalImageCount = imageResult.length;
            totalPages = 1;
        } else {
            currentImages = imageResult.images;
            totalImageCount = imageResult.totalCount;
            totalPages = imageResult.totalPages;
            currentChunkPage = imageResult.currentPage;
        }

        if (currentImages.length === 0) {
            console.warn('[Image Deck] No images found');
            
            // Provide more helpful error message
            let errorMessage = 'No images found to display in Image Deck.\n\n';
            
            if (storedContextInfo && storedContextInfo.isGalleryListing) {
                errorMessage += 'This appears to be a gallery listing page. ';
                errorMessage += 'Make sure you are on a page with visible gallery covers, ';
                errorMessage += 'or navigate to a specific gallery to view its images.';
            } else if (storedContextInfo && storedContextInfo.isSingleGallery) {
                errorMessage += 'This appears to be a single gallery page, but no images were found. ';
                errorMessage += 'The gallery might be empty or there might be a loading issue.';
            } else {
                errorMessage += 'No compatible content found on this page.';
            }
            
            alert(errorMessage);
            return;
        }
        console.log(`[Image Deck] Opening with ${currentImages.length} images (chunk 1 of ${totalPages || 1})`);

        // Create UI
        const container = createDeckUI();
        document.body.classList.add('image-deck-open');

        // Animate in with GPU acceleration
        requestAnimationFrame(() => {
            container.classList.add('active');
        });

        // Initialize Swiper
        currentSwiper = initSwiper(container, currentImages, pluginConfig, updateUI, savePosition, contextInfo);
		
		window.currentSwiperInstance = currentSwiper;
        
        // Restore position
        restorePosition();

        // Initial UI update
        updateUI(container);

        // Setup event handlers
        import('./controls.js').then(module => {
            module.setupEventHandlers(container);
        });
        
    } catch (error) {
        console.error('[Image Deck] Error opening deck:', error);
        alert('Error opening Image Deck: ' + error.message);
    }
}

// Create the image deck UI
function createDeckUI() {
    // Remove any existing deck
    const existing = document.querySelector('.image-deck-container');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.className = `image-deck-container${isMobile ? ' mobile-optimized' : ''}`;
    container.innerHTML = `
        <div class="image-deck-ambient"></div>
        <div class="image-deck-topbar">
            <div class="image-deck-counter"></div>
            <div class="image-deck-topbar-btns">
                <button class="image-deck-fullscreen" title="Toggle Fullscreen">⛶</button>
                <button class="image-deck-close">✕</button>
            </div>
        </div>
        <div class="image-deck-progress"></div>
        <div class="image-deck-loading"></div>
        <div class="image-deck-swiper swiper">
            <div class="swiper-wrapper"></div>
        </div>
        <div class="image-deck-controls">
            <button class="image-deck-control-btn" data-action="prev">◀</button>
            <button class="image-deck-control-btn" data-action="play">▶</button>
            <button class="image-deck-control-btn" data-action="next">▶</button>
            <button class="image-deck-control-btn image-deck-info-btn" data-action="info" title="Image Info (I)">ℹ</button>
            <button class="image-deck-control-btn" data-action="next-chunk" title="Load Next Chunk">⏭️</button>
        </div>
        <div class="image-deck-speed">Speed: ${pluginConfig.autoPlayInterval}ms</div>
        <div class="image-deck-metadata-modal">
            <div class="image-deck-metadata-content">
                <div class="image-deck-metadata-header">
                    <h3>Image Details</h3>
                    <button class="image-deck-metadata-close">✕</button>
                </div>
                <div class="image-deck-metadata-body"></div>
            </div>
        </div>
    `;

    document.body.appendChild(container);

    return container;
}

// Update UI elements - debounced to prevent flicker
let uiUpdatePending = false;
function updateUI(container) {
    if (!currentSwiper || uiUpdatePending) return;

    uiUpdatePending = true;
    requestAnimationFrame(() => {
        let current = 1;
        const displayedTotal = currentImages.length;
        const actualTotal = totalImageCount || displayedTotal;

        // Handle virtual slides differently
        if (currentSwiper.virtual) {
            // For virtual slides, we track the active slide index
            current = currentSwiper.activeIndex + 1;
            //console.log('[Image Deck] Virtual mode - Active index:', currentSwiper.activeIndex, 'Total slides:', currentSwiper.virtual.slides.length);
        } else {
            // Handle looped galleries properly
            if (currentSwiper.params.loop && contextInfo?.isSingleGallery) {
                // For looped galleries, get the real index
                const realIndex = currentSwiper.realIndex + 1;
                // Handle the case where we're at the cloned slides at the beginning/end
                if (realIndex === 0) {
                    current = displayedTotal; // Last slide
                } else if (realIndex > displayedTotal) {
                    current = 1; // First slide
                } else {
                    current = realIndex;
                }
            } else {
                current = currentSwiper.activeIndex + 1;
            }
        }

        // Update counter with chunk info
        if (pluginConfig.showCounter) {
            const counter = container.querySelector('.image-deck-counter');
            const chunkInfo = totalPages > 1 ? ` (chunk ${currentChunkPage}/${totalPages})` : '';
            if (counter) {
                counter.textContent = `${current} of ${actualTotal}${chunkInfo}`;
            }
        }

        // Update progress bar
        if (pluginConfig.showProgressBar) {
            const progress = container.querySelector('.image-deck-progress');
            if (progress) {
                const progressValue = actualTotal > 0 ? current / actualTotal : 0;
                progress.style.transform = `scaleX(${progressValue})`;
            }
        }

        uiUpdatePending = false;
    });
}

function checkAndLoadNextChunk() {
    if (!currentSwiper || isChunkLoading) return;
    
    const currentIndex = currentSwiper.activeIndex;
    const totalCurrentSlides = currentImages.length;
    
    // 1. Only trigger if we are in the last few slides
    // 2. Only trigger if there actually ARE more pages to fetch
    if (currentIndex >= totalCurrentSlides - 3 && currentChunkPage < totalPages) {
        console.log('[Image Deck] Auto-loading next chunk...');
        loadNextChunk(); 
    }
}

// Auto-play controls
export function startAutoPlay() {
    if (!currentSwiper || isAutoPlaying) return;

    isAutoPlaying = true;
    const playBtn = document.querySelector('[data-action="play"]');
    if (playBtn) {
        playBtn.innerHTML = '⏸';
        playBtn.classList.add('active');
    }

    autoPlayInterval = setInterval(() => {
        if (currentSwiper.isEnd) {
            stopAutoPlay();
        } else {
            currentSwiper.slideNext();
        }
    }, pluginConfig.autoPlayInterval);

    // Show speed indicator briefly
    const speedIndicator = document.querySelector('.image-deck-speed');
    if (speedIndicator) {
        speedIndicator.classList.add('visible');
        setTimeout(() => speedIndicator.classList.remove('visible'), 2000);
    }
}

export function stopAutoPlay() {
    if (!isAutoPlaying) return;

    isAutoPlaying = false;
    const playBtn = document.querySelector('[data-action="play"]');
    if (playBtn) {
        playBtn.innerHTML = '▶';
        playBtn.classList.remove('active');
    }

    if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
        autoPlayInterval = null;
    }
}

// Save/restore position
function savePosition() {
    if (!currentSwiper || !contextInfo) return;
    const key = `${PLUGIN_NAME}_position_${contextInfo.type}_${contextInfo.id}`;
    sessionStorage.setItem(key, currentSwiper.activeIndex.toString());
}

function restorePosition() {
    if (!currentSwiper || !contextInfo) return;
    const key = `${PLUGIN_NAME}_position_${contextInfo.type}_${contextInfo.id}`;
    const savedPosition = sessionStorage.getItem(key);
    if (savedPosition) {
        const index = parseInt(savedPosition);
        if (!isNaN(index) && index < (currentSwiper.slides.length || currentImages.length)) {
            currentSwiper.slideTo(index, 0);
        }
    }
}

// Load next chunk of images
// Add this to your module-level variables at the top of the file
let isChunkLoading = false; 

export async function loadNextChunk() {
    // 1. Guard: Prevent multiple simultaneous loads
    if (isChunkLoading) {
        console.log('[Image Deck] Load already in progress, skipping...');
        return;
    }

    // 2. Guard: Check if we've actually reached the end of available content
    if (currentChunkPage >= totalPages && totalPages !== 0) {
        console.log('[Image Deck] All chunks already loaded.');
        return;
    }

    console.log('[Image Deck] Starting to load next chunk...');
    isChunkLoading = true;

    // UI Feedback: Update the button and loading indicator
    const loadingIndicator = document.querySelector('.image-deck-loading');
    const nextChunkButton = document.querySelector('[data-action="next-chunk"]');
    
    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
        loadingIndicator.textContent = 'Loading next chunk...';
        loadingIndicator.style.backgroundColor = 'rgba(100, 100, 255, 0.4)';
    }

    if (nextChunkButton) {
        nextChunkButton.innerHTML = '🔄'; 
        nextChunkButton.disabled = true;
        nextChunkButton.style.opacity = '0.5';
    }

    try {
        const contextToUse = storedContextInfo || contextInfo || detectContext();
        if (!contextToUse) throw new Error('Could not detect context for fetching');

        const nextPage = currentChunkPage + 1;
        const result = await fetchContextImages(contextToUse, nextPage, chunkSize);

        if (!result || !result.images || result.images.length === 0) {
            if (loadingIndicator) loadingIndicator.textContent = 'No more images found';
            return;
        }

        // 3. Update Data State
        currentImages.push(...result.images);
        totalImageCount = result.totalCount || totalImageCount;
        totalPages = result.totalPages || totalPages;
        currentChunkPage = nextPage;

        // 4. Update Swiper (Crucial for Virtual Slides)
        if (currentSwiper && currentSwiper.virtual) {
            const newSlides = result.images.map(img => {
                const fullSrc = img.paths.image;
                return `<div class="swiper-zoom-container">
                            <img src="${fullSrc}" 
                                 alt="${img.title || ''}" 
                                 decoding="async" 
                                 loading="lazy" />
                        </div>`;
            });

            currentSwiper.virtual.slides.push(...newSlides);
            currentSwiper.virtual.update(true); 
        }

        // 5. Success UI Feedback
        if (loadingIndicator) {
            loadingIndicator.textContent = `✓ Loaded ${result.images.length} new images`;
            loadingIndicator.style.backgroundColor = 'rgba(100, 255, 100, 0.3)';
            setTimeout(() => { loadingIndicator.style.display = 'none'; }, 2000);
        }

        const container = document.querySelector('.image-deck-container');
        if (container) updateUI(container);

    } catch (error) {
        console.error('[Image Deck] Failed to load chunk:', error);
        if (loadingIndicator) {
            loadingIndicator.textContent = 'Error: ' + error.message;
            loadingIndicator.style.backgroundColor = 'rgba(255, 100, 100, 0.4)';
        }
    } finally {
        // 6. Release the lock and restore UI
        isChunkLoading = false;
        if (nextChunkButton) {
            nextChunkButton.innerHTML = '⏭️';
            nextChunkButton.disabled = false;
            nextChunkButton.style.opacity = '1';
        }
    }
}

// Close the deck
export function closeDeck() {
    stopAutoPlay();

    const container = document.querySelector('.image-deck-container');
    if (container) {
        container.classList.remove('active');
        setTimeout(() => {
            container.remove();
            document.body.classList.remove('image-deck-open');
        }, 300);
    }

    if (currentSwiper) {
        currentSwiper.destroy(true, true);
        currentSwiper = null;
    }

    currentImages = [];
    contextInfo = null;
    loadingQueue = [];
}
