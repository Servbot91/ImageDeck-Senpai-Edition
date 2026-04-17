
export const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     window.innerWidth < 768 ||
                     ('ontouchstart' in window);
class LRUCache {
    constructor(maxSize = 20, ttl = 5 * 60 * 1000) { 
        this.maxSize = maxSize;
        this.ttl = ttl;
        this.cache = new Map();
    }

    set(key, value) {
        const now = Date.now();

        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            value,
            timestamp: now
        });
    }

    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return undefined;

        const now = Date.now();
        if (now - entry.timestamp > this.ttl) {
            this.cache.delete(key); 
            return undefined;
        }

        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.value;
    }

    has(key) {
        return this.get(key) !== undefined;
    }

    clear() {
        this.cache.clear();
    }

    size() {
        return this.cache.size;
    }
}

const imageCache = new LRUCache(20, 5 * 60 * 1000); 

export function preloadImage(src, priority = false) {
    const shouldCache = priority || imageCache.size() < 20;

    if (shouldCache && imageCache.has(src)) {
        return Promise.resolve(imageCache.get(src));
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = 'async';
        img.loading = priority ? 'eager' : (isMobile ? 'lazy' : 'lazy');

        img.onload = () => {
            if (shouldCache) {
                imageCache.set(src, img);
            }
            resolve(img);
        };
        img.onerror = reject;
        img.src = src;
    });
}

export function handleError(context, error, fallbackValue = null) {
    console.error(`[Image Deck] ${context}:`, error);
    return fallbackValue;
}

export async function safeFetch(url, options, context) {
    try {
        const response = await fetch(url, options);
        return response;
    } catch (error) {
        return handleError(context, error);
    }
}

export function getImageCache() {
    return imageCache.cache; 
}

export function clearImageCache() {
    imageCache.clear();
}

export function memoize(fn, ttl = 300000) {
    const cache = new Map();

    return function(...args) {
        const key = JSON.stringify(args);
        const now = Date.now();

        if (cache.has(key)) {
            const { value, timestamp } = cache.get(key);
            if (now - timestamp < ttl) {
                return value;
            }
        }

        const result = fn.apply(this, args);
        cache.set(key, { value: result, timestamp: now });
        return result;
    };
}

export const getSlideTemplate = memoize((img, contextInfo, isEager = false) => {

}, 600000);

export const fetchImageMetadata = memoize(async (imageId) => {

}, 300000);
