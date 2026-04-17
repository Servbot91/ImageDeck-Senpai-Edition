import { createLaunchButton, cleanupButton, retryCreateButton } from './button.js';

export function initialize() {
    console.log('[Image Deck] Initializing...');
    if (typeof Swiper === 'undefined') {
        console.error('[Image Deck] Swiper not loaded!');
        return;
    }
    retryCreateButton();
    initPreviewObserver();
    let debounceTimer;
    const observer = new MutationObserver((mutations) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const hasButton = document.querySelector('.image-deck-launch-btn');
            const shouldHaveButton = 
                document.querySelectorAll('img[src*="/image/"]').length > 0 ||
                document.querySelectorAll('.gallery-cover img, .gallery-card img').length > 0;

            if (!hasButton && shouldHaveButton) {
                createLaunchButton();
            }
        }, 300);
    });
    const mainContent = document.querySelector('.main-content') ||
                      document.querySelector('[role="main"]') ||
                      document.body;

    observer.observe(mainContent, {
        childList: true,
        subtree: true
    });

    console.log('[Image Deck] Initialized');
}
function initPreviewObserver() {
    const previewObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { 
                    let previewButtons = [];
                    const isPreviewButton = (el) => {
                        if (el.tagName !== 'BUTTON') return false;
                        const svg = el.querySelector('svg');
                        return svg && svg.dataset.icon === 'magnifying-glass';
                    };

                    if (isPreviewButton(node)) {
                        previewButtons.push(node);
                    }

                    if (node.querySelectorAll) {
                        const buttons = node.querySelectorAll('button');
                        buttons.forEach(btn => {
                            if (isPreviewButton(btn)) {
                                previewButtons.push(btn);
                            }
                        });
                    }
                    
                    previewButtons.forEach((button) => {
                        if (!button.dataset.hijacked) {
                            button.dataset.hijacked = 'true';
                            const newButton = button.cloneNode(true);
                            button.parentNode.replaceChild(newButton, button);
                            newButton.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('[Image Deck] Preview button clicked (dynamic)');
                                const card = newButton.closest('.image-card, .grid-card');
                                const img = card?.querySelector('img[src*="/image/"]');
                                let targetImageId = null;
                                if (img) {
                                    const idMatch = img.src.match(/\/image\/(\d+)/);
                                    if (idMatch) {
                                        targetImageId = idMatch[1];
                                    }
                                }
                                import('./deck.js').then(module => {
                                    module.openDeck(targetImageId);
                                });
                            });
                        }
                    });
                }
            });
        });
    });
    
    previewObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    processExistingPreviewButtons();
}

function processExistingPreviewButtons() {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        const svg = button.querySelector('svg');
        if (svg && svg.dataset.icon === 'magnifying-glass' && !button.dataset.hijacked) {
            button.dataset.hijacked = 'true';
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Image Deck] Preview button clicked');
                const card = newButton.closest('.image-card, .grid-card');
                const img = card?.querySelector('img[src*="/image/"]');
                let targetImageId = null;
                if (img) {
                    const idMatch = img.src.match(/\/image\/(\d+)/);
                    if (idMatch) {
                        targetImageId = idMatch[1];
                    }
                }
                import('./deck.js').then(module => {
                    module.openDeck(targetImageId);
                });
            });
        }
    });
}


function processPreviewButton(previewContainer) {
    if (!previewContainer.dataset.hijacked) {
        previewContainer.dataset.hijacked = 'true';
        
        const button = previewContainer.querySelector('button');
        if (button) {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            newButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Image Deck] Preview button clicked');
                const card = previewContainer.closest('.image-card, .grid-card');
                const img = card?.querySelector('img[src*="/image/"]');
                
                let targetImageId = null;
                if (img) {
                    const idMatch = img.src.match(/\/image\/(\d+)/);
                    if (idMatch) {
                        targetImageId = idMatch[1];
                    }
                }
                import('./deck.js').then(module => {
                    module.openDeck(targetImageId);
                });
            });
        }
    }
}

function createModeToggleButton(container) {
    const topBar = container.querySelector('.image-deck-topbar');
    if (!topBar) return;
    const modeIndicator = document.createElement('div');
    modeIndicator.className = 'mode-indicator';
    modeIndicator.style.cssText = `
        position: absolute;
        left: 20px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 14px;
        font-weight: bold;
        z-index: 11;
        display: flex;
        align-items: center;
        gap: 5px;
    `;
    const isGalleryMode = window.location.pathname === '/galleries' || 
                          window.location.pathname.startsWith('/galleries/');
    updateModeDisplay(modeIndicator, isGalleryMode);
    const counter = topBar.querySelector('.image-deck-counter');
    if (counter && counter.parentNode) {
        counter.parentNode.insertBefore(modeIndicator, counter);
    }
    modeIndicator.addEventListener('click', async () => {
        const currentMode = modeIndicator.textContent.includes('Gallery Mode') ? 'gallery' : 'image';
        const newMode = currentMode === 'gallery' ? 'image' : 'gallery';
        updateModeDisplay(modeIndicator, newMode === 'gallery');
        import('./deck.js').then(module => {
            module.closeDeck();
            setTimeout(() => {
                module.openDeck();
            }, 100);
        });
    });
}
function updateModeDisplay(element, isGalleryMode) {
    element.innerHTML = isGalleryMode ? 
        '🖼️ Gallery Mode Enabled🖼️' : 
        '📷 Image Mode Enabled📷';
}

export { createLaunchButton, cleanupButton, retryCreateButton } from './button.js';
export { openDeck, closeDeck, startAutoPlay, stopAutoPlay, loadNextChunk } from './deck.js';
