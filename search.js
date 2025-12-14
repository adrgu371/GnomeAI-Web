// search.js
export async function braveSearch(query, apiKey) {
    try {
        const res = await fetch("https://api.search.brave.com/res/v1/web/search?q=" + encodeURIComponent(query), {
            headers: { "X-Subscription-Token": apiKey }
        });
        const data = await res.json();
        if (!data.web || !data.web.results) return [];
        return data.web.results.slice(0, 5).map(r => ({
            title: r.title,
            snippet: r.description,
            link: r.url
        }));
    } catch { return []; }
}
