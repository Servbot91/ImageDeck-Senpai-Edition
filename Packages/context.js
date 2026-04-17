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
            const filter = parseUrlFilters(search);
            // Default sorting for single gallery
            if (!new URLSearchParams(search).get('sortby') && !new URLSearchParams(search).get('sortdir')) {
                filter.sortBy = 'title';
                filter.sortDir = 'asc';
            }
            return { type: 'galleries', id: galleryIdMatch[1], hash, isSingleGallery: true, filter };
        } else {
            // Gallery listing page
            let filters = parseUrlFilters(search);
            
            const tagFilter = sessionStorage.getItem('galleryTagFilter');
            if (tagFilter) {
                try {
                    const filterObj = JSON.parse(tagFilter);
                    
                    // Handle tag filters
                    if ((filterObj.includedTags && filterObj.includedTags.length > 0) || 
                        (filterObj.excludedTags && filterObj.excludedTags.length > 0)) {
                        if (!filters) {
                            filters = {};
                        }
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
                    
                    // Handle performer filters
                    if ((filterObj.includedPerformers && filterObj.includedPerformers.length > 0) || 
                        (filterObj.excludedPerformers && filterObj.excludedPerformers.length > 0)) {
                        if (!filters) {
                            filters = {};
                        }
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
                    console.error('Error parsing tag filter:', e);
                }
            }
            
            return { type: 'galleries', isGalleryListing: true, filter: filters, hash };
        }
    }

    // Handle images pages
    if (path.startsWith('/images')) {
        const filters = parseUrlFilters(search);
        return {
            type: 'images',
            isFilteredView: !!search, 
            isGeneralListing: !search, 
            filter: filters,
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
        
        // Build filter for this performer
        const filter = {
            performers: { value: [performerId], modifier: "INCLUDES" },
            sortBy: filters?.sortBy || 'created_at',
            sortDir: filters?.sortDir || 'desc'
        };
        
        // Copy other filters from URL if present
        Object.keys(filters || {}).forEach(key => {
            if (key !== 'performers' && key !== 'sortBy' && key !== 'sortDir') {
                filter[key] = filters[key];
            }
        });
        
        return { 
            type, 
            id: performerId,
            performerId: performerId,
            isPerformerContext: true,
            filter,
            hash 
        };
    }

    // Fallback to visible images
    if (document.querySelectorAll('img[src*="/image/"]').length > 0) {
        return {
            type: 'images',
            isGeneralListing: true,
            filter: parseUrlFilters(search),
            hash: hash
        };
    }

    return null;
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