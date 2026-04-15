// state.js
class ImageDeckState {
    constructor() {
        this.swiper = null;
        this.images = [];
        this.config = null;
        this.context = null;
        this.isPlaying = false;
        this.eventCallbacks = new Map();
    }

    setSwiper(swiper) {
        this.swiper = swiper;
    }

    getSwiper() {
        return this.swiper;
    }

    setImages(images) {
        this.images = images;
    }

    getImages() {
        return this.images;
    }

    on(event, callback) {
        if (!this.eventCallbacks.has(event)) {
            this.eventCallbacks.set(event, []);
        }
        this.eventCallbacks.get(event).push(callback);
    }

    emit(event, data) {
        const callbacks = this.eventCallbacks.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }
}

export const state = new ImageDeckState();

