const BaseParser = require('./base-parser');

class MangaParkParser extends BaseParser {
    constructor() {
        super('MangaPark', 'https://mangapark.net');
        // Set nsfw cookie as done in Kotatsu implementation
        this.nsfwCookie = 'nsfw=2';
    }

    async fetchHtml(url, options = {}) {
        // Add nsfw cookie to headers for MangaPark
        const headers = {
            'Cookie': this.nsfwCookie,
            ...options.headers
        };

        return super.fetchHtml(url, { ...options, headers });
    }

    async search(query, page = 1) {
        try {
            // MangaPark uses 'word' parameter for search (based on Kotatsu implementation)
            const searchUrl = `${this.baseUrl}/search?page=${page}&word=${encodeURIComponent(query)}`;
            console.log(`MangaPark search URL: ${searchUrl}`);

            const html = await this.fetchHtml(searchUrl);
            const $ = this.loadHtml(html);
            const results = [];

            // Check if site is protected or has issues
            const title = $('title').text();
            if (title.includes('403') || title.includes('Forbidden') ||
                title.includes('Access Denied') || title.includes('Just a moment') ||
                title.includes('Checking your browser') || html.length < 5000) {
                console.log('MangaPark is returning 403/protected - site is blocking requests');
                console.log('This could be due to:');
                console.log('- IP-based blocking');
                console.log('- Cloudflare protection');
                console.log('- Anti-bot measures');
                console.log('- Server-side blocking of automated requests');
                return [];
            }

            // Based on Kotatsu: look for "div.grid.gap-5 div.flex.border-b"
            const mangaItems = $('div.grid.gap-5 div.flex.border-b, div.grid div.flex.border-b, .grid .flex.border-b');
            console.log(`MangaPark found ${mangaItems.length} manga items`);

            mangaItems.each((i, element) => {
                try {
                    const $element = $(element);

                    // Find link
                    const $link = $element.find('a').first();
                    const href = $link.attr('href');

                    if (!href) return;

                    // Find title (h3 based on Kotatsu)
                    const $title = $element.find('h3').first();
                    const title = this.cleanText($title.text());

                    if (!title) return;

                    // Find cover image
                    let coverUrl = null;
                    const $img = $element.find('img').first();
                    if ($img.length) {
                        const src = $img.attr('src') || $img.attr('data-src');
                        if (src) {
                            coverUrl = this.absoluteUrl(src);
                        }
                    }

                    // Find rating (span.text-yellow-500 based on Kotatsu)
                    let rating = null;
                    const $rating = $element.find('span.text-yellow-500').first();
                    if ($rating.length) {
                        const ratingText = $rating.text();
                        const ratingNum = parseFloat(ratingText);
                        if (!isNaN(ratingNum)) {
                            rating = ratingNum / 10; // Convert from 10 to 1 scale
                        }
                    }

                    results.push({
                        id: this.extractIdFromUrl(href),
                        title: title,
                        url: this.absoluteUrl(href),
                        coverUrl: coverUrl,
                        rating: rating,
                        source: this.name
                    });
                } catch (error) {
                    console.error('Error parsing MangaPark manga item:', error);
                }
            });

            console.log(`MangaPark parsed ${results.length} results`);
            return results;
        } catch (error) {
            console.error('MangaPark search error:', error.message);

            // Check for specific 403 error
            if (error.message.includes('403') || error.message.includes('Forbidden')) {
                console.log('MangaPark is returning 403 Forbidden - likely blocked or requires different headers');
            }

            return [];
        }
    }

    async getChapters(mangaUrl) {
        try {
            console.log(`MangaPark getting chapters for: ${mangaUrl}`);
            const html = await this.fetchHtml(mangaUrl);
            const $ = this.loadHtml(html);
            const chapters = [];

            // Based on Kotatsu: "div.group.flex div.px-2"
            const chapterElements = $('div.group.flex div.px-2, .group .px-2');
            console.log(`MangaPark found ${chapterElements.length} chapter elements`);

            chapterElements.each((i, element) => {
                try {
                    const $element = $(element);

                    // Find chapter link
                    const $link = $element.find('a').first();
                    const href = $link.attr('href');

                    if (!href) return;

                    // Get chapter title
                    const chapterTitle = this.cleanText($link.text());
                    if (!chapterTitle) return;

                    // Extract chapter number (use index + 1 as fallback)
                    let chapterNumber = (i + 1).toString();
                    const numberMatch = chapterTitle.match(/(?:chapter|ch\.?)\s*(\d+(?:\.\d+)?)/i);
                    if (numberMatch) {
                        chapterNumber = numberMatch[1];
                    }

                    // Find upload date (span[q:key=Ee_0] based on Kotatsu)
                    let uploadDate = null;
                    const $date = $element.find('span[q\\:key=Ee_0], .date, .time').first();
                    if ($date.length) {
                        uploadDate = this.cleanText($date.text());
                    }

                    chapters.push({
                        id: this.extractIdFromUrl(href),
                        number: chapterNumber,
                        title: chapterTitle,
                        url: this.absoluteUrl(href),
                        uploadDate: uploadDate,
                        source: this.name
                    });
                } catch (error) {
                    console.error('Error parsing MangaPark chapter:', error);
                }
            });

            // Sort chapters by number (ascending)
            chapters.sort((a, b) => parseFloat(a.number) - parseFloat(b.number));

            console.log(`MangaPark found ${chapters.length} chapters`);
            return chapters;
        } catch (error) {
            console.error('MangaPark getChapters error:', error.message);
            return [];
        }
    }

    async getPages(chapterUrl) {
        try {
            console.log(`MangaPark getting pages for: ${chapterUrl}`);
            const html = await this.fetchHtml(chapterUrl);
            const $ = this.loadHtml(html);
            const pages = [];

            // Based on Kotatsu: extract chapter ID and look for script with image URLs
            const chapterId = chapterUrl.split('/').pop().split('-')[0];

            // Look for script containing the chapter ID
            let scriptContent = '';
            $('script').each((i, element) => {
                const content = $(element).html();
                if (content && content.includes(chapterId)) {
                    scriptContent = content;
                    return false; // Break the loop
                }
            });

            if (scriptContent) {
                // Extract image URLs using regex (based on Kotatsu pattern)
                const urlRegex = /"(https?:[^"]+)"/g;
                let match;
                let pageNumber = 1;

                while ((match = urlRegex.exec(scriptContent)) !== null) {
                    const url = match[1];

                    // Check if it's an image URL
                    if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') ||
                        url.includes('.webp') || url.includes('.gif') || url.includes('.jfif')) {

                        pages.push({
                            pageNumber: pageNumber++,
                            imageUrl: url
                        });
                    }
                }
            }

            console.log(`MangaPark found ${pages.length} pages`);
            return pages;
        } catch (error) {
            console.error('MangaPark getPages error:', error.message);
            return [];
        }
    }

    extractIdFromUrl(url) {
        // Extract ID from URL
        const match = url.match(/\/([^\/]+)\/?$/);
        return match ? match[1] : url.split('/').pop() || url;
    }
}

module.exports = MangaParkParser;