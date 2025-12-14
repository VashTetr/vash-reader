const BaseParser = require('./base-parser');

class MangaBuddyParser extends BaseParser {
    constructor() {
        super('MangaBuddy', 'https://mangabuddy.com');
    }

    async search(query) {
        const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;

        try {
            console.log(`MangaBuddy searching: ${searchUrl}`);
            const html = await this.fetchHtml(searchUrl);
            const $ = this.loadHtml(html);

            const results = [];

            // Try multiple selectors for search results
            const items = $('.book-item, .manga-item, .search-story-item, .list-story-item');

            items.each((i, element) => {
                const $el = $(element);
                const $link = $el.find('a').first();
                const $img = $el.find('img').first();
                const $title = $el.find('.title, .name, h3, h4, .book-name').first();

                if ($link.length) {
                    const href = $link.attr('href');
                    const title = this.cleanText($title.text() || $link.attr('title') || $link.text() || '');

                    if (href && title) {
                        results.push({
                            id: href.split('/').pop() || href.split('=').pop(),
                            title: title,
                            url: this.absoluteUrl(href),
                            coverUrl: $img.attr('src') ? this.absoluteUrl($img.attr('src')) : null,
                            description: this.cleanText($el.find('.description, .summary, .book-description, p').first().text()),
                            source: this.name
                        });
                    }
                }
            });

            console.log(`MangaBuddy found ${results.length} results`);
            return results;
        } catch (error) {
            console.error('MangaBuddy search error:', error.message);
            return [];
        }
    }

    async getChapters(mangaUrl) {
        try {
            console.log(`MangaBuddy getting chapters: ${mangaUrl}`);
            const html = await this.fetchHtml(mangaUrl);
            const $ = this.loadHtml(html);

            const chapters = [];

            // Try multiple selectors for chapters
            const chapterElements = $('.chapter-item, .chapter, .episode, .chapter-list li');
            const seenUrls = new Set(); // Track URLs to avoid duplicates

            chapterElements.each((i, element) => {
                const $el = $(element);
                const $link = $el.is('a') ? $el : $el.find('a').first();

                if ($link.length) {
                    const href = $link.attr('href');
                    const chapterText = this.cleanText($link.text() || $el.text());

                    // Skip if we've already seen this URL
                    if (seenUrls.has(href)) {
                        return;
                    }
                    seenUrls.add(href);

                    // Extract chapter number
                    let chapterNumber = '0';
                    const chapterMatch = chapterText.match(/(?:chapter|ch\.?|episode|ep\.?)\s*(\d+(?:\.\d+)?)/i);
                    if (chapterMatch) {
                        chapterNumber = chapterMatch[1];
                    } else {
                        const numberMatch = chapterText.match(/(\d+(?:\.\d+)?)/);
                        if (numberMatch) {
                            chapterNumber = numberMatch[1];
                        } else {
                            chapterNumber = (chapters.length + 1).toString(); // Use chapters.length instead of i
                        }
                    }

                    if (href && chapterText) {
                        chapters.push({
                            id: href.split('/').pop() || href.split('=').pop(),
                            number: chapterNumber,
                            title: chapterText,
                            url: this.absoluteUrl(href),
                            source: this.name
                        });
                    }
                }
            });

            // Sort chapters by number (ascending)
            chapters.sort((a, b) => parseFloat(a.number) - parseFloat(b.number));

            console.log(`MangaBuddy found ${chapters.length} chapters`);
            return chapters;
        } catch (error) {
            console.error('MangaBuddy chapters error:', error.message);
            return [];
        }
    }

    async getPages(chapterUrl) {
        try {
            console.log(`MangaBuddy getting pages: ${chapterUrl}`);
            const html = await this.fetchHtml(chapterUrl);
            const $ = this.loadHtml(html);

            const pages = [];
            const subDomain = "sb.mbcdn.xyz";

            // Try JavaScript parsing first (Kotatsu specific implementation)
            const scripts = $('script');
            let foundImages = false;

            scripts.each((i, script) => {
                const scriptContent = $(script).html() || '';
                const regexMatch = scriptContent.match(/chapImages\s*=\s*['"]([^'"]*)['"]/);
                if (regexMatch && regexMatch[1]) {
                    const chapImages = regexMatch[1];
                    console.log(`MangaBuddy found chapImages: ${chapImages.substring(0, 200)}...`);

                    const imageUrls = chapImages.split(',');
                    imageUrls.forEach((url, index) => {
                        if (url && url.trim()) {
                            // Extract the path after /manga and construct full URL using subdomain
                            const cleanUrl = url.trim().replace(/^.*\/manga/, '');
                            const fullImageUrl = `https://${subDomain}/manga${cleanUrl}`;

                            console.log(`MangaBuddy page ${index + 1}: ${fullImageUrl}`);
                            pages.push({
                                pageNumber: index + 1,
                                imageUrl: fullImageUrl
                            });
                        }
                    });
                    foundImages = true;
                    return false; // Break the loop
                }
            });

            // Fallback to HTML parsing if JavaScript method didn't work
            if (!foundImages) {
                console.log('MangaBuddy: chapImages not found, trying HTML parsing');
                const images = $('div#chapter-images img');
                images.each((i, element) => {
                    const $img = $(element);
                    let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original');

                    if (src) {
                        pages.push({
                            pageNumber: i + 1,
                            imageUrl: this.absoluteUrl(src)
                        });
                    }
                });
            }

            console.log(`MangaBuddy found ${pages.length} pages`);
            return pages;
        } catch (error) {
            console.error('MangaBuddy pages error:', error.message);
            return [];
        }
    }
}

module.exports = MangaBuddyParser;