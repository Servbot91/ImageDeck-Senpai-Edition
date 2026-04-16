export function parseUrlFilters(search) {
    const params = new URLSearchParams(search);
    const cParam = params.get('c');
    let parsedFilter = {};

    if (cParam) {
        try {
            // Decodes Stash's (key:value) format to JSON {key:value}
            const jsonString = cParam
                .replace(/\(/g, '{')
                .replace(/\)/g, '}')
                .replace(/"items":/g, '"value":');

            const parsed = JSON.parse(jsonString);

            // If we have a valid filter type (e.g., "performers")
            if (parsed.type && parsed.value) {
                parsedFilter[parsed.type] = {
                    value: parsed.value.value ? parsed.value.value.map(i => i.id) : [],
                    modifier: parsed.modifier || "INCLUDES"
                };
            }
        } catch (e) {
            console.error('[Image Deck] Filter parse error:', e);
        }
    }

    // Handle sort direction - if not provided, assume ascending
    let sortDir = 'asc'; // Default to ascending when not specified
    if (params.has('sortdir')) {
        sortDir = params.get('sortdir') || 'asc';
    }

    return {
        ...parsedFilter,
        sortBy: params.get('sortby') || 'created_at',
        sortDir: sortDir,
        perPage: parseInt(params.get('perPage')) || 40
    };
}
