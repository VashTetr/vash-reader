const BaseParser = require('./base-parser');

class ManganatoParser extends BaseParser {
    constructor() {
        super('Manganato', 'https://nelomanga.net');
        this.alternativeDomains = [
            'https://readmanganato.com',
            'https://chapmanganato.com',
            'https://manganato.com',
            'https://nelomanga.net',
            'https://mangakakalot.com'
        ];
    }

    async fetchWithFallback(url) {
        // Try the original URL first
        try {
            console.log(`Trying to fetch from: ${url}`);
            return await this.fetchHtml(url);
        } catch (error) {
            console.log(`Failed to fetch from ${url}: ${error.message}`);
            console.log(`Trying alternative domains...`);

            // Try alternative domains
            for (const domain of this.alternativeDomains) {
                const alternativeUrl = url.replace(this.baseUrl, domain);
                try {
                    console.log(`Trying alternative: ${alternativeUrl}`);
                    return await this.fetchHtml(alternativeUrl);
                } catch (altError) {
                    console.log(`Failed to fetch from ${alternativeUrl}: ${altError.message}`);
                }
            }

            throw new Error(`All domains failed for ${this.name}. Last error: ${error.message}`);
        }
    }

    async search(query) {
        const searchUrl = `${this.baseUrl}/search/story/${encodeURIComponent(query)}`;

        try {
            const html = await this.fetchWithFallback(searchUrl);
            const $ = this.loadHtml(html);

            const results = [];

            // Try multiple selectors for different layouts
            const items = $('.search-story-item, .story_item, .list-story-item');

            items.each((i, element) => {
                const $el = $(element);
                const $link = $el.find('.item-title a, .story_name a, h3 a, a').first();
                const $img = $el.find('.item-img img, img').first();

                if ($link.length) {
                    const href = $link.attr('href');
                    const title = this.cleanText($link.text() || $link.attr('title') || '');

                    if (href && title) {
                        results.push({
                            id: href.split('/').pop() || href.split('=').pop(),
                            title: title,
                            url: this.absoluteUrl(href),
                            coverUrl: $img.attr('src') ? this.absoluteUrl($img.attr('src')) : null,
                            description: this.cleanText($el.find('.item-description, .story_item_right p').text()),
                            source: this.name
                        });
                    }
                }
            });

            return results;
        } catch (error) {
            console.error('Manganato search error:', error);
            return [];
        }
    }

    async getChapters(mangaUrl) {
        try {
            const html = await this.fetchWithFallback(mangaUrl);
            const $ = this.loadHtml(html);

            const chapters = [];

            // Try multiple selectors for different layouts
            const chapterElements = $('.row-content-chapter li, .chapter-list .row, ul.row-content-chapter li');

            chapterElements.each((i, element) => {
                const $el = $(element);
                const $link = $el.find('a').first();

                if ($link.length) {
                    const href = $link.attr('href');
                    const chapterText = this.cleanText($link.text());

                    // Extract chapter number more reliably
                    let chapterNumber = '0';
                    const chapterMatch = chapterText.match(/(?:chapter|ch\.?)\s*(\d+(?:\.\d+)?)/i);
                    if (chapterMatch) {
                        chapterNumber = chapterMatch[1];
                    } else {
                        // Fallback: try to extract any number from the text
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
                            source: this.name,
                            uploadDate: this.cleanText($el.find('span').last().text())
                        });
                    }
                }
            });

            // Sort chapters by number (ascending - Chapter 1 first)
            chapters.sort((a, b) => parseFloat(a.number) - parseFloat(b.number));

            return chapters;
        } catch (error) {
            console.error('Manganato chapters error:', error);
            return [];
        }
    }

    async getPages(chapterUrl) {
        try {
            const html = await this.fetchWithFallback(chapterUrl);
            const $ = this.loadHtml(html);

            const pages = [];

            // Try multiple selectors for different layouts
            const images = $('.container-chapter-reader img, #vungdoc img, .reading-content img');

            images.each((i, element) => {
                const $img = $(element);
                const src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original');

                if (src) {
                    pages.push({
                        pageNumber: i + 1,
                        imageUrl: this.absoluteUrl(src)
                    });
                }
            });

            return pages;
        } catch (error) {
            console.error('Manganato pages error:', error);
            return [];
        }
    }
}

module.exports = ManganatoParser;