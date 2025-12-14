const BaseParser = require('./base-parser');

class MangaTownParser extends BaseParser {
    constructor() {
        super('MangaTown', 'https://www.mangatown.com');
    }

    async search(query) {
        const searchUrl = `${this.baseUrl}/search?name=${encodeURIComponent(query)}`;

        try {
            console.log(`MangaTown searching: ${searchUrl}`);
            const html = await this.fetchHtml(searchUrl);
            const $ = this.loadHtml(html);

            const results = [];

            // Try multiple selectors for search results
            const items = $('.manga_pic_list li, .book-item, .manga-item, .search-item');

            items.each((i, element) => {
                const $el = $(element);
                const $link = $el.find('a').first();
                const $img = $el.find('img').first();
                const $title = $el.find('.title, .name, h3, h4, .manga_name').first();

                if ($link.length) {
                    const href = $link.attr('href');
                    const title = this.cleanText($title.text() || $link.attr('title') || $link.text() || '');

                    if (href && title) {
                        results.push({
                            id: href.split('/').pop() || href.split('=').pop(),
                            title: title,
                            url: this.absoluteUrl(href),
                            coverUrl: $img.attr('src') ? this.absoluteUrl($img.attr('src')) : null,
                            description: this.cleanText($el.find('.description, .summary, p').first().text()),
                            source: this.name
                        });
                    }
                }
            });

            console.log(`MangaTown found ${results.length} results`);
            return results;
        } catch (error) {
            console.error('MangaTown search error:', error.message);
            return [];
        }
    }

    async getChapters(mangaUrl) {
        try {
            console.log(`MangaTown getting chapters: ${mangaUrl}`);
            const html = await this.fetchHtml(mangaUrl);
            const $ = this.loadHtml(html);

            const chapters = [];

            // Try multiple selectors for chapters
            const chapterElements = $('.chapter_list li a, .chapter-item, .chapter, .episode');

            chapterElements.each((i, element) => {
                const $el = $(element);
                const $link = $el.is('a') ? $el : $el.find('a').first();

                if ($link.length) {
                    const href = $link.attr('href');
                    const chapterText = this.cleanText($link.text() || $el.text());

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
                            chapterNumber = (i + 1).toString();
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

            console.log(`MangaTown found ${chapters.length} chapters`);
            return chapters;
        } catch (error) {
            console.error('MangaTown chapters error:', error.message);
            return [];
        }
    }

    async getPages(chapterUrl) {
        try {
            console.log(`MangaTown getting pages: ${chapterUrl}`);
            const html = await this.fetchHtml(chapterUrl);
            const $ = this.loadHtml(html);

            const pages = [];

            // Check if it's a webtoon (has direct images) or manga (has page selector)
            const pageSelect = $('div.page_select select');

            if (pageSelect.length === 0) {
                // Webtoon format - direct images (following Kotatsu exactly)
                console.log('MangaTown: Detected webtoon format');
                const images = $('div#viewer.read_img img.image');

                images.each((i, element) => {
                    const $img = $(element);
                    const src = $img.attr('src');

                    if (src) {
                        pages.push({
                            pageNumber: i + 1,
                            imageUrl: this.absoluteUrl(src)
                        });
                    }
                });
            } else {
                // Manga format - page selector (following Kotatsu exactly)
                console.log('MangaTown: Detected manga format with page selector');
                const options = pageSelect.find('option');

                // Return page URLs that will be resolved later (like Kotatsu does)
                options.each((i, option) => {
                    const $option = $(option);
                    const pageUrl = $option.attr('value');

                    if (pageUrl && !pageUrl.endsWith('featured.html')) {
                        pages.push({
                            pageNumber: i + 1,
                            imageUrl: this.absoluteUrl(pageUrl), // This will be resolved to actual image URL
                            needsResolution: true // Flag to indicate this needs getPageUrl resolution
                        });
                    }
                });
            }

            console.log(`MangaTown found ${pages.length} pages`);
            return pages;
        } catch (error) {
            console.error('MangaTown pages error:', error.message);
            return [];
        }
    }

    // Method to resolve page URL to actual image URL (like Kotatsu's getPageUrl)
    async getPageUrl(pageUrl) {
        try {
            if (pageUrl.startsWith('//')) {
                // Webtoon format - already has image URL
                return this.absoluteUrl(pageUrl);
            }

            // Manga format - need to resolve page URL to image URL
            console.log(`MangaTown: Resolving page URL: ${pageUrl}`);
            const html = await this.fetchHtml(pageUrl);
            const $ = this.loadHtml(html);
            const imgSrc = $('#image').attr('src');

            if (imgSrc) {
                return this.absoluteUrl(imgSrc);
            }

            return pageUrl; // Fallback
        } catch (error) {
            console.error('MangaTown getPageUrl error:', error.message);
            return pageUrl; // Fallback
        }
    }
}

module.exports = MangaTownParser;