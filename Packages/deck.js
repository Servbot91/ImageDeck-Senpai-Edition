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
let performanceMonitor = null;
let frameDropCount = 0;
let cleanupFunctions = [];

function startPerformanceMonitoring() {
    if (!isMobile) return; 
    
    let lastTime = performance.now();
    const fpsThreshold = 30; 
    
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
                includedTags: filterObj.includedTags || filterObj.included || [],
                excludedTags: filterObj.excludedTags || filterObj.excluded || [],
                includedPerformers: filterObj.includedPerformers || [],
                excludedPerformers: filterObj.excludedPerformers || []
            };
        } catch (e) {
            console.error('[Image Deck] Error parsing tag filter:', e);
            return { includedTags: [], excludedTags: [], includedPerformers: [], excludedPerformers: [] };
        }
    }
    return { includedTags: [], excludedTags: [], includedPerformers: [], excludedPerformers: [] };
}

async function updateDeckContentWithFilter() {
    console.log('[Image Deck] Updating content with filter');
    
    try {
        currentChunkPage = 1;

        const contextToUse = detectContext();
        if (!contextToUse) {
            console.error('[Image Deck] Could not detect context for fetching');
            return;
        }
        
        console.log('[Image Deck] Using context for filter update:', contextToUse);
        const result = await fetchContextImages(contextToUse, 1, chunkSize);
        
        if (result && result.images) {
            currentImages = result.images;
            totalImageCount = result.totalCount || 0;
            totalPages = result.totalPages || 1;
			window.currentImages = currentImages;
            if (currentSwiper && currentSwiper.virtual) {
                const newSlides = currentImages.map(img => {
                    return getSlideTemplateImpl(img, contextToUse, false);
                });
                currentSwiper.virtual.slides = newSlides;
                currentSwiper.virtual.update(true);
                currentSwiper.slideTo(0, 0, false); 
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
            
            const container = document.querySelector('.image-deck-container');
            if (container) {
                updateUI(container);
                await updateFilterDisplayInUI(); 
            }
            
            console.log('[Image Deck] Content updated with filter, showing', currentImages.length, 'items');
        }
    } catch (error) {
        console.error('[Image Deck] Error updating content with filter:', error);
    }
}

async function restoreFilterDisplayOnOpen(container) {
    const currentTags = getCurrentFilterTags();
    
    if (currentTags.includedTags.length > 0 || currentTags.excludedTags.length > 0 || 
        currentTags.includedPerformers.length > 0 || currentTags.excludedPerformers.length > 0) {
        const allTagIds = [...currentTags.includedTags, ...currentTags.excludedTags];
        const allPerformerIds = [...currentTags.includedPerformers, ...currentTags.excludedPerformers];
        const tagNames = await getTagNames(allTagIds);
        const performerNames = await getPerformerNames(allPerformerIds);
        
        const filterDisplay = document.createElement('div');
        filterDisplay.className = 'image-deck-current-filters';
        filterDisplay.style.cssText = 'position: absolute; top: 60px; left: 20px; right: 20px; z-index: 10; display: flex; flex-wrap: wrap; gap: 5px;';
        
        let filterHtml = '<span style="color: #ccc; font-size: 12px; background: rgba(0,0,0,0.5); padding: 2px 8px; border-radius: 10px;">FILTERED BY:</span>';
        
        // Tags
        filterHtml += currentTags.includedTags.map(tagId => {
            const tagName = tagNames[tagId] || `Tag:${tagId}`;
            return `
                <span class="filter-tag-display" data-tag-id="${tagId}" style="color: white; font-size: 12px; background: rgba(46, 204, 113, 0.7); padding: 2px 8px; border-radius: 10px; display: flex; align-items: center;">
                    ✅ ${tagName}
                    <button class="remove-filter-tag" data-tag-id="${tagId}" style="background: none; border: none; color: white; margin-left: 5px; cursor: pointer; font-size: 14px;">×</button>
                </span>`;
        }).join('');
        
        filterHtml += currentTags.excludedTags.map(tagId => {
            const tagName = tagNames[tagId] || `Tag:${tagId}`;
            return `
                <span class="filter-tag-display" data-tag-id="${tagId}" style="color: white; font-size: 12px; background: rgba(231, 76, 60, 0.7); padding: 2px 8px; border-radius: 10px; display: flex; align-items: center;">
                    ❌ ${tagName}
                    <button class="remove-filter-tag" data-tag-id="${tagId}" style="background: none; border: none; color: white; margin-left: 5px; cursor: pointer; font-size: 14px;">×</button>
                </span>`;
        }).join('');
        
        // Performers (pink)
        filterHtml += currentTags.includedPerformers.map(performerId => {
            const performerName = performerNames[performerId] || `Performer:${performerId}`;
            return `
                <span class="filter-tag-display" data-performer-id="${performerId}" style="color: white; font-size: 12px; background: rgba(233, 30, 99, 0.7); padding: 2px 8px; border-radius: 10px; display: flex; align-items: center;">
                    ✅ ${performerName}
                    <button class="remove-filter-tag" data-performer-id="${performerId}" style="background: none; border: none; color: white; margin-left: 5px; cursor: pointer; font-size: 14px;">×</button>
                </span>`;
        }).join('');
        
        filterHtml += currentTags.excludedPerformers.map(performerId => {
            const performerName = performerNames[performerId] || `Performer:${performerId}`;
            return `
                <span class="filter-tag-display" data-performer-id="${performerId}" style="color: white; font-size: 12px; background: rgba(233, 30, 99, 0.7); padding: 2px 8px; border-radius: 10px; display: flex; align-items: center;">
                    ❌ ${performerName}
                    <button class="remove-filter-tag" data-performer-id="${performerId}" style="background: none; border: none; color: white; margin-left: 5px; cursor: pointer; font-size: 14px;">×</button>
                </span>`;
        }).join('');
        
        filterDisplay.innerHTML = filterHtml;
        container.insertBefore(filterDisplay, container.querySelector('.image-deck-progress'));
        
        setTimeout(() => {
            filterDisplay.querySelectorAll('.remove-filter-tag').forEach(button => {
                button.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const tagId = button.dataset.tagId;
                    const performerId = button.dataset.performerId;
                    const currentTags = getCurrentFilterTags();
                    
                    let newIncludedTags = currentTags.includedTags.filter(id => id !== tagId);
                    let newExcludedTags = currentTags.excludedTags.filter(id => id !== tagId);
                    let newIncludedPerformers = currentTags.includedPerformers.filter(id => id !== performerId);
                    let newExcludedPerformers = currentTags.excludedPerformers.filter(id => id !== performerId);
                    
                    if (newIncludedTags.length > 0 || newExcludedTags.length > 0 || 
                        newIncludedPerformers.length > 0 || newExcludedPerformers.length > 0) {
                        const filterObj = {
                            includedTags: newIncludedTags,
                            excludedTags: newExcludedTags,
                            includedPerformers: newIncludedPerformers,
                            excludedPerformers: newExcludedPerformers
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

async function getPerformerNames(performerIds) {
    if (!performerIds || performerIds.length === 0) return {};
    
    try {
        const performerPromises = performerIds.map(async (performerId) => {
            const query = `query FindPerformer($id: ID!) {
                findPerformer(id: $id) {
                    id
                    name
                }
            }`;
            
            const response = await fetch('/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    query, 
                    variables: { id: performerId } 
                })
            });
            
            const data = await response.json();
            return data?.data?.findPerformer;
        });
        
        const performerResults = await Promise.all(performerPromises);
        const performerMap = {};
        
        performerResults.forEach(performer => {
            if (performer) {
                performerMap[performer.id] = performer.name;
            }
        });
        
        return performerMap;
    } catch (error) {
        console.error('[Image Deck] Error fetching performer names:', error);
        return {};
    }
}


async function forceRefreshGalleryCovers() {
    console.log('[Image Deck] Force refreshing content');
    
    try {
        // Always use the current context which includes GraphQL filters
        const freshContext = detectContext();
        
        if (!freshContext) {
            console.error('[Image Deck] Could not detect context for refresh');
            return;
        }
        
        currentChunkPage = 1;
        
        const result = await fetchContextImages(freshContext, 1, chunkSize);
        console.log('[Image Deck] Fresh content result:', result);
        
        if (result && result.images) {
            currentImages = result.images;
            window.currentImages = currentImages;
            totalImageCount = result.totalCount || 0;
            totalPages = result.totalPages || 1;

            if (currentSwiper) {
                console.log('[Image Deck] Rebuilding Swiper with fresh content');
                const container = document.querySelector('.image-deck-container');
                if (container) {
                    if (currentSwiper && typeof currentSwiper.destroy === 'function') {
                        currentSwiper.destroy(true, true);
                    }
                    currentSwiper = null;
                    const swiperEl = container.querySelector('.swiper');
                    if (swiperEl) {
                        const wrapper = swiperEl.querySelector('.swiper-wrapper');
                        if (wrapper) {
                            wrapper.innerHTML = '';
                        }
                    }
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
                    window.currentSwiperInstance = currentSwiper;
                    setCurrentSwiper(currentSwiper);
                    setTimeout(() => {
                        if (currentSwiper) {
                            currentSwiper.update();
                            currentSwiper.slideTo(0, 0, false);
                        }
                    }, 50);
                    setTimeout(() => {
                        if (currentSwiper) {
                            currentSwiper.update();
                        }
                    }, 100);
                    updateUI(container);
                    await updateFilterDisplayInUI();
                    
                    console.log('[Image Deck] Swiper rebuilt with', currentImages.length, 'items');
                }
            }
        }
    } catch (error) {
        console.error('[Image Deck] Error force refreshing content:', error);
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
        pluginConfig = await getPluginConfig();
        console.log('[Image Deck] Plugin config loaded:', pluginConfig);
        injectDynamicStyles(pluginConfig);
        
        let detectedContext = detectContext();
        const storedMode = sessionStorage.getItem('imageDeckMode');
        
        // Handle mode overrides based on context and stored preferences
        if (detectedContext && detectedContext.type === 'galleries' && storedMode === 'image') {
            // Override to images mode
            detectedContext = {
                type: 'images',
                isGeneralListing: true,
                filter: detectedContext.filter || {},
                hash: window.location.hash
            };
        } else if (detectedContext && (detectedContext.type === 'images' || detectedContext.isGeneralListing) && storedMode === 'gallery') {
            // Override to galleries mode
            detectedContext = {
                type: 'galleries',
                isGalleryListing: true,
                filter: detectedContext.filter || {},
                hash: window.location.hash
            };
        }
        
        // Handle performer contexts specifically
		const path = window.location.pathname;
		const performerMatch = path.match(/^\/performers\/(\d+)(?:\/(galleries|images))?/);
		if (performerMatch) {
			const [, performerId, viewType] = performerMatch;
			
			// Determine mode based on URL, stored preference, or default
			let type = 'galleries';
			if (viewType === 'images' || storedMode === 'image') {
				type = 'images';
			} else if (viewType === 'galleries' || storedMode === 'gallery') {
				type = 'galleries';
			}
			
			// Preserve existing filters and ensure performer filter is included
			const existingFilters = detectedContext?.filter || {};
			if (!existingFilters.performers) {
				existingFilters.performers = {
					value: [performerId],
					modifier: "INCLUDES"
				};
			}
			
			// Ensure default sorting if not specified
			if (!existingFilters.sortBy) existingFilters.sortBy = 'created_at';
			if (!existingFilters.sortDir) existingFilters.sortDir = 'desc';
			
			detectedContext = {
				type: type,
				id: performerId,
				performerId: performerId,
				isPerformerContext: true,
				filter: existingFilters
			};
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

        // Handle tag filters from sessionStorage
        const tagFilter = sessionStorage.getItem('galleryTagFilter');
        if (tagFilter && detectedContext) {
            try {
                const filterObj = JSON.parse(tagFilter);
                
                // Initialize filter object if it doesn't exist
                if (!detectedContext.filter) {
                    detectedContext.filter = {};
                }

                // Apply tag filters
                if ((filterObj.includedTags && filterObj.includedTags.length > 0) || 
                    (filterObj.excludedTags && filterObj.excludedTags.length > 0)) {
                    
                    if (filterObj.includedTags && filterObj.includedTags.length > 0) {
                        detectedContext.filter.tags = {
                            value: filterObj.includedTags,
                            modifier: "INCLUDES"
                        };
                    }
                    
                    if (filterObj.excludedTags && filterObj.excludedTags.length > 0) {
                        if (detectedContext.filter.tags) {
                            detectedContext.filter.tags.excluded = filterObj.excludedTags;
                        } else {
                            detectedContext.filter.tags = {
                                value: [],
                                modifier: "INCLUDES",
                                excluded: filterObj.excludedTags
                            };
                        }
                    }
                }

                // Apply performer filters
                if ((filterObj.includedPerformers && filterObj.includedPerformers.length > 0) || 
                    (filterObj.excludedPerformers && filterObj.excludedPerformers.length > 0)) {
                    
                    if (filterObj.includedPerformers && filterObj.includedPerformers.length > 0) {
                        detectedContext.filter.performers = {
                            value: filterObj.includedPerformers,
                            modifier: "INCLUDES"
                        };
                    }
                    
                    if (filterObj.excludedPerformers && filterObj.excludedPerformers.length > 0) {
                        if (detectedContext.filter.performers) {
                            detectedContext.filter.performers.excluded = filterObj.excludedPerformers;
                        } else {
                            detectedContext.filter.performers = {
                                value: [],
                                modifier: "INCLUDES",
                                excluded: filterObj.excludedPerformers
                            };
                        }
                    }
                }
            } catch (e) {
                console.error('[Image Deck] Error applying stored tag filter:', e);
            }
        }

        // Set default context if none detected
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

        storedContextInfo = detectedContext;
        contextInfo = detectedContext;
        console.log('[Image Deck] Context assigned:', contextInfo);

        // Fetch content based on context
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

        // Process results
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

        // Rest of the openDeck function remains the same...
        const container = await createDeckUI(); 
        document.body.classList.add('image-deck-open');

        document.body.appendChild(container);

        await new Promise(resolve => requestAnimationFrame(resolve));

        requestAnimationFrame(() => {
            container.classList.add('active');
        });

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
                    if (topBar) topBar.style.opacity = '0';
                    if (controls) controls.style.opacity = '0';
                    if (speedIndicator) speedIndicator.style.opacity = '0';
                } else {
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

        updateUI(container);
        await restoreFilterDisplayOnOpen(container);

        import('./controls.js').then(module => {
            module.setupEventHandlers(container, {
                closeDeck,
                startAutoPlay,
                stopAutoPlay,
                loadNextChunk
            });
        });
        
		const filterUpdateListener = (e) => {
			console.log('[Image Deck] Received updateDeckContent event:', e.detail);
			setTimeout(() => {
				forceRefreshGalleryCovers();
			}, 100); 
		};

		window.addEventListener('updateDeckContent', filterUpdateListener);
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
    
    const currentTags = getCurrentFilterTags(); // This returns the correct structure now
    let filterDisplay = '';
    
    // Fix the condition check here
    if (currentTags.includedTags && (currentTags.includedTags.length > 0 || currentTags.excludedTags.length > 0 || 
        currentTags.includedPerformers.length > 0 || currentTags.excludedPerformers.length > 0)) {
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

    // Fix the event listener setup
    if (currentTags.includedTags && (currentTags.includedTags.length > 0 || currentTags.excludedTags.length > 0 || 
        currentTags.includedPerformers.length > 0 || currentTags.excludedPerformers.length > 0)) {
        setTimeout(() => {
            const removeButtons = container.querySelectorAll('.remove-filter-tag');
            removeButtons.forEach(button => {
                button.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const tagId = button.dataset.tagId;
                    const performerId = button.dataset.performerId;
                    const currentTags = getCurrentFilterTags();
                    
                    let newIncludedTags = currentTags.includedTags.filter(id => id !== tagId);
                    let newExcludedTags = currentTags.excludedTags.filter(id => id !== tagId);
                    let newIncludedPerformers = currentTags.includedPerformers.filter(id => id !== performerId);
                    let newExcludedPerformers = currentTags.excludedPerformers.filter(id => id !== performerId);
                    
                    if (newIncludedTags.length > 0 || newExcludedTags.length > 0 || 
                        newIncludedPerformers.length > 0 || newExcludedPerformers.length > 0) {
                        const filterObj = {
                            includedTags: newIncludedTags,
                            excludedTags: newExcludedTags,
                            includedPerformers: newIncludedPerformers,
                            excludedPerformers: newExcludedPerformers
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
    
    const currentTags = getCurrentFilterTags();
    
    // Only proceed if there are actually filters applied
    if (currentTags.includedTags.length > 0 || currentTags.excludedTags.length > 0 || 
        currentTags.includedPerformers.length > 0 || currentTags.excludedPerformers.length > 0) {
        
        const allTagIds = [...currentTags.includedTags, ...currentTags.excludedTags];
        const allPerformerIds = [...currentTags.includedPerformers, ...currentTags.excludedPerformers];
        
        // Fetch names concurrently for better performance
        const [tagNames, performerNames] = await Promise.all([
            getTagNames(allTagIds),
            getPerformerNames(allPerformerIds)
        ]);
        
        const filterDisplay = document.createElement('div');
        filterDisplay.className = 'image-deck-current-filters';
        filterDisplay.style.cssText = 'position: absolute; top: 60px; left: 20px; right: 20px; z-index: 10; display: flex; flex-wrap: wrap; gap: 5px;';
        
        let filterHtml = '<span style="color: #ccc; font-size: 12px; background: rgba(0,0,0,0.5); padding: 2px 8px; border-radius: 10px;">FILTERED BY:</span>';
        
        // Included Tags (green)
        filterHtml += currentTags.includedTags.map(tagId => {
            const tagName = tagNames[tagId] || `Tag:${tagId}`;
            return `
                <span class="filter-tag-display" data-tag-id="${tagId}" style="color: white; font-size: 12px; background: rgba(46, 204, 113, 0.7); padding: 2px 8px; border-radius: 10px; display: flex; align-items: center;">
                    ✅ ${tagName}
                    <button class="remove-filter-tag" data-tag-id="${tagId}" style="background: none; border: none; color: white; margin-left: 5px; cursor: pointer; font-size: 14px;">×</button>
                </span>`;
        }).join('');
        
        // Excluded Tags (red)
        filterHtml += currentTags.excludedTags.map(tagId => {
            const tagName = tagNames[tagId] || `Tag:${tagId}`;
            return `
                <span class="filter-tag-display" data-tag-id="${tagId}" style="color: white; font-size: 12px; background: rgba(231, 76, 60, 0.7); padding: 2px 8px; border-radius: 10px; display: flex; align-items: center;">
                    ❌ ${tagName}
                    <button class="remove-filter-tag" data-tag-id="${tagId}" style="background: none; border: none; color: white; margin-left: 5px; cursor: pointer; font-size: 14px;">×</button>
                </span>`;
        }).join('');
        
        // Included Performers (pink)
        filterHtml += currentTags.includedPerformers.map(performerId => {
            const performerName = performerNames[performerId] || `Performer:${performerId}`;
            return `
                <span class="filter-tag-display" data-performer-id="${performerId}" style="color: white; font-size: 12px; background: rgba(233, 30, 99, 0.7); padding: 2px 8px; border-radius: 10px; display: flex; align-items: center;">
                    ✅ ${performerName}
                    <button class="remove-filter-tag" data-performer-id="${performerId}" style="background: none; border: none; color: white; margin-left: 5px; cursor: pointer; font-size: 14px;">×</button>
                </span>`;
        }).join('');
        
        // Excluded Performers (pink/darker)
        filterHtml += currentTags.excludedPerformers.map(performerId => {
            const performerName = performerNames[performerId] || `Performer:${performerId}`;
            return `
                <span class="filter-tag-display" data-performer-id="${performerId}" style="color: white; font-size: 12px; background: rgba(156, 39, 176, 0.7); padding: 2px 8px; border-radius: 10px; display: flex; align-items: center;">
                    ❌ ${performerName}
                    <button class="remove-filter-tag" data-performer-id="${performerId}" style="background: none; border: none; color: white; margin-left: 5px; cursor: pointer; font-size: 14px;">×</button>
                </span>`;
        }).join('');
        
        filterDisplay.innerHTML = filterHtml;
        filterDisplay.style.display = 'flex'; // Make sure it's visible
        container.insertBefore(filterDisplay, container.querySelector('.image-deck-progress'));
        
        // Add event listeners for removing filters
        setTimeout(() => {
            filterDisplay.querySelectorAll('.remove-filter-tag').forEach(button => {
                button.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const tagId = button.dataset.tagId;
                    const performerId = button.dataset.performerId;
                    const currentTags = getCurrentFilterTags();
                    
                    // Update the filter arrays
                    let newIncludedTags = currentTags.includedTags.filter(id => id !== tagId);
                    let newExcludedTags = currentTags.excludedTags.filter(id => id !== tagId);
                    let newIncludedPerformers = currentTags.includedPerformers.filter(id => id !== performerId);
                    let newExcludedPerformers = currentTags.excludedPerformers.filter(id => id !== performerId);
                    
                    // Update session storage
                    if (newIncludedTags.length > 0 || newExcludedTags.length > 0 || 
                        newIncludedPerformers.length > 0 || newExcludedPerformers.length > 0) {
                        const filterObj = {
                            includedTags: newIncludedTags,
                            excludedTags: newExcludedTags,
                            includedPerformers: newIncludedPerformers,
                            excludedPerformers: newExcludedPerformers
                        };
                        sessionStorage.setItem('galleryTagFilter', JSON.stringify(filterObj));
                    } else {
                        sessionStorage.removeItem('galleryTagFilter');
                    }
                    
                    // Trigger filter change event
                    window.dispatchEvent(new CustomEvent('galleryTagFilterChanged'));
                    
                    // Refresh the deck content
                    setTimeout(() => {
                        forceRefreshGalleryCovers();
                    }, 100);
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
                
			modeIndicator.addEventListener('click', async () => {
				const currentMode = contextInfo?.type === 'galleries' ? 'gallery' : 'image';
				const newMode = currentMode === 'gallery' ? 'image' : 'gallery';

				// Store the new mode
				sessionStorage.setItem('imageDeckMode', newMode);
				
				// Get current filters to preserve them including sort settings
				const currentFilters = {...(contextInfo?.filter || {})};
				
				// Ensure sorting is preserved
				if (!currentFilters.sortBy) currentFilters.sortBy = 'created_at';
				if (!currentFilters.sortDir) currentFilters.sortDir = 'desc';
				
				// Handle performer context properly
				if (contextInfo?.performerId) {
					// Ensure performer filter is maintained
					if (!currentFilters.performers) {
						currentFilters.performers = {
							value: [contextInfo.performerId],
							modifier: "INCLUDES"
						};
					}
					
					// Update URL based on new mode
					let newPath = `/performers/${contextInfo.performerId}`;
					if (newMode === 'gallery') {
						newPath += '/galleries';
					} else {
						newPath += '/images';
					}
					
					history.pushState({}, '', newPath);
					
					// Update context for the new mode with preserved filters
					const newContext = {
						type: newMode === 'gallery' ? 'galleries' : 'images',
						performerId: contextInfo.performerId,
						isPerformerContext: true,
						filter: currentFilters
					};
					
					// Close and reopen with new context
					import('./deck.js').then(module => {
						module.closeDeck();
						setTimeout(() => {
							module.openDeck();
						}, 100);
					});
				} else {
					// For general contexts (not performer-specific)
					let basePath = '/';
					if (newMode === 'gallery') {
						basePath = '/galleries';
					} else {
						basePath = '/images';
					}
					
					history.pushState({}, '', basePath);
					
					// Update context for the new mode with preserved filters
					const newContext = {
						type: newMode === 'gallery' ? 'galleries' : 'images',
						isGalleryListing: newMode === 'gallery',
						isGeneralListing: newMode === 'image',
						filter: currentFilters
					};
					
					// Close and reopen with new context
					import('./deck.js').then(module => {
						module.closeDeck();
						setTimeout(() => {
							module.openDeck();
						}, 100);
					});
				}
			});
            }
        }
        
        if (modeIndicator) {
            const isGalleryMode = contextInfo?.type === 'galleries';
            modeIndicator.innerHTML = isGalleryMode ? 
                '🖼️ Gallery Mode Enabled 🖼️' : 
                '📷 Image Mode Enabled 📷';
        }

        // Rest of the UI update code remains the same...
        let current = 1;
        const displayedTotal = currentImages.length;
        const actualTotal = totalImageCount || displayedTotal;

        if (currentSwiper.virtual) {
            current = currentSwiper.activeIndex + 1;
        } else {
            if (currentSwiper.params.loop && contextInfo?.isSingleGallery) {
                const realIndex = currentSwiper.realIndex + 1;

                if (realIndex === 0) {
                    current = displayedTotal; 
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
    if (chunkLoadTimeout) {
        clearTimeout(chunkLoadTimeout);
    }
    
    chunkLoadTimeout = setTimeout(async () => {
        if (isChunkLoading) {
            console.log('[Image Deck] Load already in progress, skipping...');
            return;
        }

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

            currentImages.push(...result.images);
            currentChunkPage = nextPage;
            totalPages = result.totalPages || totalPages;

            if (currentSwiper && currentSwiper.virtual) {
                const allSlides = currentImages.map(img => {
                    const fullSrc = img.paths.image;
                    const isGallery = img.url && !contextInfo?.isSingleGallery;
                    const title = img.title || 'Untitled';
                    const loading = 'lazy'; 

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
                });

                currentSwiper.virtual.slides = allSlides;
                currentSwiper.virtual.update(true);
                
                setTimeout(() => { if (currentSwiper) currentSwiper.update(); }, 100);

            } else {
                const galleryGrid = document.querySelector('.gallery-grid');
                if (galleryGrid) {
                    result.images.forEach(img => {
                        const imgHTML = `<div class="gallery-item"><img src="${img.paths.image}" alt="${img.title || ''}" class="gallery-img" /></div>`;
                        galleryGrid.insertAdjacentHTML('beforeend', imgHTML);
                    });
                }
            }

            const container = document.querySelector('.image-deck-container');
            if (container && typeof updateUI === 'function') updateUI(container);

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
