// ui/ui.js
import { createLaunchButton, cleanupButton, retryCreateButton } from './button.js';
import { searchTags, applyGalleryTagFilter, clearGalleryTagFilter } from './graphql.js';

function showGalleryTagFilter() {
    // Remove existing modal if present
    const existingModal = document.querySelector('.gallery-tag-filter-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal for tag selection
    const modal = document.createElement('div');
    modal.className = 'gallery-tag-filter-modal';
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #2d2d2d;
        border: 1px solid #444;
        border-radius: 8px;
        padding: 20px;
        z-index: 10000;
        min-width: 300px;
        max-width: 500px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        max-height: 80vh;
        overflow: hidden;
    `;
    
    modal.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h4>Filter Galleries by Tag</h4>
            <button class="close-filter-modal" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">×</button>
        </div>
        <input type="text" class="tag-search-input" placeholder="Search tags..." style="width: 100%; padding: 8px; margin-bottom: 15px; background: #333; border: 1px solid #555; color: white; border-radius: 4px;">
        <div class="tag-list" style="max-height: 300px; overflow-y: auto; margin-bottom: 15px;"></div>
        <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;">
            <button class="clear-tag-filter btn btn-secondary" style="padding: 6px 12px;">Clear</button>
            <button class="apply-tag-filter btn btn-primary" style="padding: 6px 12px;">Apply Filter</button>
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
    const searchInput = modal.querySelector('.tag-search-input');
    const tagList = modal.querySelector('.tag-list');
    let selectedTags = [];
    
    // Load currently applied tags if any
    const currentFilter = sessionStorage.getItem('galleryTagFilter');
    if (currentFilter) {
        try {
            selectedTags = JSON.parse(currentFilter);
        } catch (e) {
            console.error('Error parsing current filter:', e);
        }
    }
    
    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        if (query.length >= 2) {
            try {
                const tags = await searchTags(query);
                renderTagList(tags, tagList, selectedTags);
            } catch (error) {
                console.error('Error searching tags:', error);
                tagList.innerHTML = '<div style="color: #ff6b6b; padding: 8px;">Error loading tags</div>';
            }
        } else {
            tagList.innerHTML = '<div style="color: #999; padding: 8px; text-align: center;">Type at least 2 characters to search</div>';
        }
    });
    
    // Trigger initial search if there's text
    if (searchInput.value.trim().length >= 2) {
        searchInput.dispatchEvent(new Event('input'));
    } else {
        tagList.innerHTML = '<div style="color: #999; padding: 8px; text-align: center;">Type at least 2 characters to search</div>';
    }
    
    // Apply filter button
    const applyBtn = modal.querySelector('.apply-tag-filter');
    applyBtn.addEventListener('click', () => {
        if (selectedTags.length > 0) {
            applyGalleryTagFilter(selectedTags);
        } else {
            // Clear filter if no tags selected
            clearGalleryTagFilter();
        }
        modal.remove();
    });
    
    // Clear filter button
    const clearBtn = modal.querySelector('.clear-tag-filter');
    clearBtn.addEventListener('click', () => {
        selectedTags = [];
        searchInput.value = '';
        tagList.innerHTML = '<div style="color: #999; padding: 8px; text-align: center;">Type at least 2 characters to search</div>';
        clearGalleryTagFilter();
    });
}

function renderTagList(tags, container, selectedTags) {
    if (!tags || tags.length === 0) {
        container.innerHTML = '<div style="color: #999; padding: 8px; text-align: center;">No tags found</div>';
        return;
    }
    
    container.innerHTML = tags.map(tag => `
        <div class="tag-item" style="padding: 8px; cursor: pointer; display: flex; align-items: center; border-radius: 4px; margin-bottom: 2px; ${selectedTags.includes(tag.id) ? 'background: #444;' : 'background: #333;'}">
            <input type="checkbox" id="tag-${tag.id}" ${selectedTags.includes(tag.id) ? 'checked' : ''} style="margin-right: 8px; cursor: pointer;">
            <label for="tag-${tag.id}" style="cursor: pointer; flex-grow: 1;">${tag.name}</label>
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

// Export initialize function for main.js
export function initialize() {
    console.log('[Image Deck] Initializing...');

    // Wait for Swiper to load
    if (typeof Swiper === 'undefined') {
        console.error('[Image Deck] Swiper not loaded!');
        return;
    }

    // Create launch button on relevant pages
    retryCreateButton();

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
            
            // Add gallery filter button on gallery pages
            if (window.location.pathname.startsWith('/galleries')) {
                addGalleryFilterButton();
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
                    
                    // Check if the node itself is a preview button
                    if (node.matches && node.matches('.preview-button')) {
                        previewButtons.push(node);
                    }
                    
                    // Check for preview buttons within the node
                    if (node.querySelectorAll) {
                        previewButtons = [...previewButtons, ...node.querySelectorAll('.preview-button')];
                    }
                    
                    previewButtons.forEach((previewContainer) => {
                        // Make sure we haven't already processed this button
                        if (!previewContainer.dataset.hijacked) {
                            previewContainer.dataset.hijacked = 'true';
                            
                            // Find the actual button inside the container
                            const button = previewContainer.querySelector('button');
                            if (button) {
                                // Remove existing event listeners by cloning
                                const newButton = button.cloneNode(true);
                                button.parentNode.replaceChild(newButton, button);
                                
                                // Add our custom click handler
                                newButton.addEventListener('click', (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('[Image Deck] Preview button clicked (dynamic)');
                                    
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
    document.querySelectorAll('.preview-button').forEach(processPreviewButton);
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
