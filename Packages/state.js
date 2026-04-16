class ImageDeckState {
    constructor() {
        this.state = {
            swiper: null,
            images: [],
            config: null,
            context: null,
            isPlaying: false,
            currentChunkPage: 1,
            chunkSize: 50,
            totalImageCount: 0,
            totalPages: 0,
            pluginConfig: null,
            autoPlayInterval: null,
            isAutoPlaying: false,
            loadingQueue: [],
            storedContextInfo: null
        };
        this.eventCallbacks = new Map();
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
    }

    getState() {
        return { ...this.state };
    }

    // Individual getters/setters for backward compatibility
    setSwiper(swiper) {
        this.setState({ swiper });
    }

    getSwiper() {
        return this.state.swiper;
    }

    setImages(images) {
        this.setState({ images });
    }

    getImages() {
        return this.state.images;
    }

    // ... other getters/setters

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
export const getState = () => state.getState();
export const setState = (newState) => state.setState(newState);
