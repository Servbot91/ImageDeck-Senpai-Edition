import { parseUrlFilters } from './filters.js';

function getCurrentFilterTags() {
    const tagFilter = sessionStorage.getItem('galleryTagFilter');
    if (tagFilter) {
        try {
            const filterObj = JSON.parse(tagFilter);
            return {
                included: filterObj.included || [],
                excluded: filterObj.excluded || []
            };
        } catch (e) {
            console.error('Error parsing tag filter:', e);
            return { included: [], excluded: [] };
        }
    }
    return { included: [], excluded: [] };
}

export function detectContext() {
    const path = window.location.pathname;
    const hash = window.location.hash;
    const search = window.location.search;
    
    // Parse URL filters first
    let filters = parseUrlFilters(search);
    
    // Check if we're in image mode
    const storedMode = sessionStorage.getItem('imageDeckMode');
    const isImageMode = storedMode === 'image';
    
    // Handle main page with filters
    if (path === '/') {
        const tagFilter = sessionStorage.getItem('galleryTagFilter');
        
        if (tagFilter) {
            try {
                const filterObj = JSON.parse(tagFilter);
                
                // Apply tag filters
                if ((filterObj.includedTags && filterObj.includedTags.length > 0) || 
                    (filterObj.excludedTags && filterObj.excludedTags.length > 0)) {
                    if (!filters) filters = {};
                    if (filterObj.includedTags && filterObj.includedTags.length > 0) {
                        filters.tags = {
                            value: filterObj.includedTags,
                            modifier: "INCLUDES"
                        };
                    }
                    if (filterObj.excludedTags && filterObj.excludedTags.length > 0) {
                        if (filters.tags) {
                            filters.tags.excluded = filterObj.excludedTags;
                        } else {
                            filters.tags = {
                                value: [],
                                modifier: "INCLUDES",
                                excluded: filterObj.excludedTags
                            };
                        }
                    }
                }
                
                // Apply performer filters
                if ((filterObj.includedPerformers && filterObj.includedPerformers.length > 0) || 
                    (filterObj.excludedPerformers && filterObj.excludedPerformers.length > 0)) {
                    if (!filters) filters = {};
                    if (filterObj.includedPerformers && filterObj.includedPerformers.length > 0) {
                        filters.performers = {
                            value: filterObj.includedPerformers,
                            modifier: "INCLUDES"
                        };
                    }
                    if (filterObj.excludedPerformers && filterObj.excludedPerformers.length > 0) {
                        if (filters.performers) {
                            filters.performers.excluded = filterObj.excludedPerformers;
                        } else {
                            filters.performers = {
                                value: [],
                                modifier: "INCLUDES",
                                excluded: filterObj.excludedPerformers
                            };
                        }
                    }
                }
            } catch (e) {
                console.error('[Image Deck] Error parsing tag filter:', e);
            }
        }
        
        // Use 'images' type when in image mode, otherwise 'galleries'
        // DEFAULT SORT: newest first (desc)
        if (!filters) filters = {};
        if (!filters.sortBy) filters.sortBy = 'created_at';
        if (!filters.sortDir) filters.sortDir = 'desc';
        
        return { 
            type: isImageMode ? 'images' : 'galleries', 
            isGalleryListing: !isImageMode, 
            isGeneralListing: isImageMode,
            filter: filters, 
            hash 
        };
    }

    // Handle galleries pages
    if (path.startsWith('/galleries')) {
        const galleryIdMatch = path.match(/^\/galleries\/(\d+)/);
        
        if (galleryIdMatch) {
            let singleGalleryFilters = parseUrlFilters(search);
            // Default sorting for single gallery
            if (!new URLSearchParams(search).get('sortby') && !new URLSearchParams(search).get('sortdir')) {
                singleGalleryFilters.sortBy = 'title';
                singleGalleryFilters.sortDir = 'asc';
            }
            return { type: 'galleries', id: galleryIdMatch[1], hash, isSingleGallery: true, filter: singleGalleryFilters };
        } else {
            // Gallery listing page
            let galleryFilters = parseUrlFilters(search);
            
            // DEFAULT SORT: newest first (desc)
            if (!galleryFilters) galleryFilters = {};
            if (!galleryFilters.sortBy) galleryFilters.sortBy = 'created_at';
            if (!galleryFilters.sortDir) galleryFilters.sortDir = 'desc';
            
            const tagFilter = sessionStorage.getItem('galleryTagFilter');
            if (tagFilter) {
                try {
                    const filterObj = JSON.parse(tagFilter);
                    
                    // Handle tag filters
                    if ((filterObj.includedTags && filterObj.includedTags.length > 0) || 
                        (filterObj.excludedTags && filterObj.excludedTags.length > 0)) {
                        if (!galleryFilters) {
                            galleryFilters = {};
                        }
                        if (filterObj.includedTags && filterObj.includedTags.length > 0) {
                            galleryFilters.tags = {
                                value: filterObj.includedTags,
                                modifier: "INCLUDES"
                            };
                        }
                        if (filterObj.excludedTags && filterObj.excludedTags.length > 0) {
                            if (galleryFilters.tags) {
                                galleryFilters.tags.excluded = filterObj.excludedTags;
                            } else {
                                galleryFilters.tags = {
                                    value: [],
                                    modifier: "INCLUDES",
                                    excluded: filterObj.excludedTags
                                };
                            }
                        }
                    }
                    
                    // Handle performer filters
                    if ((filterObj.includedPerformers && filterObj.includedPerformers.length > 0) || 
                        (filterObj.excludedPerformers && filterObj.excludedPerformers.length > 0)) {
                        if (!galleryFilters) {
                            galleryFilters = {};
                        }
                        if (filterObj.includedPerformers && filterObj.includedPerformers.length > 0) {
                            galleryFilters.performers = {
                                value: filterObj.includedPerformers,
                                modifier: "INCLUDES"
                            };
                        }
                        if (filterObj.excludedPerformers && filterObj.excludedPerformers.length > 0) {
                            if (galleryFilters.performers) {
                                galleryFilters.performers.excluded = filterObj.excludedPerformers;
                            } else {
                                galleryFilters.performers = {
                                    value: [],
                                    modifier: "INCLUDES",
                                    excluded: filterObj.excludedPerformers
                                };
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error parsing tag filter:', e);
                }
            }
            
            return { type: 'galleries', isGalleryListing: true, filter: galleryFilters, hash };
        }
    }

    // Handle images pages - THIS IS THE KEY PART THAT WAS MISSING PROPER FILTER HANDLING
    if (path.startsWith('/images')) {
        let imageFilters = parseUrlFilters(search);
        // DEFAULT SORT: newest first (desc)
        if (!imageFilters) imageFilters = {};
        if (!imageFilters.sortBy) imageFilters.sortBy = 'created_at';
        if (!imageFilters.sortDir) imageFilters.sortDir = 'desc';
        
        // ADD FILTER HANDLING FOR IMAGES TOO!
        const tagFilter = sessionStorage.getItem('galleryTagFilter');
        if (tagFilter) {
            try {
                const filterObj = JSON.parse(tagFilter);
                
                // Handle tag filters for images
                if ((filterObj.includedTags && filterObj.includedTags.length > 0) || 
                    (filterObj.excludedTags && filterObj.excludedTags.length > 0)) {
                    if (!imageFilters) {
                        imageFilters = {};
                    }
                    if (filterObj.includedTags && filterObj.includedTags.length > 0) {
                        imageFilters.tags = {
                            value: filterObj.includedTags,
                            modifier: "INCLUDES"
                        };
                    }
                    if (filterObj.excludedTags && filterObj.excludedTags.length > 0) {
                        if (imageFilters.tags) {
                            imageFilters.tags.excluded = filterObj.excludedTags;
                        } else {
                            imageFilters.tags = {
                                value: [],
                                modifier: "INCLUDES",
                                excluded: filterObj.excludedTags
                            };
                        }
                    }
                }
                
                // Handle performer filters for images
                if ((filterObj.includedPerformers && filterObj.includedPerformers.length > 0) || 
                    (filterObj.excludedPerformers && filterObj.excludedPerformers.length > 0)) {
                    if (!imageFilters) {
                        imageFilters = {};
                    }
                    if (filterObj.includedPerformers && filterObj.includedPerformers.length > 0) {
                        imageFilters.performers = {
                            value: filterObj.includedPerformers,
                            modifier: "INCLUDES"
                        };
                    }
                    if (filterObj.excludedPerformers && filterObj.excludedPerformers.length > 0) {
                        if (imageFilters.performers) {
                            imageFilters.performers.excluded = filterObj.excludedPerformers;
                        } else {
                            imageFilters.performers = {
                                value: [],
                                modifier: "INCLUDES",
                                excluded: filterObj.excludedPerformers
                            };
                        }
                    }
                }
            } catch (e) {
                console.error('Error parsing tag filter for images:', e);
            }
        }
        
        return {
            type: 'images',
            isFilteredView: !!search, 
            isGeneralListing: !search, 
            filter: imageFilters,
            hash: hash
        };
    }

    // Handle performer pages
    const performerMatch = path.match(/^\/performers\/(\d+)(?:\/(galleries|images))?/);
    if (performerMatch) {
        const [, performerId, viewType] = performerMatch;
        
        // Determine if we should show galleries or images
        let type = 'galleries';
        if (viewType === 'images' || isImageMode) {
            type = 'images';
        } else if (viewType === 'galleries') {
            type = 'galleries';
        }
        
        // Build filter for this performer with DEFAULT SORT: newest first (desc)
        let performerFilters = {
            performers: { value: [performerId], modifier: "INCLUDES" },
            sortBy: 'created_at',
            sortDir: 'desc'
        };
        
        // Override with URL filters if present
        const urlFilters = parseUrlFilters(search);
        if (urlFilters) {
            Object.assign(performerFilters, urlFilters);
        }
        
        // ALSO APPLY SESSION FILTERS TO PERFORMER CONTEXT
        const tagFilter = sessionStorage.getItem('galleryTagFilter');
        if (tagFilter) {
            try {
                const filterObj = JSON.parse(tagFilter);
                
                // Handle tag filters
                if ((filterObj.includedTags && filterObj.includedTags.length > 0) || 
                    (filterObj.excludedTags && filterObj.excludedTags.length > 0)) {
                    if (filterObj.includedTags && filterObj.includedTags.length > 0) {
                        performerFilters.tags = {
                            value: filterObj.includedTags,
                            modifier: "INCLUDES"
                        };
                    }
                    if (filterObj.excludedTags && filterObj.excludedTags.length > 0) {
                        if (performerFilters.tags) {
                            performerFilters.tags.excluded = filterObj.excludedTags;
                        } else {
                            performerFilters.tags = {
                                value: [],
                                modifier: "INCLUDES",
                                excluded: filterObj.excludedTags
                            };
                        }
                    }
                }
                
                // Handle performer filters (additional filtering)
                if ((filterObj.includedPerformers && filterObj.includedPerformers.length > 0) || 
                    (filterObj.excludedPerformers && filterObj.excludedPerformers.length > 0)) {
                    if (filterObj.includedPerformers && filterObj.includedPerformers.length > 0) {
                        if (performerFilters.performers) {
                            // Combine with existing performer filter
                            const combinedPerformers = [...new Set([...performerFilters.performers.value, ...filterObj.includedPerformers])];
                            performerFilters.performers.value = combinedPerformers;
                        } else {
                            performerFilters.performers = {
                                value: filterObj.includedPerformers,
                                modifier: "INCLUDES"
                            };
                        }
                    }
                    if (filterObj.excludedPerformers && filterObj.excludedPerformers.length > 0) {
                        if (performerFilters.performers) {
                            performerFilters.performers.excluded = filterObj.excludedPerformers;
                        } else {
                            performerFilters.performers = {
                                value: [performerId],
                                modifier: "INCLUDES",
                                excluded: filterObj.excludedPerformers
                            };
                        }
                    }
                }
            } catch (e) {
                console.error('Error parsing tag filter for performer:', e);
            }
        }
        
        return { 
            type, 
            id: performerId,
            performerId: performerId,
            isPerformerContext: true,
            filter: performerFilters,
            hash 
        };
    }

    // Fallback to visible images with DEFAULT SORT: newest first (desc)
    let fallbackFilters = parseUrlFilters(search);
    if (!fallbackFilters) fallbackFilters = {};
    if (!fallbackFilters.sortBy) fallbackFilters.sortBy = 'created_at';
    if (!fallbackFilters.sortDir) fallbackFilters.sortDir = 'desc';
    
    // ALSO APPLY FILTERS TO FALLBACK
    const tagFilter = sessionStorage.getItem('galleryTagFilter');
    if (tagFilter) {
        try {
            const filterObj = JSON.parse(tagFilter);
            
            if ((filterObj.includedTags && filterObj.includedTags.length > 0) || 
                (filterObj.excludedTags && filterObj.excludedTags.length > 0)) {
                if (!fallbackFilters) fallbackFilters = {};
                if (filterObj.includedTags && filterObj.includedTags.length > 0) {
                    fallbackFilters.tags = {
                        value: filterObj.includedTags,
                        modifier: "INCLUDES"
                    };
                }
                if (filterObj.excludedTags && filterObj.excludedTags.length > 0) {
                    if (fallbackFilters.tags) {
                        fallbackFilters.tags.excluded = filterObj.excludedTags;
                    } else {
                        fallbackFilters.tags = {
                            value: [],
                            modifier: "INCLUDES",
                            excluded: filterObj.excludedTags
                        };
                    }
                }
            }
            
            if ((filterObj.includedPerformers && filterObj.includedPerformers.length > 0) || 
                (filterObj.excludedPerformers && filterObj.excludedPerformers.length > 0)) {
                if (!fallbackFilters) fallbackFilters = {};
                if (filterObj.includedPerformers && filterObj.includedPerformers.length > 0) {
                    fallbackFilters.performers = {
                        value: filterObj.includedPerformers,
                        modifier: "INCLUDES"
                    };
                }
                if (filterObj.excludedPerformers && filterObj.excludedPerformers.length > 0) {
                    if (fallbackFilters.performers) {
                        fallbackFilters.performers.excluded = filterObj.excludedPerformers;
                    } else {
                        fallbackFilters.performers = {
                            value: [],
                            modifier: "INCLUDES",
                            excluded: filterObj.excludedPerformers
                        };
                    }
                }
            }
        } catch (e) {
            console.error('Error parsing tag filter for fallback:', e);
        }
    }
    
    return {
        type: 'images',
        isGeneralListing: true,
        filter: fallbackFilters,
        hash: hash
    };
}

export function getVisibleImages() {
    const images = [];
    const imageGrid = document.querySelector('.main-content, [role="main"]') || document.body;
    const imageElements = imageGrid.querySelectorAll('.image-card img, .grid-card img');
    const imageArray = Array.from(imageElements);

    imageArray.forEach((img, index) => {
        if (img.src && 
            img.src.includes('/image/') && 
            !img.src.includes('/studio/') && 
            !img.closest('.logo, .sidebar, .header')) {
            
            const idMatch = img.src.match(/\/image\/(\d+)/);
            const id = idMatch ? idMatch[1] : `img_${index}`;

            const fullImageUrl = img.src.includes('/thumbnail/')
                ? img.src.replace('/thumbnail/', '/image/')
                : img.src;

            const card = img.closest('.image-card, .grid-card');
            const previewButton = card?.querySelector('.preview-button');

            images.push({
                id,
                title: img.alt || `Image ${index + 1}`,
                paths: {
                    image: fullImageUrl
                },
                previewButton: previewButton
            });
        }
    });

    return images;
}

export function getVisibleGalleryCovers() {
    const galleries = [];
    const galleryGrid = document.querySelector('.main-content, [role="main"]') || document.body;
    const galleryElements = galleryGrid.querySelectorAll('.gallery-card, .card');

    galleryElements.forEach((card, index) => {
        const coverImg = card.querySelector('.gallery-cover img, img');
        if (coverImg && coverImg.src) {
            let id = `gallery_${index}`;
            let url = null;
            const link = card.querySelector('a[href*="/galleries/"]');
            if (link) {
                const idMatch = link.href.match(/\/galleries\/(\d+)/);
                if (idMatch) {
                    id = idMatch[1];
                    url = link.href;
                }
            }

            galleries.push({
                id,
                title: card.querySelector('.card-title, h5, h6')?.textContent?.trim() || `Gallery ${index + 1}`,
                paths: {
                    image: coverImg.src
                },
                url: url 
            });
        }
    });

    return galleries;
}

export async function fetchContextImages(context, page = 1, perPage = 50) {
    const { type, id, filter, isSingleGallery, isGalleryListing, isGeneralListing } = context;
    const isFetchingGalleries = isGalleryListing || 
                               (type === 'galleries' && !isSingleGallery) ||
                               (type === 'galleries' && isGeneralListing === false);
    
    const isFetchingImages = !isFetchingGalleries;

    let query = '';
    if (isFetchingGalleries) {
        query = `query FindGalleries($filter: FindFilterType!, $gallery_filter: GalleryFilterType) {
            findGalleries(filter: $filter, gallery_filter: $gallery_filter) {
                count
                galleries {
                    id title image_count cover { paths { thumbnail image } }
                    performers {
                        id
                        name
                    }
                    tags {
                        id
                        name
                    }
                    date
                    rating100
                    organized
                }
            }
        }`;
    } else {
        query = `query FindImages($filter: FindFilterType!, $image_filter: ImageFilterType) {
            findImages(filter: $filter, image_filter: $image_filter) {
                count
                images {
                    id title paths { thumbnail image }
                    performers {
                        id
                        name
                    }
                    tags {
                        id
                        name
                    }
                    date
                    rating100
                    organized
                }
            }
        }`;
    }

    // Build the filter object for GraphQL
    let activeFilter = {};
    let exclusions = {}; 
    
    // Handle single gallery context
    if (isSingleGallery && id) {
        activeFilter = { galleries: { value: [id], modifier: "INCLUDES" } };
    } 
    // Handle filters from context (including tag filters from sessionStorage)
    else if (filter) {
        if (isFetchingGalleries) {
            const galleryAllowedFields = [
                'tags', 'performers', 'studios', 'rating100', 'organized', 
                'date', 'is_missing', 'image_count'
            ];
            
            galleryAllowedFields.forEach(field => {
                if (filter[field]) {
                    // Handle exclusions
                    if (filter[field].excluded && filter[field].excluded.length > 0) {
                        exclusions[field] = filter[field].excluded;
                        // Include positive filters if they exist
                        if (filter[field].value && filter[field].value.length > 0) {
                            activeFilter[field] = {
                                value: filter[field].value,
                                modifier: filter[field].modifier || "INCLUDES"
                            };
                        }
                    } 
                    // Handle regular filters
                    else if (filter[field].value && filter[field].value.length > 0) {
                        activeFilter[field] = {
                            value: filter[field].value,
                            modifier: filter[field].modifier || "INCLUDES"
                        };
                    }
                }
            });
        } else {
            const imageAllowedFields = [
                'tags', 'performers', 'studios', 'rating100', 'organized', 
                'date', 'is_missing', 'galleries'
            ];
            
            imageAllowedFields.forEach(field => {
                if (filter[field]) {
                    // Handle exclusions
                    if (filter[field].excluded && filter[field].excluded.length > 0) {
                        exclusions[field] = filter[field].excluded;
                        // Include positive filters if they exist
                        if (filter[field].value && filter[field].value.length > 0) {
                            activeFilter[field] = {
                                value: filter[field].value,
                                modifier: filter[field].modifier || "INCLUDES"
                            };
                        }
                    } 
                    // Handle regular filters
                    else if (filter[field].value && filter[field].value.length > 0) {
                        activeFilter[field] = {
                            value: filter[field].value,
                            modifier: filter[field].modifier || "INCLUDES"
                        };
                    }
                }
            });
        }
    }

    if (context.performerId) {
        if (isFetchingGalleries) {
            activeFilter.performers = {
                value: [context.performerId],
                modifier: "INCLUDES"
            };
        } else {
            activeFilter.performers = {
                value: [context.performerId],
                modifier: "INCLUDES"
            };
        }
    }

    const variables = {
        filter: { 
            per_page: perPage, 
            page: page, 
            sort: filter?.sortBy || "created_at", 
            direction: (filter?.sortDir || "desc").toUpperCase() 
        }
    };

    if (isFetchingGalleries) {
        variables.gallery_filter = activeFilter;
    } else {
        variables.image_filter = activeFilter;
    }

    try {
        const response = await fetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables })
        });

        const data = await response.json();
        
        if (data.errors) {
            console.error('[Image Deck] GraphQL Errors:', data.errors);
            throw new Error(data.errors[0].message);
        }

        let normalizedImages = [];
        let totalCount = 0;

        if (isFetchingGalleries) {
            let result = data?.data?.findGalleries;
            totalCount = result?.count || 0;
            
            // Apply client-side exclusion filtering if needed
            if (Object.keys(exclusions).length > 0 && result?.galleries) {
                result.galleries = result.galleries.filter(item => {
                    for (const [fieldType, excludedIds] of Object.entries(exclusions)) {
                        if (excludedIds.length > 0) {
                            if (item[fieldType] && item[fieldType].length > 0) {
                                const hasExcludedItem = item[fieldType].some(fieldItem => 
                                    excludedIds.includes(fieldItem.id)
                                );
                                
                                if (hasExcludedItem) {
                                    return false;
                                }
                            }
                        }
                    }
                    return true; 
                });

                totalCount = result.galleries.length;
            }
            
            normalizedImages = (result?.galleries || []).map(gallery => ({
                id: gallery.id,
                title: gallery.title,
                image_count: gallery.image_count,
                performers: gallery.performers || [], 
                tags: gallery.tags || [],
                date: gallery.date,
                rating100: gallery.rating100,
                organized: gallery.organized,
                isGallery: true,
                type: 'gallery',
                paths: { image: gallery.cover?.paths?.image || gallery.cover?.paths?.thumbnail || '' },
                url: `/galleries/${gallery.id}`
            }));
        } else {
            let result = data?.data?.findImages;
            totalCount = result?.count || 0;
            
            // Apply client-side exclusion filtering if needed
            if (Object.keys(exclusions).length > 0 && result?.images) {
                result.images = result.images.filter(item => {
                    for (const [fieldType, excludedIds] of Object.entries(exclusions)) {
                        if (excludedIds.length > 0) {
                            if (item[fieldType] && item[fieldType].length > 0) {
                                const hasExcludedItem = item[fieldType].some(fieldItem => 
                                    excludedIds.includes(fieldItem.id)
                                );
                                
                                if (hasExcludedItem) {
                                    return false;
                                }
                            }
                        }
                    }
                    return true; 
                });

                totalCount = result.images.length;
            }
            
            normalizedImages = (result?.images || []).map(img => ({
                id: img.id,
                title: img.title,
                performers: img.performers || [],
                tags: img.tags || [],
                date: img.date,
                rating100: img.rating100,
                organized: img.organized,
                paths: img.paths,
                isGallery: false,
                type: 'image'
            }));
        }

        const calculatedTotalPages = Math.ceil(totalCount / perPage);

        return { 
            images: normalizedImages, 
            totalCount, 
            currentPage: page,
            totalPages: calculatedTotalPages,
            hasNextPage: page < calculatedTotalPages
        };

    } catch (error) {
        console.error(`[Image Deck] Fetch Error:`, error);
        return { 
            images: [], 
            totalCount: 0, 
            currentPage: 1, 
            totalPages: 0, 
            hasNextPage: false 
        };
    }
}
