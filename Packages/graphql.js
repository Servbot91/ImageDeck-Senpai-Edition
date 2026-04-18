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

export async function updateGalleryMetadata(galleryId, updates) {
    const mutation = `mutation GalleryUpdate($input: GalleryUpdateInput!) {
        galleryUpdate(input: $input) {
            id
            title
            details
            organized
        }
    }`;

    const input = { id: galleryId, ...updates };

    try {
        const response = await fetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: mutation, variables: { input } })
        });

        const data = await response.json();
        return data?.data?.galleryUpdate || null;
    } catch (error) {
        console.error('[Image Deck] Error updating gallery metadata:', error);
        return null;
    }
}

export async function updateGalleryPerformers(galleryId, performerIds) {
    const mutation = `mutation GalleryUpdate($input: GalleryUpdateInput!) {
        galleryUpdate(input: $input) {
            id
            performers {
                id
                name
            }
        }
    }`;

    const input = { 
        id: galleryId, 
        performer_ids: performerIds 
    };

    try {
        const response = await fetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: mutation, variables: { input } })
        });

        const data = await response.json();
        return data?.data?.galleryUpdate || null;
    } catch (error) {
        console.error('[Image Deck] Error updating gallery performers:', error);
        return null;
    }
}

export async function searchPerformers(query) {
    const gql = `query FindPerformers($filter: FindFilterType, $performer_filter: PerformerFilterType) {
        findPerformers(filter: $filter, performer_filter: $performer_filter) {
            performers {
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
        const approaches = [
            { q: searchTerm },
            { q: `*${searchTerm}*` },
        ];

        for (const filter of approaches) {
            const variables = {
                filter: { 
                    per_page: 20, 
                    ...filter
                },
                performer_filter: {}
            };

            const response = await fetch('/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: gql, variables })
            });

            const data = await response.json();
            const performers = data?.data?.findPerformers?.performers || [];
            
            if (performers.length > 0) {
                return performers;
            }
        }
        
        return [];
    } catch (error) {
        console.error('[Image Deck] Error searching performers:', error);
        return [];
    }
}

export async function updateGalleryStudio(galleryId, studioId) {
    const mutation = `mutation GalleryUpdate($input: GalleryUpdateInput!) {
        galleryUpdate(input: $input) {
            id
            studio {
                id
                name
            }
        }
    }`;

    const input = { 
        id: galleryId, 
        studio_id: studioId 
    };

    try {
        const response = await fetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: mutation, variables: { input } })
        });

        const data = await response.json();
        return data?.data?.galleryUpdate || null;
    } catch (error) {
        console.error('[Image Deck] Error updating gallery studio:', error);
        return null;
    }
}

export async function searchStudios(query) {
    const gql = `query FindStudios($filter: FindFilterType, $studio_filter: StudioFilterType) {
        findStudios(filter: $filter, studio_filter: $studio_filter) {
            studios {
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
        const approaches = [
            { q: searchTerm },
            { q: `*${searchTerm}*` },
        ];

        for (const filter of approaches) {
            const variables = {
                filter: { 
                    per_page: 20, 
                    ...filter
                },
                studio_filter: {}
            };

            const response = await fetch('/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: gql, variables })
            });

            const data = await response.json();
            const studios = data?.data?.findStudios?.studios || [];
            
            if (studios.length > 0) {
                return studios;
            }
        }
        
        return [];
    } catch (error) {
        console.error('[Image Deck] Error searching studios:', error);
        return [];
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
        const approaches = [
            { q: searchTerm },

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


export async function applyGalleryTagFilter(includedTags, excludedTags, includedPerformers = [], excludedPerformers = []) {
    const filterObj = {
        includedTags: includedTags,
        excludedTags: excludedTags,
        includedPerformers: includedPerformers,
        excludedPerformers: excludedPerformers
    };
    sessionStorage.setItem('galleryTagFilter', JSON.stringify(filterObj));
    
    window.dispatchEvent(new CustomEvent('galleryTagFilterChanged', { 
        detail: { includedTags, excludedTags, includedPerformers, excludedPerformers } 
    }));
    
    // Completely refresh everything, not just content
    setTimeout(() => {
        window.dispatchEvent(new CustomEvent('updateDeckContent', { 
            detail: { includedTags, excludedTags, includedPerformers, excludedPerformers } 
        }));
    }, 100);
}


export function clearGalleryTagFilter() {
    sessionStorage.removeItem('galleryTagFilter');
    window.dispatchEvent(new CustomEvent('galleryTagFilterChanged', { 
        detail: { includedTags: [], excludedTags: [], includedPerformers: [], excludedPerformers: [] } 
    }));
    
    // Immediately trigger content refresh when clearing
    setTimeout(() => {
        window.dispatchEvent(new CustomEvent('updateDeckContent', { 
            detail: { includedTags: [], excludedTags: [], includedPerformers: [], excludedPerformers: [] } 
        }));
    }, 100);
}

export function detectContextWithFilter() {
    const baseContext = detectContext();
    
    const tagFilter = sessionStorage.getItem('galleryTagFilter');
    if (tagFilter) {
        try {
            const tagIds = JSON.parse(tagFilter);
            if (tagIds.length > 0) {
                if (!baseContext.filter) {
                    baseContext.filter = {};
                }
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