import { getPluginConfig, injectDynamicStyles, PLUGIN_NAME } from './config.js';
import { detectContext, fetchContextImages, getVisibleImages, getVisibleGalleryCovers } from './context.js';
import { setCurrentSwiper } from './metadata.js';
import { initSwiper } from './swiper.js';
import { isMobile } from './utils.js';
import { GALLERY_ICON_SVG } from './constants.js';
import { parseUrlFilters } from './filters.js'; 

let chunkLoadTimeout = null;
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

// Performance monitoring for mobile
let performanceMonitor = null;
let frameDropCount = 0;

// Cleanup functions array
let cleanupFunctions = [];

function startPerformanceMonitoring() {
    if (!isMobile) return; // Only monitor on mobile
    
    let lastTime = performance.now();
    const fpsThreshold = 30; // Target minimum FPS
    
    performanceMonitor = setInterval(() => {
        const currentTime = performance.now();
        const deltaTime = currentTime - lastTime;
        const fps = 1000 / deltaTime;
        
        if (fps < fpsThreshold) {
            frameDropCount++;
            if (frameDropCount > 5) {
                reduceVisualEffects();
                frameDropCount = 0;
            }
        } else {
            frameDropCount = Math.max(0, frameDropCount - 0.1);
        }
        
        lastTime = currentTime;
    }, 1000);
}

function reduceVisualEffects() {
    const styles = document.getElementById('image-deck-dynamic-styles');
    if (styles) {
        styles.textContent += `
            .swiper-slide img {
                filter: none !important; /* Remove glow effects */
            }
            .image-deck-ambient {
                display: none !important; /* Hide ambient background */
            }
        `;
    }
}

function stopPerformanceMonitoring() {
    if (performanceMonitor) {
        clearInterval(performanceMonitor);
        performanceMonitor = null;
    }
}

function getCurrentFilterTags() {
    const tagFilter = sessionStorage.getItem('galleryTagFilter');
    if (tagFilter) {
        try {
            const filterObj = JSON.parse(tagFilter);
            return {
                included: filterObj.included || [],
                excluded: filterObj.excluded || []
            };
        } catch (e) {
            console.error('Error parsing tag filter:', e);
            return { included: [], excluded: [] };
        }
    }
    return { included: [], excluded: [] };
}

// Function to update content with filter in real-time

async function updateDeckContentWithFilter() {
    console.log('[Image Deck] Updating content with filter');
    
    try {
        // Reset pagination
        currentChunkPage = 1;
        
        // Always get fresh context that includes current filters
        const contextToUse = detectContext();
        if (!contextToUse) {
            console.error('[Image Deck] Could not detect context for fetching');
            return;
        }
        
        console.log('[Image Deck] Using context for filter update:', contextToUse);
        
        // Fetch filtered content directly from GraphQL
        const result = await fetchContextImages(contextToUse, 1, chunkSize);
        
        if (result && result.images) {
            // Update current images
            currentImages = result.images;
            totalImageCount = result.totalCount || 0;
            totalPages = result.totalPages || 1;
			window.currentImages = currentImages;
            
            // Update Swiper with new content
            if (currentSwiper && currentSwiper.virtual) {
                // Generate new slides using the same template function
                const newSlides = currentImages.map(img => {
                    return getSlideTemplateImpl(img, contextToUse, false);
                });

                // Update virtual slides
                currentSwiper.virtual.slides = newSlides;
                currentSwiper.virtual.update(true);
                
                // Force swiper to rebuild and go to first slide
                currentSwiper.slideTo(0, 0, false); // Instant transition
                
                // Multiple update attempts to ensure proper rendering
                setTimeout(() => {
                    if (currentSwiper) {
                        currentSwiper.update();
                    }
                }, 50);
                
                setTimeout(() => {
                    if (currentSwiper) {
                        currentSwiper.update();
                    }
                }, 100);
            }
            
            // Update UI elements
            const container = document.querySelector('.image-deck-container');
            if (container) {
                updateUI(container);
                await updateFilterDisplayInUI(); // Update filter display
            }
            
            console.log('[Image Deck] Content updated with filter, showing', currentImages.length, 'items');
        }
    } catch (error) {
        console.error('[Image Deck] Error updating content with filter:', error);
    }
}

async function restoreFilterDisplayOnOpen(container) {
    const currentTags = getCurrentFilterTags();
    
    if (currentTags.included.length > 0 || currentTags.excluded.length > 0) {
        // Get tag names
        const allTagIds = [...currentTags.included, ...currentTags.excluded];
        const tagNames = await getTagNames(allTagIds);
        
        const filterDisplay = document.createElement('div');
        filterDisplay.className = 'image-deck-current-filters';
        filterDisplay.style.cssText = 'position: absolute; top: 60px; left: 20px; right: 20px; z-index: 10; display: flex; flex-wrap: wrap; gap: 5px;';
        
        let filterHtml = '<span style="color: #ccc; font-size: 12px; background: rgba(0,0,0,0.5); padding: 2px 8px; border-radius: 10px;">FILTERED BY:</span>';
        
        // Add included tags
        filterHtml += currentTags.included.map(tagId => {
            const tagName = tagNames[tagId] || `Tag:${tagId}`;
            return `
                <span class="filter-tag-display" data-tag-id="${tagId}" style="color: white; font-size: 12px; background: rgba(46, 204, 113, 0.7); padding: 2px 8px; border-radius: 10px; display: flex; align-items: center;">
                    ✅ ${tagName}
                    <button class="remove-filter-tag" data-tag-id="${tagId}" style="background: none; border: none; color: white; margin-left: 5px; cursor: pointer; font-size: 14px;">×</button>
                </span>`;
        }).join('');
        
        // Add excluded tags
        filterHtml += currentTags.excluded.map(tagId => {
            const tagName = tagNames[tagId] || `Tag:${tagId}`;
            return `
                <span class="filter-tag-display" data-tag-id="${tagId}" style="color: white; font-size: 12px; background: rgba(231, 76, 60, 0.7); padding: 2px 8px; border-radius: 10px; display: flex; align-items: center;">
                    ❌ ${tagName}
                    <button class="remove-filter-tag" data-tag-id="${tagId}" style="background: none; border: none; color: white; margin-left: 5px; cursor: pointer; font-size: 14px;">×</button>
                </span>`;
        }).join('');
        
        filterDisplay.innerHTML = filterHtml;
        container.insertBefore(filterDisplay, container.querySelector('.image-deck-progress'));
        
        // Add event listeners to remove buttons
        setTimeout(() => {
            filterDisplay.querySelectorAll('.remove-filter-tag').forEach(button => {
                button.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const tagId = button.dataset.tagId;
                    const currentTags = getCurrentFilterTags();
                    
                    // Remove from either included or excluded list
                    let newIncluded = currentTags.included.filter(id => id !== tagId);
                    let newExcluded = currentTags.excluded.filter(id => id !== tagId);
                    
                    if (newIncluded.length > 0 || newExcluded.length > 0) {
                        const filterObj = {
                            included: newIncluded,
                            excluded: newExcluded
                        };
                        sessionStorage.setItem('galleryTagFilter', JSON.stringify(filterObj));
                    } else {
                        sessionStorage.removeItem('galleryTagFilter');
                    }
                    
                    window.dispatchEvent(new CustomEvent('galleryTagFilterChanged'));
                });
            });
        }, 0);
    }
}

async function forceRefreshGalleryCovers() {
    console.log('[Image Deck] Force refreshing gallery covers');
    
    try {
        // Get fresh context with current filters BUT ensure gallery mode is preserved
        let freshContext = detectContext();
        
        // Fix: Ensure we stay in gallery mode when we're supposed to be in gallery mode
        if (window.location.pathname.startsWith('/galleries') || 
            sessionStorage.getItem('imageDeckMode') === 'gallery' ||
            (storedContextInfo && storedContextInfo.type === 'galleries')) {
            
            if (!freshContext || freshContext.type !== 'galleries') {
                // Force gallery context
                const urlFilters = parseUrlFilters(window.location.search);
                
                // Apply tag filters from session storage
                const tagFilter = sessionStorage.getItem('galleryTagFilter');
                if (tagFilter) {
                    try {
                        const filterObj = JSON.parse(tagFilter);
                        if ((filterObj.included && filterObj.included.length > 0) || 
                            (filterObj.excluded && filterObj.excluded.length > 0)) {
                            
                            const finalFilters = urlFilters || {};
                            
                            // Add included tags
                            if (filterObj.included.length > 0) {
                                finalFilters.tags = {
                                    value: filterObj.included,
                                    modifier: "INCLUDES"
                                };
                            }
                            // Add excluded tags
                            if (filterObj.excluded.length > 0) {
                                if (finalFilters.tags) {
                                    finalFilters.tags.excluded = filterObj.excluded;
                                } else {
                                    finalFilters.tags = {
                                        value: [],
                                        modifier: "INCLUDES",
                                        excluded: filterObj.excluded
                                    };
                                }
                            }
                            
                            freshContext = {
                                type: 'galleries',
                                isGalleryListing: true,
                                filter: finalFilters,
                                hash: window.location.hash
                            };
                        }
                    } catch (e) {
                        console.error('[Image Deck] Error applying stored tag filter:', e);
                    }
                } else if (urlFilters) {
                    freshContext = {
                        type: 'galleries',
                        isGalleryListing: true,
                        filter: urlFilters,
                        hash: window.location.hash
                    };
                } else {
                    freshContext = {
                        type: 'galleries',
                        isGalleryListing: true,
                        filter: {},
                        hash: window.location.hash
                    };
                }
            }
        }
        
        console.log('[Image Deck] Fresh context:', freshContext);
        
        if (!freshContext) {
            console.error('[Image Deck] Could not detect context for refresh');
            return;
        }
        
        // Reset pagination
        currentChunkPage = 1;
        
        // Fetch fresh content
        const result = await fetchContextImages(freshContext, 1, chunkSize);
        console.log('[Image Deck] Fresh content result:', result);
        
        if (result && result.images) {
            // Update the global state
            currentImages = result.images;
			window.currentImages = currentImages;
            totalImageCount = result.totalCount || 0;
            totalPages = result.totalPages || 1;
            
            // Rebuild the swiper if it exists
            if (currentSwiper) {
                console.log('[Image Deck] Rebuilding Swiper with fresh content');
                
                // Get the container
                const container = document.querySelector('.image-deck-container');
                
                if (container) {
                    // Destroy existing swiper properly
                    if (currentSwiper && typeof currentSwiper.destroy === 'function') {
                        currentSwiper.destroy(true, true);
                    }
                    currentSwiper = null;
                    
                    // Clear the swiper wrapper to ensure clean slate
                    const swiperEl = container.querySelector('.swiper');
                    if (swiperEl) {
                        const wrapper = swiperEl.querySelector('.swiper-wrapper');
                        if (wrapper) {
                            wrapper.innerHTML = '';
                        }
                    }
                    
                    // Reinitialize swiper using the existing initSwiper function
                    currentSwiper = initSwiper(
                        container, 
                        currentImages, 
                        pluginConfig, 
                        () => {
                            updateUI(container);
                            checkAndLoadNextChunk(); 
                        }, 
                        savePosition, 
                        freshContext
                    );
                    
                    // Set global references
                    window.currentSwiperInstance = currentSwiper;
                    setCurrentSwiper(currentSwiper);
                    
                    // Force proper initialization and centering
                    setTimeout(() => {
                        if (currentSwiper) {
                            currentSwiper.update();
                            currentSwiper.slideTo(0, 0, false);
                        }
                    }, 50);
                    
                    // Additional update for good measure
                    setTimeout(() => {
                        if (currentSwiper) {
                            currentSwiper.update();
                        }
                    }, 100);
                    
                    // Update UI
                    updateUI(container);
                    await updateFilterDisplayInUI();
                    
                    console.log('[Image Deck] Swiper rebuilt with', currentImages.length, 'items');
                }
            }
        }
    } catch (error) {
        console.error('[Image Deck] Error force refreshing gallery covers:', error);
    }
}

function getSlideTemplateImpl(img, contextInfo, isEager = false) {
    const fullSrc = img.paths.image;
    const isGallery = img.url && !contextInfo?.isSingleGallery;
    const loading = isEager ? 'eager' : 'lazy';
    const title = img.title || 'Untitled';

    if (isGallery) {
        const imageCountDisplay = img.image_count !== undefined ? 
            `${GALLERY_ICON_SVG}: ${img.image_count}` : '';
        
        let performerDisplay = '';
        if (img.performers && img.performers.length > 0) {
            const performerNames = img.performers.map(p => p.name).join(', ');
            performerDisplay = `<div class="gallery-performers" style="margin-top: 5px; font-size: 18px; color: #ccc;">${performerNames}</div>`;
        }
        
        return `
            <div class="swiper-zoom-container" data-type="gallery" data-url="${img.url}">
                <div class="gallery-cover-container">
                    <div class="gallery-cover-title" title="${title}">${title}</div>
                    ${imageCountDisplay ? `<div class="gallery-image-count" style="font-size: 18px; color: #ccc; margin-top: 3px;">${imageCountDisplay}</div>` : ''}
                    <a href="${img.url}" target="_blank" class="gallery-cover-link">
                        <img src="${fullSrc}" alt="${title}" decoding="async" loading="${loading}" />
                    </a>
                    ${performerDisplay}
                </div>
            </div>`;
    }

    return `
        <div class="swiper-zoom-container" data-type="image">
            <img src="${fullSrc}" alt="${title}" decoding="async" loading="${loading}" 
                 style="max-width: 100%; height: auto; display: block; margin: 0 auto;" />
        </div>`;
}

export async function openDeck(targetImageId = null) {
    console.log('[Image Deck] Opening deck...', targetImageId);
    console.log('[Image Deck] Current URL:', window.location.pathname);
    
    try {
        currentChunkPage = 1;
        chunkSize = 50;
        totalImageCount = 0;
        totalPages = 0;

        // Load config
        pluginConfig = await getPluginConfig();
        console.log('[Image Deck] Plugin config loaded:', pluginConfig);

        injectDynamicStyles(pluginConfig);

        // 1. Context Detection Logic
        let detectedContext = detectContext();

        // Check if we have a stored mode preference
        const storedMode = sessionStorage.getItem('imageDeckMode');
        
        // Override context based on stored mode preference ONLY if not in performer context
        if (!detectedContext?.isPerformerContext) {
            if (storedMode === 'image') {
                detectedContext = {
                    type: 'images',
                    isGeneralListing: true,
                    filter: {},
                    hash: window.location.hash
                };
            } else if (storedMode === 'gallery') {
                detectedContext = {
                    type: 'galleries',
                    isGalleryListing: true,
                    filter: {},
                    hash: window.location.hash
                };
            }
        }

        const path = window.location.pathname;
        // Enhanced performer context detection
        if (path.match(/^\/performers\/\d+/) && !detectedContext?.isPerformerContext) {
            const performerMatch = path.match(/^\/performers\/(\d+)/);
            if (performerMatch) {
                const performerId = performerMatch[1];
                
                // Check if we're on galleries or images sub-path
                let isImagesTab = path.includes('/images') || 
                                 window.location.hash.includes('images') ||
                                 document.querySelector('.nav-tabs .active')?.textContent?.includes('Images');
                let isGalleriesTab = path.includes('/galleries') || 
                                    window.location.hash.includes('galleries') ||
                                    document.querySelector('.nav-tabs .active')?.textContent?.includes('Galleries');
                
                // Default behavior - if no explicit tab, check what's shown
                if (!path.includes('/images') && !path.includes('/galleries')) {
                    // This is the main performer page - determine default tab
                    isImagesTab = true; // Default to images
                }
                
                const type = isGalleriesTab ? 'galleries' : 'images';
                
                detectedContext = {
                    type: type,
                    id: performerId,
                    performerId: performerId,
                    isPerformerContext: true,
                    filter: {
                        performers: { value: [performerId], modifier: "INCLUDES" },
                        sortBy: 'created_at',
                        sortDir: 'desc'
                    }
                };
                
                // Parse URL parameters for sorting
                const params = new URLSearchParams(window.location.search);
                if (params.has('sortby')) {
                    detectedContext.filter.sortBy = params.get('sortby');
                }
                if (params.has('sortdir')) {
                    detectedContext.filter.sortDir = params.get('sortdir');
                }
            }
        }

        if (!detectedContext) {
            console.log('[Image Deck] No context detected, defaulting to galleries');
            detectedContext = {
                type: 'galleries',
                isGalleryListing: true,
                filter: {
                    sortBy: 'created_at',
                    sortDir: 'desc'
                }
            };
        }

        if (window.location.pathname === '/galleries' && !detectedContext?.isGalleryListing) {
            detectedContext = {
                type: 'galleries',
                isGalleryListing: true,
                filter: parseUrlFilters(window.location.search) 
            };
        }

        // === ADD THIS FIX: Apply stored gallery tag filters to context ===
        const tagFilter = sessionStorage.getItem('galleryTagFilter');
        if (tagFilter && detectedContext.type === 'galleries' && (detectedContext.isGalleryListing || !detectedContext.id)) {
            try {
                const filterObj = JSON.parse(tagFilter);
                if ((filterObj.included && filterObj.included.length > 0) || 
                    (filterObj.excluded && filterObj.excluded.length > 0)) {
                    
                    // Ensure filter object exists
                    if (!detectedContext.filter) {
                        detectedContext.filter = {};
                    }
                    
                    // Apply included tags
                    if (filterObj.included.length > 0) {
                        detectedContext.filter.tags = {
                            value: filterObj.included,
                            modifier: "INCLUDES"
                        };
                    }
                    
                    // Apply excluded tags
                    if (filterObj.excluded.length > 0) {
                        if (detectedContext.filter.tags) {
                            detectedContext.filter.tags.excluded = filterObj.excluded;
                        } else {
                            detectedContext.filter.tags = {
                                value: [],
                                modifier: "INCLUDES",
                                excluded: filterObj.excluded
                            };
                        }
                    }
                }
            } catch (e) {
                console.error('[Image Deck] Error applying stored tag filter:', e);
            }
        }

        storedContextInfo = detectedContext;
        contextInfo = detectedContext;
        console.log('[Image Deck] Context assigned:', contextInfo);

        // 2. Determine what content to show
        let imageResult;

        const isListContext = contextInfo && (
            contextInfo.isSingleGallery || 
            contextInfo.isGalleryListing || 
            contextInfo.type === 'images' || 
            contextInfo.isFilteredView ||
            contextInfo.isPerformerContext || 
            window.location.pathname.startsWith('/images') 
        );

        if (targetImageId) {
            console.log('[Image Deck] Using visible images for target navigation');
            imageResult = getVisibleImages();
        } else if (isListContext) {
            console.log('[Image Deck] Using context-based fetching for page 1');
            imageResult = await fetchContextImages(contextInfo, 1, chunkSize);
        } else {
            console.log('[Image Deck] Falling back to visible images');
            imageResult = getVisibleImages();
        }
        
        // 3. Handle data results
        if (Array.isArray(imageResult)) {
            currentImages = imageResult;
            totalImageCount = imageResult.length;
            totalPages = 1;
            currentChunkPage = 1;
        } else if (imageResult) {
            currentImages = imageResult.images || [];
            totalImageCount = imageResult.totalCount || 0;
            totalPages = imageResult.totalPages || 1;
            currentChunkPage = imageResult.currentPage || 1;
        }

        console.log(`[Image Deck] Opening with ${currentImages.length} items (chunk 1 of ${totalPages || 1})`);

        // 4. Create UI
        const container = await createDeckUI(); // Make sure to await this
        document.body.classList.add('image-deck-open');

        // Add container to DOM first
        document.body.appendChild(container);

        // Wait for next frame to ensure DOM is ready
        await new Promise(resolve => requestAnimationFrame(resolve));

        requestAnimationFrame(() => {
            container.classList.add('active');
        });

        // 5. Initialize Swiper 
        currentSwiper = initSwiper(
            container, 
            currentImages, 
            pluginConfig, 
            () => {
                updateUI(container);
                checkAndLoadNextChunk(); 
            }, 
            savePosition, 
            contextInfo
        );
        
        window.currentSwiperInstance = currentSwiper;
        window.currentImages = currentImages;
        setCurrentSwiper(currentSwiper);
        
        if (currentSwiper) {
            currentSwiper.on('zoomChange', (swiper, scale) => {
                const topBar = container.querySelector('.image-deck-topbar');
                const controls = container.querySelector('.image-deck-controls');
                const speedIndicator = container.querySelector('.image-deck-speed');
                
                if (scale > 1) {
                    // Fade out UI elements when zoomed in
                    if (topBar) topBar.style.opacity = '0';
                    if (controls) controls.style.opacity = '0';
                    if (speedIndicator) speedIndicator.style.opacity = '0';
                } else {
                    // Fade in UI elements when zoomed out
                    if (topBar) topBar.style.opacity = '1';
                    if (controls) controls.style.opacity = '1';
                    if (speedIndicator) speedIndicator.style.opacity = '1';
                }
            });
        }

        if (targetImageId) {
            const targetIndex = currentImages.findIndex(img => img.id === targetImageId);
            if (targetIndex !== -1) {
                console.log(`[Image Deck] Navigating to target image at index ${targetIndex}`);
                setTimeout(() => {
                    if (currentSwiper) {
                        currentSwiper.slideTo(targetIndex, 0);
                        updateUI(container);
                    }
                }, 100);
            } else {
                console.warn(`[Image Deck] Target image ${targetImageId} not found in current images`);
                restorePosition();
            }
        } else {
            restorePosition();
        }

        // Initial UI update
        updateUI(container);
		await restoreFilterDisplayOnOpen(container);

        // Setup event handlers
        import('./controls.js').then(module => {
            module.setupEventHandlers(container, {
                closeDeck,
                startAutoPlay,
                stopAutoPlay,
                loadNextChunk
            });
        });
        
        // Add listener for filter updates
		const filterUpdateListener = (e) => {
			console.log('[Image Deck] Received updateDeckContent event:', e.detail);
			
			// Force a complete refresh of gallery covers
			setTimeout(() => {
				forceRefreshGalleryCovers();
			}, 100); // Small delay to ensure session storage is updated
		};

		window.addEventListener('updateDeckContent', filterUpdateListener);

		// Store cleanup function
		cleanupFunctions.push(() => {
			window.removeEventListener('updateDeckContent', filterUpdateListener);
		});
        
        startPerformanceMonitoring();
        
    } catch (error) {
        console.error('[Image Deck] Error opening deck:', error);
        alert('Error opening Image Deck: ' + error.message);
    }
}

async function getTagNames(tagIds) {
    if (!tagIds || tagIds.length === 0) return {};
    
    try {
        // For each tag ID, make a separate findTag query
        const tagPromises = tagIds.map(async (tagId) => {
            const query = `query FindTag($id: ID!) {
                findTag(id: $id) {
                    id
                    name
                }
            }`;
            
            const response = await fetch('/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    query, 
                    variables: { id: tagId } 
                })
            });
            
            const data = await response.json();
            return data?.data?.findTag;
        });
        
        const tagResults = await Promise.all(tagPromises);
        const tagMap = {};
        
        tagResults.forEach(tag => {
            if (tag) {
                tagMap[tag.id] = tag.name;
            }
        });
        
        return tagMap;
    } catch (error) {
        console.error('[Image Deck] Error fetching tag names:', error);
        return {};
    }
}

async function createDeckUI() {
    const existing = document.querySelector('.image-deck-container');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.className = `image-deck-container${isMobile ? ' mobile-optimized' : ''}`;

    if (isMobile) {
        container.classList.add('mobile-performance-mode');
    }
    
    // Get current filter tags for display
    const currentTags = getCurrentFilterTags();
    let filterDisplay = '';
    
    if (currentTags.included.length > 0 || currentTags.excluded.length > 0) {
        // ... (rest of filter display code unchanged)
    }

    container.innerHTML = `
        <div class="image-deck-ambient"></div>
        <div class="image-deck-topbar">
            <div class="image-deck-counter"></div>
            <div class="image-deck-topbar-btns">
                <button class="image-deck-fullscreen" title="Toggle Fullscreen">⛶</button>
                <button class="image-deck-close">✕</button>
            </div>
        </div>
        ${filterDisplay}
        <div class="image-deck-progress"></div>
        <div class="image-deck-loading"></div>
        <div class="image-deck-swiper swiper">
            <div class="swiper-wrapper"></div>
        </div>
        <div class="image-deck-controls-wrapper">
            <div class="image-deck-zoom-controls">
                <button class="image-deck-control-btn" data-action="zoom-in" title="Zoom In (+)">➕</button>
                <button class="image-deck-control-btn" data-action="zoom-out" title="Zoom Out (-)">➖</button>
            </div>
            <div class="image-deck-navigation-controls">
                <button class="image-deck-control-btn" data-action="prev">◀</button>
                <button class="image-deck-control-btn" data-action="play">▶</button>
                <button class="image-deck-control-btn" data-action="next">▶</button>
                <button class="image-deck-control-btn image-deck-info-btn" data-action="info" title="Image Info (I)">ℹ</button>
                <button class="image-deck-control-btn" data-action="next-chunk" title="Load Next Chunk">⏭️</button>
                <!-- Gallery filter button only appears in deck viewer -->
                <button class="image-deck-control-btn gallery-filter-btn" title="Filter Galleries by Tag">☰</button>
            </div>
        </div>
        <div class="image-deck-speed">Speed: ${pluginConfig?.autoPlayInterval || 3000}ms</div>
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

    // Add event listeners to remove buttons AFTER the HTML is set
    if (currentTags.included.length > 0 || currentTags.excluded.length > 0) {
        // We'll add these event listeners after the container is actually in the DOM
        setTimeout(() => {
            const removeButtons = container.querySelectorAll('.remove-filter-tag');
            removeButtons.forEach(button => {
                button.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const tagId = button.dataset.tagId;
                    const currentTags = getCurrentFilterTags();
                    
                    // Remove from either included or excluded list
                    let newIncluded = currentTags.included.filter(id => id !== tagId);
                    let newExcluded = currentTags.excluded.filter(id => id !== tagId);
                    
                    if (newIncluded.length > 0 || newExcluded.length > 0) {
                        const filterObj = {
                            included: newIncluded,
                            excluded: newExcluded
                        };
                        sessionStorage.setItem('galleryTagFilter', JSON.stringify(filterObj));
                    } else {
                        sessionStorage.removeItem('galleryTagFilter');
                    }
                    
                    window.dispatchEvent(new CustomEvent('galleryTagFilterChanged'));
                });
            });
        }, 0);
    }

    return container;
}

async function updateFilterDisplayInUI() {
    const container = document.querySelector('.image-deck-container');
    if (!container) return;
    
    // Remove existing filter display
    const existingFilterDisplay = container.querySelector('.image-deck-current-filters');
    if (existingFilterDisplay) {
        existingFilterDisplay.remove();
    }
    
    // Add updated filter display
    const currentTags = getCurrentFilterTags();
    if (currentTags.included.length > 0 || currentTags.excluded.length > 0) {
        const allTagIds = [...currentTags.included, ...currentTags.excluded];
        const tagNames = await getTagNames(allTagIds);
        const filterDisplay = document.createElement('div');
        filterDisplay.className = 'image-deck-current-filters';
        filterDisplay.style.cssText = 'position: absolute; top: 60px; left: 20px; right: 20px; z-index: 10; display: flex; flex-wrap: wrap; gap: 5px;';
        
        let filterHtml = '<span style="color: #ccc; font-size: 12px; background: rgba(0,0,0,0.5); padding: 2px 8px; border-radius: 10px;">FILTERED BY:</span>';
        
        // Add included tags with ✅ prefix and green color
        filterHtml += currentTags.included.map(tagId => {
            const tagName = tagNames[tagId] || `Tag:${tagId}`;
            return `
                <span class="filter-tag-display" data-tag-id="${tagId}" style="color: white; font-size: 12px; background: rgba(46, 204, 113, 0.7); padding: 2px 8px; border-radius: 10px; display: flex; align-items: center;">
                    ✅ ${tagName}
                    <button class="remove-filter-tag" data-tag-id="${tagId}" style="background: none; border: none; color: white; margin-left: 5px; cursor: pointer; font-size: 14px;">×</button>
                </span>`;
        }).join('');
        
        // Add excluded tags with ❌ prefix and red color
        filterHtml += currentTags.excluded.map(tagId => {
            const tagName = tagNames[tagId] || `Tag:${tagId}`;
            return `
                <span class="filter-tag-display" data-tag-id="${tagId}" style="color: white; font-size: 12px; background: rgba(231, 76, 60, 0.7); padding: 2px 8px; border-radius: 10px; display: flex; align-items: center;">
                    ❌ ${tagName}
                    <button class="remove-filter-tag" data-tag-id="${tagId}" style="background: none; border: none; color: white; margin-left: 5px; cursor: pointer; font-size: 14px;">×</button>
                </span>`;
        }).join('');
        
        filterDisplay.innerHTML = filterHtml;
        container.insertBefore(filterDisplay, container.querySelector('.image-deck-progress'));
        
        // Add event listeners to new remove buttons
        setTimeout(() => {
            filterDisplay.querySelectorAll('.remove-filter-tag').forEach(button => {
                button.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const tagId = button.dataset.tagId;
                    const currentTags = getCurrentFilterTags();
                    
                    // Remove from either included or excluded list
                    let newIncluded = currentTags.included.filter(id => id !== tagId);
                    let newExcluded = currentTags.excluded.filter(id => id !== tagId);
                    
                    if (newIncluded.length > 0 || newExcluded.length > 0) {
                        const filterObj = {
                            included: newIncluded,
                            excluded: newExcluded
                        };
                        sessionStorage.setItem('galleryTagFilter', JSON.stringify(filterObj));
                    } else {
                        sessionStorage.removeItem('galleryTagFilter');
                    }
                    
                    window.dispatchEvent(new CustomEvent('galleryTagFilterChanged'));
                });
            });
        }, 0);
    }
}


let uiUpdatePending = false;

function updateUI(container) {
    if (!currentSwiper || uiUpdatePending) return;

    uiUpdatePending = true;
    requestAnimationFrame(() => {
        // Initialize mode indicator if not already present
        let modeIndicator = container.querySelector('.mode-indicator');
        if (!modeIndicator) {
            const topBar = container.querySelector('.image-deck-topbar');
            if (topBar) {
                modeIndicator = document.createElement('div');
                modeIndicator.className = 'mode-indicator';
                modeIndicator.style.cssText = `
                    position: absolute;
                    left: 20px;
                    top: 40px;  /* Position below the counter */
                    font-size: 14px;
                    font-weight: bold;
                    z-index: 11;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    cursor: pointer;
                `;
                
                topBar.appendChild(modeIndicator);
                
                // Add click handler to toggle modes
                modeIndicator.addEventListener('click', async () => {
                    const currentMode = contextInfo?.type === 'galleries' ? 'gallery' : 'image';
                    const newMode = currentMode === 'gallery' ? 'image' : 'gallery';
                    
                    // Store the new mode preference
                    sessionStorage.setItem('imageDeckMode', newMode);
                    
                    // For performer contexts, we need to navigate appropriately
                    if (contextInfo?.isPerformerContext && contextInfo.performerId) {
                        // Build the appropriate URL for the new mode
                        let newPath = `/performers/${contextInfo.performerId}`;
                        if (newMode === 'gallery') {
                            newPath += '/galleries';
                        } else {
                            newPath += '/images';
                        }
                        
                        // Update the browser URL without reloading
                        history.pushState({}, '', newPath);
                    }
                    
                    // Reload deck with new mode
                    import('./deck.js').then(module => {
                        module.closeDeck();
                        // Small delay to ensure cleanup
                        setTimeout(() => {
                            module.openDeck();
                        }, 100);
                    });
                });
            }
        }
        
        // Update mode display - only show one mode at a time
        if (modeIndicator) {
            const isGalleryMode = contextInfo?.type === 'galleries';
            modeIndicator.innerHTML = isGalleryMode ? 
                '🖼️ Gallery Mode Enabled 🖼️' : 
                '📷 Image Mode Enabled 📷';
        }

        // Rest of your updateUI code remains the same...
        let current = 1;
        const displayedTotal = currentImages.length;
        const actualTotal = totalImageCount || displayedTotal;

        // Handle virtual slides differently
        if (currentSwiper.virtual) {
            // For virtual slides, we track the active slide index
            current = currentSwiper.activeIndex + 1;
        } else {
            // Handle looped galleries properly
            if (currentSwiper.params.loop && contextInfo?.isSingleGallery) {
                // For looped galleries, get the real index
                const realIndex = currentSwiper.realIndex + 1;

                if (realIndex === 0) {
                    current = displayedTotal; // Last slide
                } else if (realIndex > displayedTotal) {
                    current = 1; 
                } else {
                    current = realIndex;
                }
            } else {
                current = currentSwiper.activeIndex + 1;
            }
        }

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

let isChunkLoading = false; 

export async function loadNextChunk(container = null) {
    // Clear any pending timeouts to prevent race conditions
    if (chunkLoadTimeout) {
        clearTimeout(chunkLoadTimeout);
    }
    
    // Debounce the chunk loading
    chunkLoadTimeout = setTimeout(async () => {
        // 1. Guard: Prevent multiple simultaneous loads
        if (isChunkLoading) {
            console.log('[Image Deck] Load already in progress, skipping...');
            return;
        }

        // 2. Guard: Check if we've reached the end
        if (currentChunkPage >= totalPages && totalPages !== 0) {
            console.log('[Image Deck] All chunks already loaded.');
            const loadingIndicator = document.querySelector('.image-deck-loading');
            if (loadingIndicator) {
                loadingIndicator.textContent = 'All items loaded';
                setTimeout(() => { if (loadingIndicator) loadingIndicator.style.display = 'none'; }, 2000);
            }
            return;
        }

        isChunkLoading = true;

        // UI Feedback
        const loadingIndicator = document.querySelector('.image-deck-loading');
        const nextChunkButton = document.querySelector('[data-action="next-chunk"]');
        
        if (nextChunkButton) {
            nextChunkButton.disabled = true;
            nextChunkButton.style.opacity = '0.5';
            nextChunkButton.innerHTML = '🔄';
        }

        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
            loadingIndicator.textContent = `Loading chunk ${currentChunkPage + 1}...`;
        }

        try {
            const contextToUse = storedContextInfo || contextInfo || detectContext();
            if (!contextToUse) throw new Error('Could not detect context for fetching');

            const nextPage = currentChunkPage + 1;
            const result = await fetchContextImages(contextToUse, nextPage, chunkSize);
            
            if (!result || !result.images || result.images.length === 0) {
                if (loadingIndicator) loadingIndicator.textContent = 'No more items found';
                setTimeout(() => { if (loadingIndicator) loadingIndicator.style.display = 'none'; }, 2000);
                return;
            }

            // 3. Update Data State
            currentImages.push(...result.images);
            currentChunkPage = nextPage;
            totalPages = result.totalPages || totalPages;

            // 4. Update UI (Swiper OR Gallery)
            if (currentSwiper && currentSwiper.virtual) {
                // Re-generate ALL slides to ensure formatting consistency across the whole deck
                const allSlides = currentImages.map(img => {
                    const fullSrc = img.paths.image;
                    const isGallery = img.url && !contextInfo?.isSingleGallery;
                    const title = img.title || 'Untitled';
                    const loading = 'lazy'; // Consistent with getSlideTemplate

                    if (isGallery) {
                        // Use the same template structure as getSlideTemplate
                        const imageCountDisplay = img.image_count !== undefined ? 
                            `${GALLERY_ICON_SVG}: ${img.image_count}` : '';
                        
                        let performerDisplay = '';
                        if (img.performers && img.performers.length > 0) {
                            const performerNames = img.performers.map(p => p.name).join(', ');
                            performerDisplay = `<div class="gallery-performers" style="margin-top: 5px; font-size: 18px; color: #ccc;">${performerNames}</div>`;
                        }
                
                        return `
                            <div class="swiper-zoom-container" data-type="gallery" data-url="${img.url}">
                                <div class="gallery-cover-container">
                                    <div class="gallery-cover-title" title="${title}">${title}</div>
                                    ${imageCountDisplay ? `<div class="gallery-image-count" style="font-size: 18px; color: #ccc; margin-top: 3px;">${imageCountDisplay}</div>` : ''}
                                    <a href="${img.url}" target="_blank" class="gallery-cover-link">
                                        <img src="${fullSrc}" alt="${title}" decoding="async" loading="${loading}" />
                                    </a>
                                    ${performerDisplay}
                                </div>
                            </div>`;
                    }

                    // For regular images, use the same structure as getSlideTemplate
                    return `
                        <div class="swiper-zoom-container" data-type="image">
                            <img src="${fullSrc}" alt="${title}" decoding="async" loading="${loading}" 
                                 style="max-width: 100%; height: auto; display: block; margin: 0 auto;" />
                        </div>`;
                });

                // Update Swiper Virtual Slides
                currentSwiper.virtual.slides = allSlides;
                currentSwiper.virtual.update(true);
                

                setTimeout(() => { if (currentSwiper) currentSwiper.update(); }, 100);

            } else {
                // Logic for Standard Gallery Grid (if not using Virtual/Swiper)
                const galleryGrid = document.querySelector('.gallery-grid');
                if (galleryGrid) {
                    result.images.forEach(img => {
                        const imgHTML = `<div class="gallery-item"><img src="${img.paths.image}" alt="${img.title || ''}" class="gallery-img" /></div>`;
                        galleryGrid.insertAdjacentHTML('beforeend', imgHTML);
                    });
                }
            }

            // 5. General UI Refresh (Context buttons, etc.)
            const container = document.querySelector('.image-deck-container');
            if (container && typeof updateUI === 'function') updateUI(container);

            // Success Feedback
            if (loadingIndicator) {
                loadingIndicator.textContent = `✓ Loaded ${result.images.length} new items`;
                setTimeout(() => { loadingIndicator.style.display = 'none'; }, 2000);
            }

        } catch (error) {
            console.error('[Image Deck] Failed to load chunk:', error);
            if (loadingIndicator) {
                loadingIndicator.textContent = 'Error: ' + error.message;
                setTimeout(() => { loadingIndicator.style.display = 'none'; }, 3000);
            }
        } finally {
            isChunkLoading = false;
            if (nextChunkButton) {
                nextChunkButton.disabled = false;
                nextChunkButton.style.opacity = '1';
                nextChunkButton.innerHTML = '⏭️';
            }
        }
    }, 100);
}

export function closeDeck() {
    // Cleanup event listeners
    cleanupFunctions.forEach(cleanup => cleanup());
    cleanupFunctions = [];
    
    stopAutoPlay();
    stopPerformanceMonitoring(); 

    import('./controls.js').then(module => {
        module.cleanupEventHandlers();
    });

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
    
    if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
        autoPlayInterval = null;
    }
    isAutoPlaying = false;
}
