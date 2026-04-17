export function parseUrlFilters(search) {
    const params = new URLSearchParams(search);
    const cParam = params.get('c');
    let parsedFilter = {};

    if (cParam) {
        try {
            const jsonString = cParam
                .replace(/\(/g, '{')
                .replace(/\)/g, '}')
                .replace(/"items":/g, '"value":');

            const parsed = JSON.parse(jsonString);
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
    let sortDir = 'asc'; 
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
