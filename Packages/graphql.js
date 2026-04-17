function handleError(operation, error, defaultValue = null) {
    console.error(`[Image Deck] Error in ${operation}:`, error);
    return defaultValue;
}

export async function fetchGalleryMetadata(galleryId) {
    const query = `query FindGallery($id: ID!) {
        findGallery(id: $id) {
            created_at
            date
            details
            id
            image_count
            organized
            rating100
            title
            updated_at
            url
            urls
        }
    }`;

    try {
        const response = await safeFetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { id: galleryId } })
        }, 'GraphQL fetchGalleryMetadata');

        if (!response) return null;
        
        const data = await response.json();
        return data?.data?.findGallery || null;
    } catch (error) {
        return handleError('fetchGalleryMetadata', error, null);
    }
}

async function safeFetch(url, options, operationName = '') {
    try {
        const response = await fetch(url, options);
        return response;
    } catch (error) {
        console.error(`[Image Deck] Error in ${operationName}:`, error);
        return null;
    }
}

export async function fetchImageMetadata(imageId) {
    const query = `query FindImage($id: ID!) {
        findImage(id: $id) {
            id
            title
            rating100
            o_counter
            organized
            date
            details
            photographer
            files {
                basename
            }
            tags {
                id
                name
            }
            performers {
                id
                name
            }
            studio {
                id
                name
            }
            galleries {
                id
                title
            }
            paths {
                thumbnail
                image
            }
        }
    }`;

    try {
        const response = await safeFetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { id: imageId } })
        }, 'GraphQL fetchImageMetadata');

        if (!response) return null;
        
        const data = await response.json();
        return data?.data?.findImage || null;
    } catch (error) {
        return handleError('fetchImageMetadata', error, null);
    }
}

// Update image metadata
export async function updateImageMetadata(imageId, updates) {
    const mutation = `mutation ImageUpdate($input: ImageUpdateInput!) {
        imageUpdate(input: $input) {
            id
            rating100
            title
            details
            organized
        }
    }`;

    const input = { id: imageId, ...updates };

    try {
        const response = await fetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: mutation, variables: { input } })
        });

        const data = await response.json();
        return data?.data?.imageUpdate || null;
    } catch (error) {
        console.error('[Image Deck] Error updating image metadata:', error);
        return null;
    }
}

// Add/remove tags from image
export async function updateImageTags(imageId, tagIds) {
    const mutation = `mutation ImageUpdate($input: ImageUpdateInput!) {
        imageUpdate(input: $input) {
            id
            tags {
                id
                name
            }
        }
    }`;

    const input = { id: imageId, tag_ids: tagIds };

    try {
        const response = await fetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: mutation, variables: { input } })
        });

        const data = await response.json();
        return data?.data?.imageUpdate || null;
    } catch (error) {
        console.error('[Image Deck] Error updating image tags:', error);
        return null;
    }
}


export async function searchTags(query) {
    const gql = `query FindTags($filter: FindFilterType, $tag_filter: TagFilterType) {
        findTags(filter: $filter, tag_filter: $tag_filter) {
            tags {
                id
                name
            }
        }
    }`;

    const searchTerm = query.trim();
    if (!searchTerm) {
        return [];
    }

    try {
        // Try multiple approaches for better fuzzy matching
        const approaches = [
            // Direct search first
            { q: searchTerm },
            // Try with wildcards if direct search yields few/no results
            { q: `*${searchTerm}*` },
        ];

        for (const filter of approaches) {
            const variables = {
                filter: { 
                    per_page: 20, 
                    ...filter
                },
                tag_filter: {}
            };

            const response = await fetch('/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: gql, variables })
            });

            const data = await response.json();
            const tags = data?.data?.findTags?.tags || [];
            
            // If we got reasonable results, return them
            if (tags.length > 0) {
                return tags;
            }
        }
        
        return [];
    } catch (error) {
        console.error('[Image Deck] Error searching tags:', error);
        return [];
    }
}

export async function fetchGalleriesByTags(tagIds, page = 1, perPage = 50) {
    const query = `query FindGalleries($filter: FindFilterType!, $gallery_filter: GalleryFilterType) {
        findGalleries(filter: $filter, gallery_filter: $gallery_filter) {
            count
            galleries {
                id 
                title 
                image_count 
                cover { 
                    paths { 
                        thumbnail 
                        image 
                    } 
                }
                performers {
                    id
                    name
                }
                tags {
                    id
                    name
                }
            }
        }
    }`;

    const variables = {
        filter: { 
            per_page: perPage, 
            page: page, 
            sort: "created_at", 
            direction: "DESC" 
        },
        gallery_filter: {
            tags: {
                value: tagIds,
                modifier: "INCLUDES"
            }
        }
    };

    try {
        const response = await fetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables })
        });

        const data = await response.json();
        return data?.data?.findGalleries || { count: 0, galleries: [] };
    } catch (error) {
        console.error('[Image Deck] Error fetching galleries by tags:', error);
        return { count: 0, galleries: [] };
    }
}


export async function applyGalleryTagFilter(includedTags, excludedTags) {
    // Store filter in session storage as an object
    const filterObj = {
        included: includedTags,
        excluded: excludedTags
    };
    sessionStorage.setItem('galleryTagFilter', JSON.stringify(filterObj));
    
    // Emit event to notify deck that filter changed
    window.dispatchEvent(new CustomEvent('galleryTagFilterChanged', { 
        detail: { includedTags, excludedTags } 
    }));
}

// Also update the clear function
export function clearGalleryTagFilter() {
    sessionStorage.removeItem('galleryTagFilter');
    window.dispatchEvent(new CustomEvent('galleryTagFilterChanged', { 
        detail: { includedTags: [], excludedTags: [] } 
    }));
}

// Enhanced version of detectContext to handle tag filtering
export function detectContextWithFilter() {
    const baseContext = detectContext();
    
    // Check for tag filter in session storage
    const tagFilter = sessionStorage.getItem('galleryTagFilter');
    if (tagFilter) {
        try {
            const tagIds = JSON.parse(tagFilter);
            if (tagIds.length > 0) {
                // Apply tag filter to context
                if (!baseContext.filter) {
                    baseContext.filter = {};
                }
                // Ensure we merge with existing filters properly
                baseContext.filter = {
                    ...baseContext.filter,
                    tags: {
                        value: tagIds,
                        modifier: "INCLUDES"
                    }
                };
            }
        } catch (e) {
            console.error('Error parsing tag filter:', e);
        }
    }
    
    return baseContext;
}