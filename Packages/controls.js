// controls.js
import { closeDeck, startAutoPlay, stopAutoPlay, loadNextChunk } from './deck.js';
import { openMetadataModal, closeMetadataModal } from './metadata.js';
import { isMobile } from './utils.js';
import { state } from './state.js';

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


export function setupEventHandlers(container) {
    setDeckActive(true);
    
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

    // Control buttons
    const controlButtons = container.querySelectorAll('.image-deck-control-btn');

    controlButtons.forEach(button => {
        eventManager.add(button, 'click', (e) => {
            const action = button.dataset.action;
            const swiper = state.getSwiper();

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
    });

    const swiper = state.getSwiper();
    if (swiper) {
        const slideChangeListener = function() {
            updateGalleryStateClass();
        };
        swiper.on('slideChangeTransitionEnd', slideChangeListener);
        storeElementData(container, { slideChangeListener });
        
        setTimeout(() => {
            updateGalleryStateClass();
        }, 0);
    }

    // Keyboard controls
    const keyboardHandler = handleKeyboard;
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

// Keyboard handler
function handleKeyboard(e) {
    if (!isDeckActive) return;
    
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
    

    const swiper = state.getSwiper();
    if (swiper) {
    }
}
