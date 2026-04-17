// ui/metadata.js
import { fetchImageMetadata, updateImageMetadata, updateImageTags, searchTags, fetchGalleryMetadata, updateGalleryMetadata } from './graphql.js';

let currentMetadata = null;
let currentSwiperRef = null; // Reference to current swiper instance

export function setCurrentSwiper(swiper) {
    currentSwiperRef = swiper;
}


export async function openMetadataModal() {
    if (!currentSwiperRef) return;

    const currentIndex = currentSwiperRef.activeIndex;
    const currentImage = window.currentImages?.[currentIndex];

    if (!currentImage || !currentImage.id) return;

    const modal = document.querySelector('.image-deck-metadata-modal');
    const body = document.querySelector('.image-deck-metadata-body');
    const header = document.querySelector('.image-deck-metadata-header h3');

    if (!modal || !body || !header) return;

    // Show loading state
    body.innerHTML = '<div class="metadata-loading">Loading...</div>';
    modal.classList.add('active');

    // Determine if current item is a gallery based on data properties
    // This is more reliable than DOM inspection for virtual slides
    const isGallery = currentImage.isGallery || 
                     currentImage.url || 
                     (currentImage.image_count !== undefined) ||
                     (currentImage.type === 'gallery');

    if (isGallery) {
        // Update header for gallery
        header.textContent = 'Gallery Details';
        
        // Extract gallery ID from URL or use currentImage.id
        let galleryId = currentImage.id;
        if (currentImage.url) {
            const urlMatch = currentImage.url.match(/\/galleries\/(\d+)/);
            if (urlMatch) {
                galleryId = urlMatch[1];
            }
        }
        currentMetadata = await fetchGalleryMetadata(galleryId);
    } else {
        // Update header for image
        header.textContent = 'Image Details';
        currentMetadata = await fetchImageMetadata(currentImage.id);
    }

    if (!currentMetadata) {
        body.innerHTML = '<div class="metadata-error">Failed to load metadata</div>';
        return;
    }

    // Populate modal based on type
    if (isGallery) {
        populateGalleryMetadataModal(currentMetadata);
    } else {
        populateImageMetadataModal(currentMetadata);
    }
}


function populateGalleryMetadataModal(metadata) {
    const body = document.querySelector('.image-deck-metadata-body');
    if (!body) return;

    body.innerHTML = `
        <div class="metadata-section metadata-file-info">
            <div class="metadata-filename" title="${metadata.title || 'Untitled'}">${metadata.title || 'Untitled'}</div>
            <a href="${metadata.url}" target="_blank" class="metadata-link" title="Open gallery page in new tab">
                View in Stash →
            </a>
        </div>

        <div class="metadata-section">
            <label>Title</label>
            <input type="text" class="metadata-title" value="${metadata.title || ''}" placeholder="Enter title...">
        </div>

        <div class="metadata-section">
            <label>Details</label>
            <textarea class="metadata-details" placeholder="Enter details...">${metadata.details || ''}</textarea>
        </div>

        <!-- TAGGER SECTION -->
        <div class="metadata-section">
            <label>Tags</label>
            <div class="metadata-tags">
                ${metadata.tags ? metadata.tags.map(tag =>
                    `<span class="metadata-tag" data-tag-id="${tag.id}">
                        ${tag.name}
                        <button class="metadata-tag-remove" data-tag-id="${tag.id}">×</button>
                    </span>`
                ).join('') : ''}
            </div>
            <input type="text" class="metadata-tag-search" placeholder="Search tags...">
            <div class="metadata-tag-results"></div>
        </div>

        <div class="metadata-section">
            <label>Info</label>
            <div class="metadata-info">
                ${metadata.date ? `<div><strong>Date:</strong> ${metadata.date}</div>` : ''}
                ${metadata.image_count !== undefined ? `<div><strong>Image Count:</strong> ${metadata.image_count}</div>` : ''}
                <div><strong>Created:</strong> ${metadata.created_at || 'Unknown'}</div>
                <div><strong>Updated:</strong> ${metadata.updated_at || 'Unknown'}</div>
                ${metadata.rating100 ? `<div><strong>Rating:</strong> ${metadata.rating100}/100</div>` : ''}
                <div><strong>Organized:</strong> ${metadata.organized ? 'Yes' : 'No'}</div>
            </div>
        </div>

        ${metadata.urls && metadata.urls.length > 0 ? `
        <div class="metadata-section">
            <label>URLs</label>
            <div class="metadata-urls">
                ${metadata.urls.map(url => 
                    `<div><a href="${url}" target="_blank">${url}</a></div>`
                ).join('')}
            </div>
        </div>` : ''}

        <div class="metadata-actions">
            <button class="metadata-save-btn">Save Changes</button>
        </div>
    `;

    setupGalleryMetadataHandlers(metadata);
}

function setupGalleryMetadataHandlers(metadata) {
    const body = document.querySelector('.image-deck-metadata-body');
    if (!body) return;

    const saveBtn = body.querySelector('.metadata-save-btn');
    if (!saveBtn) return;

    // Store original tag IDs for comparison later
    const originalTagIds = metadata.tags ? metadata.tags.map(tag => tag.id) : [];
    let currentTagIds = [...originalTagIds];

    // Tag search functionality
    const tagSearch = body.querySelector('.metadata-tag-search');
    const tagResults = body.querySelector('.metadata-tag-results');
    let searchTimeout;

    if (tagSearch) {
        tagSearch.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();

            if (query.length < 2) {
                tagResults.innerHTML = '';
                return;
            }

            searchTimeout = setTimeout(async () => {
                const tags = await searchTags(query);
                tagResults.innerHTML = tags.map(tag =>
                    `<div class="metadata-tag-result" data-tag-id="${tag.id}" data-tag-name="${tag.name}">
                        ${tag.name}
                    </div>`
                ).join('');

                // Add click handlers for results
                tagResults.querySelectorAll('.metadata-tag-result').forEach(result => {
                    result.addEventListener('click', (e) => {
                        const tagId = e.target.dataset.tagId;
                        const tagName = e.target.dataset.tagName;

                        // Check if tag is already added
                        if (currentTagIds.includes(tagId)) {
                            return;
                        }

                        // Add tag to list
                        const tagsContainer = body.querySelector('.metadata-tags');
                        const tagHtml = `<span class="metadata-tag" data-tag-id="${tagId}">
                            ${tagName}
                            <button class="metadata-tag-remove" data-tag-id="${tagId}">×</button>
                        </span>`;
                        tagsContainer.insertAdjacentHTML('beforeend', tagHtml);

                        // Add to current tags array
                        currentTagIds.push(tagId);

                        // Setup remove handler for new tag
                        const newTag = tagsContainer.lastElementChild;
                        newTag.querySelector('.metadata-tag-remove').addEventListener('click', (e) => {
                            const removeTagId = e.target.dataset.tagId;
                            e.target.closest('.metadata-tag').remove();
                            // Remove from current tags array
                            currentTagIds = currentTagIds.filter(id => id !== removeTagId);
                        });

                        // Clear search
                        tagSearch.value = '';
                        tagResults.innerHTML = '';
                    });
                });
            }, 300);
        });
    }

    // Tag removal
    body.querySelectorAll('.metadata-tag-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tagId = e.target.dataset.tagId;
            const tagEl = e.target.closest('.metadata-tag');
            if (tagEl) {
                tagEl.remove();
                // Remove from current tags array
                currentTagIds = currentTagIds.filter(id => id !== tagId);
            }
        });
    });

    saveBtn.addEventListener('click', async () => {
        const title = body.querySelector('.metadata-title').value;
        const details = body.querySelector('.metadata-details').value;

        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;

        try {
            // Update gallery metadata (title, details)
            const result = await updateGalleryMetadata(metadata.id, { title, details });
            
            if (!result) {
                throw new Error('Failed to update gallery metadata');
            }

            // Check if tags have changed
            const tagsChanged = JSON.stringify(currentTagIds.sort()) !== JSON.stringify(originalTagIds.sort());
            
            if (tagsChanged) {
                // Update gallery tags directly with a separate mutation
                await updateGalleryTagsSeparately(metadata.id, currentTagIds);
            }

            saveBtn.textContent = 'Saved ✓';
            
            // Update the filename display
            const filenameEl = body.querySelector('.metadata-filename');
            if (filenameEl) {
                filenameEl.textContent = title || 'Untitled';
            }
            
            setTimeout(() => {
                saveBtn.textContent = 'Save Changes';
                saveBtn.disabled = false;
            }, 2000);
            
        } catch (error) {
            console.error('[Image Deck] Error updating gallery metadata:', error);
            saveBtn.textContent = 'Error!';
            setTimeout(() => {
                saveBtn.textContent = 'Save Changes';
                saveBtn.disabled = false;
            }, 2000);
        }
    });
}

async function updateGalleryTagsSeparately(galleryId, tagIds) {
    try {
        const mutation = `mutation GalleryUpdate($input: GalleryUpdateInput!) {
            galleryUpdate(input: $input) {
                id
                title
                tags {
                    id
                    name
                }
            }
        }`;

        const input = { 
            id: galleryId, 
            tag_ids: tagIds 
        };

        const response = await fetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: mutation, variables: { input } })
        });

        const data = await response.json();
        
        if (data.errors) {
            throw new Error(data.errors[0].message);
        }

        console.log('[Image Deck] Gallery tags updated successfully');
        return data?.data?.galleryUpdate || null;
    } catch (error) {
        console.error('[Image Deck] Error updating gallery tags:', error);
        throw error;
    }
}

export function closeMetadataModal() {
    const modal = document.querySelector('.image-deck-metadata-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    currentMetadata = null;

    updateControlVisibility(true);
}
function populateImageMetadataModal(metadata) {
    const body = document.querySelector('.image-deck-metadata-body');
    if (!body) return;

    const rating = metadata.rating100 ? metadata.rating100 / 20 : 0; // Convert to 5-star scale
    const filename = metadata.files && metadata.files.length > 0 ? metadata.files[0].basename : 'Unknown';

    body.innerHTML = `
        <div class="metadata-section metadata-file-info">
            <div class="metadata-filename" title="${filename}">${filename}</div>
            <a href="/images/${metadata.id}" target="_blank" class="metadata-link" title="Open image page in new tab">
                View in Stash →
            </a>
        </div>

        <div class="metadata-section">
            <label>Rating</label>
            <div class="metadata-rating">
                ${[1, 2, 3, 4, 5].map(star =>
                    `<button class="metadata-star ${star <= rating ? 'active' : ''}" data-rating="${star}">★</button>`
                ).join('')}
            </div>
        </div>

        <div class="metadata-section">
            <label>Title</label>
            <input type="text" class="metadata-title" value="${metadata.title || ''}" placeholder="Enter title...">
        </div>

        <div class="metadata-section">
            <label>Details</label>
            <textarea class="metadata-details" placeholder="Enter details...">${metadata.details || ''}</textarea>
        </div>

        <div class="metadata-section">
            <label>Tags</label>
            <div class="metadata-tags">
                ${metadata.tags.map(tag =>
                    `<span class="metadata-tag" data-tag-id="${tag.id}">
                        ${tag.name}
                        <button class="metadata-tag-remove" data-tag-id="${tag.id}">×</button>
                    </span>`
                ).join('')}
            </div>
            <input type="text" class="metadata-tag-search" placeholder="Search tags...">
            <div class="metadata-tag-results"></div>
        </div>

        <div class="metadata-section">
            <label>Info</label>
            <div class="metadata-info">
                ${metadata.performers.length > 0 ? `<div><strong>Performers:</strong> ${metadata.performers.map(p => p.name).join(', ')}</div>` : ''}
                ${metadata.studio ? `<div><strong>Studio:</strong> ${metadata.studio.name}</div>` : ''}
                ${metadata.date ? `<div><strong>Date:</strong> ${metadata.date}</div>` : ''}
                ${metadata.photographer ? `<div><strong>Photographer:</strong> ${metadata.photographer}</div>` : ''}
                <div><strong>Views:</strong> ${metadata.o_counter || 0}</div>
            </div>
        </div>

        <div class="metadata-actions">
            <button class="metadata-save-btn">Save Changes</button>
            <button class="metadata-organized-btn ${metadata.organized ? 'active' : ''}">
                ${metadata.organized ? 'Organized ✓' : 'Mark Organized'}
            </button>
        </div>
    `;

    // Setup event handlers for the modal
    setupMetadataHandlers(metadata);
}

function setupMetadataHandlers(metadata) {
    const body = document.querySelector('.image-deck-metadata-body');

    // Rating stars
    body.querySelectorAll('.metadata-star').forEach(star => {
        star.addEventListener('click', (e) => {
            const rating = parseInt(e.target.dataset.rating);
            body.querySelectorAll('.metadata-star').forEach((s, i) => {
                s.classList.toggle('active', i < rating);
            });
        });
    });

    // Tag removal
    body.querySelectorAll('.metadata-tag-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tagId = e.target.dataset.tagId;
            const tagEl = e.target.closest('.metadata-tag');
            if (tagEl) tagEl.remove();
        });
    });

    // Tag search
    const tagSearch = body.querySelector('.metadata-tag-search');
    const tagResults = body.querySelector('.metadata-tag-results');
    let searchTimeout;

    tagSearch.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (query.length < 2) {
            tagResults.innerHTML = '';
            return;
        }

        searchTimeout = setTimeout(async () => {
            const tags = await searchTags(query);
            tagResults.innerHTML = tags.map(tag =>
                `<div class="metadata-tag-result" data-tag-id="${tag.id}" data-tag-name="${tag.name}">
                    ${tag.name}
                </div>`
            ).join('');

            // Add click handlers for results
            tagResults.querySelectorAll('.metadata-tag-result').forEach(result => {
                result.addEventListener('click', (e) => {
                    const tagId = e.target.dataset.tagId;
                    const tagName = e.target.dataset.tagName;

                    // Add tag to list
                    const tagsContainer = body.querySelector('.metadata-tags');
                    const tagHtml = `<span class="metadata-tag" data-tag-id="${tagId}">
                        ${tagName}
                        <button class="metadata-tag-remove" data-tag-id="${tagId}">×</button>
                    </span>`;
                    tagsContainer.insertAdjacentHTML('beforeend', tagHtml);

                    // Setup remove handler for new tag
                    const newTag = tagsContainer.lastElementChild;
                    newTag.querySelector('.metadata-tag-remove').addEventListener('click', (e) => {
                        e.target.closest('.metadata-tag').remove();
                    });

                    // Clear search
                    tagSearch.value = '';
                    tagResults.innerHTML = '';
                });
            });
        }, 300);
    });

    // Save button
    const saveBtn = body.querySelector('.metadata-save-btn');
    saveBtn.addEventListener('click', async () => {
        const title = body.querySelector('.metadata-title').value;
        const details = body.querySelector('.metadata-details').value;
        const activeStar = body.querySelectorAll('.metadata-star.active').length;
        const rating100 = activeStar * 20;

        // Get current tag IDs
        const tagIds = Array.from(body.querySelectorAll('.metadata-tag')).map(tag =>
            tag.dataset.tagId
        );

        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;

        // Update metadata
        await updateImageMetadata(metadata.id, { title, details, rating100 });
        await updateImageTags(metadata.id, tagIds);

        saveBtn.textContent = 'Saved ✓';
        setTimeout(() => {
            saveBtn.textContent = 'Save Changes';
            saveBtn.disabled = false;
        }, 2000);
    });

    // Organized toggle
    const organizedBtn = body.querySelector('.metadata-organized-btn');
    organizedBtn.addEventListener('click', async () => {
        const isOrganized = organizedBtn.classList.contains('active');
        const newOrganized = !isOrganized;

        await updateImageMetadata(metadata.id, { organized: newOrganized });

        organizedBtn.classList.toggle('active', newOrganized);
        organizedBtn.textContent = newOrganized ? 'Organized ✓' : 'Mark Organized';
    });
}
