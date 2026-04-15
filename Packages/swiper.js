// swiper.js
import { GALLERY_ICON_SVG } from './constants.js';
import { state } from './state.js';

const EFFECT_CONFIGS = {
    cards: () => ({ cardsEffect: { slideShadows: false, rotate: true, perSlideRotate: 2, perSlideOffset: 8 } }),
    coverflow: (depth) => ({ coverflowEffect: { rotate: 30, stretch: 0, depth: Math.min(depth, 100), modifier: 1, slideShadows: false } }),
    flip: () => ({ flipEffect: { slideShadows: false, limitRotation: true } }),
    cube: () => ({ cubeEffect: { shadow: false, slideShadows: false } }),
    fade: () => ({ fadeEffect: { crossFade: true }, speed: 200 } ),
    default: () => ({ spaceBetween: 20, slidesPerView: 1 })
};

export function getEffectOptions(effect, pluginConfig) {
    const configFn = EFFECT_CONFIGS[effect] || EFFECT_CONFIGS.default;
    return configFn(pluginConfig.effectDepth);
}

// Memoized slide template function
const memoizedGetSlideTemplate = (() => {
    const cache = new Map();
    const TTL = 300000; // 5 minutes
    
    return (img, contextInfo, isEager = false) => {
        const cacheKey = `${img.id || img.url}_${JSON.stringify(contextInfo)}_${isEager}`;
        const now = Date.now();
        
        if (cache.has(cacheKey)) {
            const cached = cache.get(cacheKey);
            if (now - cached.timestamp < TTL) {
                return cached.result;
            }
        }
        
        const result = getSlideTemplateImpl(img, contextInfo, isEager);
        cache.set(cacheKey, { result, timestamp: now });
        return result;
    };
})();

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
        <div class="swiper-zoom-container">
            <img src="${fullSrc}" alt="${title}" decoding="async" loading="${loading}" 
                 style="max-width: 100%; height: auto; display: block; margin: 0 auto;" />
        </div>`;
};

export function initSwiper(container, images, pluginConfig, updateUICallback, savePositionCallback, contextInfo) {
    const swiperEl = container.querySelector('.swiper');
    if (!swiperEl || swiperEl.swiper) return swiperEl?.swiper;

    const isLooped = false;
    const effectOptions = getEffectOptions(pluginConfig.transitionEffect, pluginConfig);

    const swiperConfig = {
        effect: pluginConfig.transitionEffect,
        centeredSlides: true,
        slidesPerView: 1,
        initialSlide: 0,
        
        zoom: {
            maxRatio: 3,
            minRatio: 1,
            toggle: true,
            containerClass: 'swiper-zoom-container',
            zoomedSlideClass: 'swiper-slide-zoomed'
        },
        doubleTapZoom: true,
        doubleTapZoomRatio: 2,
        
        centeredSlidesBounds: true,
        centerInsufficientSlides: true,
		touchEventsTarget: 'container',
        touchRatio: 1,
        touchAngle: 45,
        simulateTouch: true,
        shortSwipes: true,
        longSwipes: true,
        longSwipesRatio: 0.5,
        longSwipesMs: 300,
        
        passiveListeners: false,
                
        loop: isLooped,
        loopedSlides: 2,
        loopPreventsSliding: false,
        
        virtual: {
            slides: images.map(img => memoizedGetSlideTemplate(img, contextInfo, false)),
            cache: true,
            addSlidesBefore: 3,
            addSlidesAfter: 3,
            renderSlide: (slideContent, index) => {
                return `<div class="swiper-slide" data-index="${index}">${slideContent || ''}</div>`;
            }
        },
        ...effectOptions,
        on: {
            click(s, event) {
                const zoomContainer = event.target.closest('.swiper-zoom-container[data-type="gallery"]');
                if (zoomContainer?.dataset.url) {
                    window.open(zoomContainer.dataset.url, '_blank');
                }
            },
            slideChange() {
                updateUICallback?.(container);
                savePositionCallback?.();
            },
            slideChangeTransitionEnd() {
                const total = this.virtual?.slides?.length || this.slides.length;
                if (total > 0 && this.activeIndex >= total - 3) {
                    const nextBtn = document.querySelector('[data-action="next-chunk"]');
                    if (nextBtn && !nextBtn.disabled) {
                        nextBtn.click();
                    }
                }
            },
            doubleTap: function(swiper, event) {
                console.log('[Image Deck] Double tap detected, scale:', swiper.zoom.scale);
                if (swiper.zoom) {
                    const activeSlide = swiper.slides[swiper.activeIndex];
                    if (activeSlide) {
                        const zoomContainer = activeSlide.querySelector('.swiper-zoom-container');
                        if (zoomContainer && zoomContainer.dataset.type !== 'gallery') {
                            if (swiper.zoom.scale <= 1) {
                                swiper.zoom.in(swiper.params.doubleTapZoomRatio || 2);
                                console.log('[Image Deck] Zooming in to ratio:', swiper.params.doubleTapZoomRatio || 2);
                            } else {
                                swiper.zoom.out();
                                console.log('[Image Deck] Zooming out');
                            }
                        }
                    }
                }
            },
            touchStart: function(swiper, event) {
                console.log('[Image Deck] Touch start');
            },
            touchEnd: function(swiper, event) {
                console.log('[Image Deck] Touch end');
            }
        }
    };

    const swiper = new Swiper(swiperEl, swiperConfig);
    
    // Store swiper in state
    state.setSwiper(swiper);
    state.setImages(images);
    
    const loader = container.querySelector('.image-deck-loading');
    if (loader) loader.style.display = 'none';

    return swiper;
}
