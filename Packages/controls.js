import { searchTags, applyGalleryTagFilter, clearGalleryTagFilter } from './graphql.js';
import { openMetadataModal, closeMetadataModal } from './metadata.js';
import { isMobile } from './utils.js';
import { state } from './state.js';
import { detectContext } from './context.js';

const elementData = new WeakMap();

export function storeElementData(element, data) {
    elementData.set(element, data);
}

export function getElementData(element) {
    return elementData.get(element);
}

class EventHandlerManager {
    constructor() {
        this.listeners = new Map();
    }

    add(element, event, handler, options = false) {
        const key = `${element.constructor.name}_${event}_${Math.random()}`;
        element.addEventListener(event, handler, options);
        
        if (!this.listeners.has(key)) {
            this.listeners.set(key, { element, event, handler, options });
        }
        
        return key;
    }

    remove(key) {
        if (this.listeners.has(key)) {
            const { element, event, handler } = this.listeners.get(key);
            element.removeEventListener(event, handler);
            this.listeners.delete(key);
        }
    }

    removeAll() {
        for (const [key, { element, event, handler }] of this.listeners) {
            element.removeEventListener(event, handler);
        }
        this.listeners.clear();
    }
}

const eventManager = new EventHandlerManager();

let isDeckActive = false;

function toggleFullscreen() {
    const container = document.querySelector('.image-deck-container');
    if (!container) return;

    if (!document.fullscreenElement) {
        container.requestFullscreen().catch(err => {
            console.warn('[Image Deck] Fullscreen request failed:', err);
        }).finally(() => {
            updateFullscreenUI(true);
        });
    } else {
        document.exitFullscreen().finally(() => {
            updateFullscreenUI(false);
        });
    }
}

function updateFullscreenUI(isFullscreen) {
    const fullscreenBtn = document.querySelector('.image-deck-fullscreen');
    if (fullscreenBtn) {
        fullscreenBtn.textContent = isFullscreen ? '⛶' : '⛶';
    }
    
    const container = document.querySelector('.image-deck-container');
    if (container) {
        if (isFullscreen) {
            container.classList.add('fullscreen-mode');
        } else {
            container.classList.remove('fullscreen-mode');
        }
    }
}

function updateControlVisibility(isVisible = true) {
    const container = document.querySelector('.image-deck-container');
    if (!container) return;
    
    const controlsWrapper = container.querySelector('.image-deck-controls-wrapper');
    const topBar = container.querySelector('.image-deck-topbar');
    const speedIndicator = container.querySelector('.image-deck-speed');
    
    const opacity = isVisible ? '1' : '0';
    const display = isVisible ? 'flex' : 'none'; // or keep display: flex and only change opacity
    
    if (topBar) {
        topBar.style.opacity = opacity;
    }
    
    if (controlsWrapper) {
        controlsWrapper.style.opacity = opacity;
    }
    
    if (speedIndicator) {
        speedIndicator.style.opacity = opacity;
    }
}

function isCurrentSlideGallery() {
    const swiper = state.getSwiper();
    if (swiper && swiper.slides) {
        const activeSlide = swiper.slides[swiper.activeIndex];
        if (activeSlide) {
            const zoomContainer = activeSlide.querySelector('.swiper-zoom-container');
            if (zoomContainer && zoomContainer.dataset.type === 'gallery') {
                return true;
            }
        }
    }
    return false;
}

function updateGalleryStateClass() {
    const container = document.querySelector('.image-deck-container');
    if (!container) return;
    
    if (isCurrentSlideGallery()) {
        container.classList.add('gallery-active');
    } else {
        container.classList.remove('gallery-active');
    }
}

class EventManager {
    static instance = new EventManager();
    
    constructor() {
        this.handlers = new Map();
    }
    
    static add(element, event, handler, options = false) {
        const key = `${element.constructor.name}_${event}_${Date.now()}_${Math.random()}`;
        element.addEventListener(event, handler, options);
        this.instance.handlers.set(key, { element, event, handler, options });
        return key;
    }
    
    static remove(key) {
        if (this.instance.handlers.has(key)) {
            const { element, event, handler } = this.instance.handlers.get(key);
            element.removeEventListener(event, handler);
            this.instance.handlers.delete(key);
        }
    }
    
    static removeAll() {
        for (const [key, { element, event, handler }] of this.instance.handlers) {
            try {
                element.removeEventListener(event, handler);
            } catch (e) {
                console.warn('Failed to remove event listener:', e);
            }
        }
        this.instance.handlers.clear();
    }
}

function showGalleryTagFilter() {
    // Remove existing modal if present
    const existingModal = document.querySelector('.gallery-tag-filter-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal for tag selection with styling matching image details modal
    const modal = document.createElement('div');
    modal.className = 'gallery-tag-filter-modal image-deck-metadata-modal';
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 90%;
        max-width: 500px;
        max-height: 90vh;
        background: rgba(0, 0, 0, 0.95);
        backdrop-filter: blur(20px);
        border-radius: 20px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        z-index: 10000;
        display: flex;
        flex-direction: column;
    `;
    
    modal.innerHTML = `
        <div class="image-deck-metadata-content" style="display: flex; flex-direction: column; height: auto; max-height: 90vh;">
            <div class="image-deck-metadata-header">
                <h3>Filter Galleries by Tag</h3>
                <button class="close-filter-modal image-deck-metadata-close" style="width: 36px; height: 36px; font-size: 24px;">✕</button>
            </div>
            <div class="image-deck-metadata-body" style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column;">
                <div style="margin-bottom: 20px;">
                    <label style="display: block; color: rgba(255,255,255,0.7); font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-weight: 600;">Included Tags</label>
                    <input type="text" class="included-tag-search" placeholder="Search tags..." style="width: 100%; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: white; padding: 12px; font-size: 14px; margin-bottom: 10px;">
                    <div class="included-tag-list" style="max-height: 150px; overflow-y: auto; background: rgba(255,255,255,0.05); border-radius: 8px; padding: 5px; margin-bottom: 15px;"></div>
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; color: rgba(255,255,255,0.7); font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-weight: 600;">Excluded Tags</label>
                    <input type="text" class="excluded-tag-search" placeholder="Search tags..." style="width: 100%; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: white; padding: 12px; font-size: 14px; margin-bottom: 10px;">
                    <div class="excluded-tag-list" style="max-height: 150px; overflow-y: auto; background: rgba(255,255,255,0.05); border-radius: 8px; padding: 5px; margin-bottom: 15px;"></div>
                </div>
            </div>
            <div style="padding: 0 20px 20px 20px;">
                <div style="display: flex; gap: 12px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <button class="clear-tag-filter" style="flex: 1; padding: 14px 24px; border-radius: 8px; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s ease;">Clear</button>
                    <button class="apply-tag-filter" style="flex: 1; padding: 14px 24px; border-radius: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s ease;">Apply Filter</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add close functionality
    const closeBtn = modal.querySelector('.close-filter-modal');
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    // Close on Escape key
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
    
    // Close on click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Setup tag search and selection
    const includedSearchInput = modal.querySelector('.included-tag-search');
    const excludedSearchInput = modal.querySelector('.excluded-tag-search');
    const includedTagList = modal.querySelector('.included-tag-list');
    const excludedTagList = modal.querySelector('.excluded-tag-list');
    let includedTags = [];
    let excludedTags = [];
    
    // NEW: Define the setupTagSearch function here
    function setupTagSearch(inputElement, tagListContainer, selectedTags, type) {
        let searchTimeout;
        
        inputElement.addEventListener('input', async (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            // Even with 1 character, try to search (more permissive)
            if (query.length >= 1) {
                searchTimeout = setTimeout(async () => {
                    try {
                        const tags = await searchTags(query);
                        renderTagList(tags, tagListContainer, selectedTags, type);
                    } catch (error) {
                        console.error('Error searching tags:', error);
                        tagListContainer.innerHTML = '<div style="color: #ff6b6b; padding: 8px;">Error loading tags</div>';
                    }
                }, 300); // Keep the debounce but be more responsive
            } else {
                tagListContainer.innerHTML = '<div style="color: #999; padding: 8px; text-align: center;">Type to search tags</div>';
            }
        });
    }
    
    // Load currently applied tags if any
    const currentFilter = sessionStorage.getItem('galleryTagFilter');
    if (currentFilter) {
        try {
            const filterObj = JSON.parse(currentFilter);
            includedTags = filterObj.included || [];
            excludedTags = filterObj.excluded || [];
            
            // Update the UI to reflect current selections
            setTimeout(() => {
                if (includedSearchInput.value.trim().length >= 1) {
                    includedSearchInput.dispatchEvent(new Event('input'));
                }
                if (excludedSearchInput.value.trim().length >= 1) {
                    excludedSearchInput.dispatchEvent(new Event('input'));
                }
            }, 100);
        } catch (e) {
            console.error('Error parsing current filter:', e);
        }
    }
    
    setupTagSearch(includedSearchInput, includedTagList, includedTags, 'included');
    setupTagSearch(excludedSearchInput, excludedTagList, excludedTags, 'excluded');    
    
    // Trigger initial search if there's text
    if (includedSearchInput.value.trim().length >= 1) {
        includedSearchInput.dispatchEvent(new Event('input'));
    } else {
        includedTagList.innerHTML = '<div style="color: #999; padding: 8px; text-align: center;">Type to search tags</div>';
    }
    
    if (excludedSearchInput.value.trim().length >= 1) {
        excludedSearchInput.dispatchEvent(new Event('input'));
    } else {
        excludedTagList.innerHTML = '<div style="color: #999; padding: 8px; text-align: center;">Type to search tags</div>';
    }
    
    // Apply filter button
    const applyBtn = modal.querySelector('.apply-tag-filter');
    applyBtn.addEventListener('click', () => {
        if (includedTags.length > 0 || excludedTags.length > 0) {
            applyGalleryTagFilter(includedTags, excludedTags);
        } else {
            // Clear filter if no tags selected
            clearGalleryTagFilter();
        }
        modal.remove();
    });
    
    // Clear filter button
    const clearBtn = modal.querySelector('.clear-tag-filter');
    clearBtn.addEventListener('click', () => {
        includedTags = [];
        excludedTags = [];
        includedSearchInput.value = '';
        excludedSearchInput.value = '';
        includedTagList.innerHTML = '<div style="color: #999; padding: 8px; text-align: center;">Type at least 2 characters to search</div>';
        excludedTagList.innerHTML = '<div style="color: #999; padding: 8px; text-align: center;">Type at least 2 characters to search</div>';
        clearGalleryTagFilter();
    });
}

// Update renderTagList to support included/excluded distinction
function renderTagList(tags, container, selectedTags, type) {
    if (!tags || tags.length === 0) {
        container.innerHTML = '<div style="color: #999; padding: 8px; text-align: center;">No tags found</div>';
        return;
    }
    
    container.innerHTML = tags.map(tag => `
        <div class="tag-item" style="padding: 8px; cursor: pointer; display: flex; align-items: center; border-radius: 4px; margin-bottom: 2px; ${selectedTags.includes(tag.id) ? 'background: #444;' : 'background: #333;'}">
            <input type="checkbox" id="tag-${type}-${tag.id}" ${selectedTags.includes(tag.id) ? 'checked' : ''} style="margin-right: 8px; cursor: pointer;">
            <label for="tag-${type}-${tag.id}" style="cursor: pointer; flex-grow: 1;">${tag.name}</label>
        </div>
    `).join('');
    
    // Add event listeners
    container.querySelectorAll('.tag-item').forEach((item, index) => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        const tagId = tags[index].id;
        
        // Click on entire item toggles checkbox
        item.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
                updateSelectedTags(selectedTags, tagId, checkbox.checked);
            }
        });
        
        // Direct checkbox change
        checkbox.addEventListener('change', (e) => {
            updateSelectedTags(selectedTags, tagId, e.target.checked);
        });
    });
}

// Update updateSelectedTags to work with the appropriate tag list
function updateSelectedTags(selectedTags, tagId, isSelected) {
    if (isSelected) {
        if (!selectedTags.includes(tagId)) {
            selectedTags.push(tagId);
        }
    } else {
        const idx = selectedTags.indexOf(tagId);
        if (idx > -1) {
            selectedTags.splice(idx, 1);
        }
    }
}

async function updateContentViewWithFilter() {
    const tagFilter = sessionStorage.getItem('galleryTagFilter');
    let tagIds = [];
    
    if (tagFilter) {
        try {
            tagIds = JSON.parse(tagFilter);
        } catch (e) {
            console.error('Error parsing tag filter:', e);
        }
    }
    
    // Emit custom event that deck.js can listen to
    window.dispatchEvent(new CustomEvent('updateDeckContent', { 
        detail: { tagIds } 
    }));
}

function getCurrentFilterTags() {
    const tagFilter = sessionStorage.getItem('galleryTagFilter');
    if (tagFilter) {
        try {
            return JSON.parse(tagFilter);
        } catch (e) {
            console.error('Error parsing tag filter:', e);
            return [];
        }
    }
    return [];
}

export function setupEventHandlers(container, callbacks = {}) {
    const { closeDeck, startAutoPlay, stopAutoPlay, loadNextChunk } = callbacks;
    setDeckActive(true);
    
    // Listen for filter changes and update content dynamically
    const filterChangeListener = async (e) => {
        console.log('[Image Deck] Filter changed, updating content');
        // Force refresh the context to include new filter
        storedContextInfo = detectContext();
        await updateContentViewWithFilter();
    };
    
    window.addEventListener('galleryTagFilterChanged', filterChangeListener);
    storeElementData(container, { filterChangeListener });
    
    // Store the keyboard handler reference so we can remove it later
    const keyboardHandler = handleKeyboard;
    
    // Close button
    const closeBtn = container.querySelector('.image-deck-close');
    if (closeBtn) {
        eventManager.add(closeBtn, 'click', closeDeck);
    }
    
    // Fullscreen button
    const fullscreenBtn = container.querySelector('.image-deck-fullscreen');
    if (fullscreenBtn) {
        eventManager.add(fullscreenBtn, 'click', toggleFullscreen);
    }

    // Metadata modal close button
    const metadataCloseBtn = container.querySelector('.image-deck-metadata-close');
    if (metadataCloseBtn) {
        eventManager.add(metadataCloseBtn, 'click', closeMetadataModal);
    }
	
    const galleryFilterBtn = container.querySelector('.gallery-filter-btn');
    if (galleryFilterBtn) {
        eventManager.add(galleryFilterBtn, 'click', showGalleryTagFilter);
    }
    
    // Control buttons
    const controlButtons = container.querySelectorAll('.image-deck-control-btn');

    controlButtons.forEach(button => {
        eventManager.add(button, 'click', (e) => {
            const action = button.dataset.action;
            const swiper = state.getSwiper();

            // Handle gallery filter button 
            if (button.classList.contains('gallery-filter-btn')) {
                showGalleryTagFilter();
                return;
            }

            if (!action) return;

            switch(action) {
                case 'prev':
                    if (swiper) {
                        swiper.slidePrev();
                    } else {
                        console.error('[Image Deck] Prev failed: swiper is not defined');
                    }
                    break;
                case 'next':
                    if (swiper) {
                        swiper.slideNext();
                        setTimeout(() => {
                            loadNextChunk();
                        }, 100);
                    } else {
                        console.error('[Image Deck] Next failed: swiper is not defined');
                    }
                    break;
                case 'play':
                    const playBtn = document.querySelector('[data-action="play"]');
                    const isAutoPlaying = playBtn && playBtn.classList.contains('active');
                    if (isAutoPlaying) {
                        stopAutoPlay();
                    } else {
                        startAutoPlay();
                    }
                    break;
                case 'info':
                    openMetadataModal();
                    break;
                case 'zoom-in':
                    if (swiper && swiper.zoom && !isCurrentSlideGallery()) {
                        swiper.zoom.in();
                    }
                    break;
                case 'zoom-out':
                    if (swiper && swiper.zoom && !isCurrentSlideGallery()) {
                        swiper.zoom.out();
                    }
                    break;
                case 'next-chunk':
                    loadNextChunk(container);
                    break;
                default:
                    console.log('[Image Deck] Unknown action:', action);
            }
        });
    }); // End of controlButtons.forEach

    // Handle remove filter tag buttons - moved outside the controlButtons loop
    const removeTagButtons = container.querySelectorAll('.remove-filter-tag');
    removeTagButtons.forEach(button => {
        eventManager.add(button, 'click', async (e) => {
            e.stopPropagation();
            const tagId = button.dataset.tagId;
            const currentTags = getCurrentFilterTags();
            const newTags = currentTags.filter(id => id !== tagId);
            
            if (newTags.length > 0) {
                sessionStorage.setItem('galleryTagFilter', JSON.stringify(newTags));
            } else {
                sessionStorage.removeItem('galleryTagFilter');
            }
            
            // Notify about filter change
            window.dispatchEvent(new CustomEvent('galleryTagFilterChanged'));
        });
    });

    const swiper = state.getSwiper();
    if (swiper) {
		const slideChangeListener = function() {
			updateGalleryStateClass();
			updateControlVisibility(true);
		};
        swiper.on('slideChangeTransitionEnd', slideChangeListener);
        storeElementData(container, { slideChangeListener });
        
        setTimeout(() => {
            updateGalleryStateClass();
        }, 0);
    }

    // Add keyboard controls with proper reference storage
    eventManager.add(document, 'keydown', keyboardHandler, true);
    
    setupSwipeGestures(container, eventManager);
    setupMouseWheel(container, eventManager);
}


function setupSwipeGestures(container, eventManager) {
    let touchStartY = 0;
    let touchStartX = 0;
    let touchDeltaY = 0;
    let touchDeltaX = 0;
    let rafId = null;
    let lastTouchTime = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;
    let isProcessingTouch = false;
    
    const swiperEl = container.querySelector('.image-deck-swiper');
    if (!swiperEl) return;

    // Single consolidated touch handler
    const touchHandler = {
        handleTouchStart: (e) => {
            if (isProcessingTouch || e.touches.length > 1) return;
            
            if (e.target.closest('.image-deck-metadata-modal')) return;
            
            const currentTime = new Date().getTime();
            const touchX = e.touches[0].clientX;
            const touchY = e.touches[0].clientY;
            
            // Handle double tap for zoom
            if (currentTime - lastTouchTime < 300 && 
                Math.abs(touchX - lastTouchX) < 20 && 
                Math.abs(touchY - lastTouchY) < 20) {
                
                handleDoubleTapZoom(e, container);
                e.preventDefault();
                isProcessingTouch = true;
                return;
            }
            
            lastTouchTime = currentTime;
            lastTouchX = touchX;
            lastTouchY = touchY;
            
            touchStartY = touchY;
            touchStartX = touchX;
            touchDeltaY = 0;
            touchDeltaX = 0;
            isProcessingTouch = false;
        },

        handleTouchMove: (e) => {
            if (isProcessingTouch || e.touches.length > 1) return;
            
            if (e.target.closest('.image-deck-metadata-modal')) return;
            
            const currentY = e.touches[0].clientY;
            const currentX = e.touches[0].clientX;
            
            touchDeltaY = currentY - touchStartY;
            touchDeltaX = Math.abs(currentX - touchStartX);
            
            const isInFullscreen = !!document.fullscreenElement;
            
            // Only apply vertical swipe gesture outside of swiper zoom container
            if (!isInFullscreen && touchDeltaY > 30 && touchDeltaX < 50) {
                if (rafId) cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(() => {
                    container.style.transform = `translateY(${touchDeltaY * 0.3}px)`;
                    container.style.opacity = Math.max(0.3, 1 - (touchDeltaY / 500));
                });
                isProcessingTouch = true;
            }
        },

        handleTouchEnd: (e) => {
            if (rafId) cancelAnimationFrame(rafId);
            
            const isInFullscreen = !!document.fullscreenElement;
            
            if (!isInFullscreen && touchDeltaY > 150 && touchDeltaX < 50) {
                closeDeck();
            } else {
                requestAnimationFrame(() => {
                    container.style.transform = '';
                    container.style.opacity = '';
                });
            }
            
            touchDeltaY = 0;
            touchDeltaX = 0;
            isProcessingTouch = false;
        }
    };

    // Attach single event listeners
    eventManager.add(swiperEl, 'touchstart', touchHandler.handleTouchStart, { passive: false });
    eventManager.add(swiperEl, 'touchmove', touchHandler.handleTouchMove, { passive: true });
    eventManager.add(swiperEl, 'touchend', touchHandler.handleTouchEnd, { passive: true });
}

// Double tap zoom handling
function handleDoubleTapZoom(event, container) {
    const swiper = state.getSwiper();
    if (!swiper || !swiper.zoom) return;
    
    if (isCurrentSlideGallery()) {
        console.log('[Image Deck] Double tap ignored - gallery slide');
        return;
    }
    
    const rect = event.target.getBoundingClientRect();
    const x = event.touches[0].clientX - rect.left;
    const y = event.touches[0].clientY - rect.top;
    
    if (swiper.zoom.scale === 1) {
        swiper.zoom.in(swiper.zoom.enabled ? 2 : 1);
        console.log('[Image Deck] Double tap zoom in');
    } else {
        swiper.zoom.out();
        console.log('[Image Deck] Double tap zoom out');
    }
    
    event.preventDefault();
}

function setupMouseWheel(container, eventManager) {
    const swiperEl = container.querySelector('.image-deck-swiper');
    if (!swiperEl) return;

    eventManager.add(swiperEl, 'wheel', (e) => {
        const swiper = state.getSwiper();
        if (!swiper) return;

        e.preventDefault();
        
        if (swiper.wheeling) return;
        swiper.wheeling = true;
        
        if (e.deltaY > 0) {
            swiper.slideNext();
        } else if (e.deltaY < 0) {
            swiper.slidePrev();
        }
        
        setTimeout(() => {
            if (swiper) swiper.wheeling = false;
        }, 150);
    }, { passive: false });
}

export function setDeckActive(active) {
    isDeckActive = active;
}

function handleKeyboard(e) {
    if (!isDeckActive) return;
    
    // Check if we're in a modal input field
    const inModalInput = e.target.closest('.gallery-tag-filter-modal') && 
                        (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
    
    // Allow spacebar in modal inputs
    if (inModalInput && e.key === ' ') {
        return; // Let the input handle spacebar normally
    }
    
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Escape', '+', '-', '0'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    const swiper = state.getSwiper();
    
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
            closeMetadataModal();
            return;
        }
        return;
    }

    switch(e.key) {
        case 'Escape':
            const modal = document.querySelector('.image-deck-metadata-modal');
            if (modal && modal.classList.contains('active')) {
                closeMetadataModal();
            } else {
                closeDeck();
            }
            break;
        case ' ':
            e.preventDefault();
            e.stopPropagation();
            const playBtn = document.querySelector('[data-action="play"]');
            if (playBtn && playBtn.classList.contains('active')) {
                stopAutoPlay();
            } else {
                startAutoPlay();
            }
            break;
        case 'i':
        case 'I':
            e.preventDefault();
            e.stopPropagation();
            const metadataModal = document.querySelector('.image-deck-metadata-modal');
            if (metadataModal && metadataModal.classList.contains('active')) {
                closeMetadataModal();
            } else {
                openMetadataModal();
            }
            break;
        case '+':
        case '=':
            e.preventDefault();
            if (swiper && swiper.zoom && !isCurrentSlideGallery()) {
                swiper.zoom.in();
            }
            break;
        case '-':
        case '_':
            e.preventDefault();
            if (swiper && swiper.zoom && !isCurrentSlideGallery()) {
                swiper.zoom.out();
            }
            break;
        case '0':
            e.preventDefault();
            if (swiper && swiper.zoom && !isCurrentSlideGallery()) {
                swiper.zoom.reset();
            }
            break;
        case 'ArrowLeft':
            e.preventDefault();
            e.stopPropagation();
            if (swiper) {
                swiper.slidePrev();
            }
            break;
        case 'ArrowRight':
            e.preventDefault();
            e.stopPropagation();
            if (swiper) {
                swiper.slideNext();
                setTimeout(() => {
                    if (swiper) {
                        const currentIndex = swiper.activeIndex;
                        const totalCurrentSlides = swiper.virtual ? 
                            swiper.virtual.slides.length : 
                            swiper.slides.length;
                    }
                }, 100);
            }
            break;
    }
}
// Cleanup function to remove event listeners
export function cleanupEventHandlers() {
    eventManager.removeAll();
    isDeckActive = false;
    
    // Remove global keyboard handler specifically
    document.removeEventListener('keydown', handleKeyboard, true);
    
    const swiper = state.getSwiper();
    if (swiper) {
        // Remove swiper event listeners
        swiper.off('slideChangeTransitionEnd');
        // Remove any other swiper listeners you've added
    }
}