// Detect mobile device
export const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     window.innerWidth < 768 ||
                     ('ontouchstart' in window);

// Create imageCache in utils.js scope
const imageCache = new Map();

// Optimized image preloader
export function preloadImage(src, priority = false) {
    if (imageCache.has(src)) {
        return Promise.resolve(imageCache.get(src));
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = 'async';
        img.loading = priority ? 'eager' : 'lazy';

        img.onload = () => {
            imageCache.set(src, img);
            resolve(img);
        };
        img.onerror = reject;
        img.src = src;
    });
}

// Export the cache for debugging purposes
export function getImageCache() {
    return imageCache;
}

// Export function to clear cache if needed
export function clearImageCache() {
    imageCache.clear();
}

export function memoize(fn, ttl = 300000) { // 5 minutes default
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

// Example usage for expensive operations:
export const getSlideTemplate = memoize((img, contextInfo, isEager = false) => {
    // Your existing getSlideTemplate logic here
    // This will cache results for identical inputs
}, 600000); // 10 minutes cache

// For GraphQL operations:
export const fetchImageMetadata = memoize(async (imageId) => {
    // Your existing fetch logic
    // Will cache results for 5 minutes by default
}, 300000);