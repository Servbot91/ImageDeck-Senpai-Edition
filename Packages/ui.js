// ui/ui.js
import { createLaunchButton, cleanupButton, retryCreateButton } from './button.js';

export function initialize() {
    console.log('[Image Deck] Initializing...');

    // Wait for Swiper to load
    if (typeof Swiper === 'undefined') {
        console.error('[Image Deck] Swiper not loaded!');
        return;
    }

    // Create launch button on relevant pages
    retryCreateButton();

    // Initialize preview button hijacking
    initPreviewObserver();

    // Watch for DOM changes to detect when React renders new content
    let debounceTimer;
    const observer = new MutationObserver((mutations) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            // Check if button exists and we're still on a valid page
            const hasButton = document.querySelector('.image-deck-launch-btn');
            const shouldHaveButton = 
                document.querySelectorAll('img[src*="/image/"]').length > 0 ||
                document.querySelectorAll('.gallery-cover img, .gallery-card img').length > 0;

            if (!hasButton && shouldHaveButton) {
                createLaunchButton();
            }
        }, 300);
    });
    // Observe the main content area for changes
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
                if (node.nodeType === 1) { // Element node
                    // Handle both direct matches and child queries
                    let previewButtons = [];
                    
                    // Look for buttons with magnifying glass SVG (preview buttons)
                    const isPreviewButton = (el) => {
                        if (el.tagName !== 'BUTTON') return false;
                        const svg = el.querySelector('svg');
                        return svg && svg.dataset.icon === 'magnifying-glass';
                    };
                    
                    // Check if the node itself is a preview button
                    if (isPreviewButton(node)) {
                        previewButtons.push(node);
                    }
                    
                    // Check for preview buttons within the node
                    if (node.querySelectorAll) {
                        const buttons = node.querySelectorAll('button');
                        buttons.forEach(btn => {
                            if (isPreviewButton(btn)) {
                                previewButtons.push(btn);
                            }
                        });
                    }
                    
                    previewButtons.forEach((button) => {
                        // Make sure we haven't already processed this button
                        if (!button.dataset.hijacked) {
                            button.dataset.hijacked = 'true';
                            
                            // Remove existing event listeners by cloning
                            const newButton = button.cloneNode(true);
                            button.parentNode.replaceChild(newButton, button);
                            
                            // Add our custom click handler
                            newButton.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('[Image Deck] Preview button clicked (dynamic)');
                                
                                // Find the image associated with this preview button
                                const card = newButton.closest('.image-card, .grid-card');
                                const img = card?.querySelector('img[src*="/image/"]');
                                
                                let targetImageId = null;
                                if (img) {
                                    const idMatch = img.src.match(/\/image\/(\d+)/);
                                    if (idMatch) {
                                        targetImageId = idMatch[1];
                                    }
                                }
                                
                                // Pass the target image ID to openDeck
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
    
    // Also process existing preview buttons on page load
    processExistingPreviewButtons();
}



function processExistingPreviewButtons() {
    // Look for all buttons with magnifying glass icon
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        const svg = button.querySelector('svg');
        if (svg && svg.dataset.icon === 'magnifying-glass' && !button.dataset.hijacked) {
            button.dataset.hijacked = 'true';
            
            // Remove existing event listeners by cloning
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            // Add our custom click handler
            newButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Image Deck] Preview button clicked');
                
                // Find the image associated with this preview button
                const card = newButton.closest('.image-card, .grid-card');
                const img = card?.querySelector('img[src*="/image/"]');
                
                let targetImageId = null;
                if (img) {
                    const idMatch = img.src.match(/\/image\/(\d+)/);
                    if (idMatch) {
                        targetImageId = idMatch[1];
                    }
                }
                
                // Pass the target image ID to openDeck
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
                
                // Find the image associated with this preview button
                const card = previewContainer.closest('.image-card, .grid-card');
                const img = card?.querySelector('img[src*="/image/"]');
                
                let targetImageId = null;
                if (img) {
                    const idMatch = img.src.match(/\/image\/(\d+)/);
                    if (idMatch) {
                        targetImageId = idMatch[1];
                    }
                }
                
                // Pass the target image ID to openDeck
                import('./deck.js').then(module => {
                    module.openDeck(targetImageId);
                });
            });
        }
    }
}

export { createLaunchButton, cleanupButton, retryCreateButton } from './button.js';
export { openDeck, closeDeck, startAutoPlay, stopAutoPlay, loadNextChunk } from './deck.js';
