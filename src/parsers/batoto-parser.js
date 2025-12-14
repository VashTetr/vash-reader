const BaseParser = require('./base-parser');

class BatoToParser extends BaseParser {
    constructor() {
        super('Bato.To', 'https://bato.to');
    }

    async search(query) {
        const searchUrl = `${this.baseUrl}/search?word=${encodeURIComponent(query)}`;

        try {
            console.log(`Bato.To searching: ${searchUrl}`);
            const html = await this.fetchHtml(searchUrl);
            const $ = this.loadHtml(html);

            const results = [];

            // Try multiple selectors for search results
            const items = $('.item-cover, .book-item, .manga-item, .search-item');

            items.each((i, element) => {
                const $el = $(element);
                const $link = $el.find('a').first();
                const $img = $el.find('img').first();
                const $title = $el.find('.item-title, .title, .name, h3, h4').first();

                if ($link.length) {
                    const href = $link.attr('href');
                    const title = this.cleanText($title.text() || $link.attr('title') || $link.text() || '');

                    if (href && title) {
                        results.push({
                            id: href.split('/').pop() || href.split('=').pop(),
                            title: title,
                            url: this.absoluteUrl(href),
                            coverUrl: $img.attr('src') ? this.absoluteUrl($img.attr('src')) : null,
                            description: this.cleanText($el.find('.item-summary, .description, .summary, p').first().text()),
                            source: this.name
                        });
                    }
                }
            });

            console.log(`Bato.To found ${results.length} results`);
            return results;
        } catch (error) {
            console.error('Bato.To search error:', error.message);
            return [];
        }
    }

    async getChapters(mangaUrl) {
        try {
            console.log(`Bato.To getting chapters: ${mangaUrl}`);
            const html = await this.fetchHtml(mangaUrl);
            const $ = this.loadHtml(html);

            const chapters = [];

            // Try multiple selectors for chapters
            const chapterElements = $('.episode-list .item, .chapter-item, .chapter, .episode');

            chapterElements.each((i, element) => {
                const $el = $(element);
                const $link = $el.find('a').first();

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

            console.log(`Bato.To found ${chapters.length} chapters`);
            return chapters;
        } catch (error) {
            console.error('Bato.To chapters error:', error.message);
            return [];
        }
    }

    async getPages(chapterUrl) {
        try {
            console.log(`Bato.To getting pages: ${chapterUrl}`);
            const html = await this.fetchHtml(chapterUrl);
            const $ = this.loadHtml(html);

            const pages = [];

            // Try multiple selectors for images
            const images = $('.page-img img, .reader-img img, .chapter-img img, #reader img, .reading-content img');

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

            console.log(`Bato.To found ${pages.length} pages`);
            return pages;
        } catch (error) {
            console.error('Bato.To pages error:', error.message);
            return [];
        }
    }
}

module.exports = BatoToParser;