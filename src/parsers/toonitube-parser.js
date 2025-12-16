const BaseParser = require('./base-parser');

class TooniTubeParser extends BaseParser {
    constructor() {
        super('TooniTube', 'https://toonitube.com');
    }

    async search(query) {
        const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;

        try {
            console.log(`TooniTube searching: ${searchUrl}`);
            const html = await this.fetchHtml(searchUrl);
            const $ = this.loadHtml(html);

            const results = [];

            // TooniTube uses .book-item for search results
            const items = $('.book-item');

            items.each((i, element) => {
                const $el = $(element);
                const $link = $el.find('a').first();
                const $img = $el.find('img').first();
                const $title = $el.find('.title, .name, h3, h4').first();

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

            console.log(`TooniTube found ${results.length} results`);
            return results;
        } catch (error) {
            console.error('TooniTube search error:', error.message);
            return [];
        }
    }

    async getChapters(mangaUrl) {
        try {
            console.log(`TooniTube getting chapters: ${mangaUrl}`);
            const html = await this.fetchHtml(mangaUrl);
            const $ = this.loadHtml(html);

            const chapters = [];

            // TooniTube uses a[href*="chapter"] for chapter links
            const chapterElements = $('a[href*="chapter"]');

            chapterElements.each((i, element) => {
                const $el = $(element);
                const href = $el.attr('href');
                const chapterText = this.cleanText($el.text());

                // Only include chapters that belong to this manga
                const mangaSlug = mangaUrl.split('/').pop();
                if (href && href.includes(mangaSlug) && chapterText) {
                    // Extract chapter number
                    let chapterNumber = '0';

                    // Try to extract from URL first (most reliable)
                    const urlMatch = href.match(/chapter[/-](\d+(?:\.\d+)?)/i);
                    if (urlMatch) {
                        chapterNumber = urlMatch[1];
                    } else {
                        // Try to extract from text
                        const chapterMatch = chapterText.match(/(?:chapter|ch\.?|episode|ep\.?)\s*(\d+(?:\.\d+)?)/i);
                        if (chapterMatch) {
                            chapterNumber = chapterMatch[1];
                        } else {
                            // Try to find any number in the text
                            const numberMatch = chapterText.match(/(\d+(?:\.\d+)?)/);
                            if (numberMatch) {
                                chapterNumber = numberMatch[1];
                            } else {
                                // Use index as fallback
                                chapterNumber = (chapters.length + 1).toString();
                            }
                        }
                    }

                    chapters.push({
                        id: href.split('/').pop() || href.split('=').pop(),
                        number: chapterNumber,
                        title: chapterText,
                        url: this.absoluteUrl(href),
                        source: this.name
                    });
                }
            });

            // Remove duplicates and sort by chapter number (ascending)
            const uniqueChapters = chapters.filter((chapter, index, self) =>
                index === self.findIndex(c => c.url === chapter.url)
            );

            uniqueChapters.sort((a, b) => parseFloat(a.number) - parseFloat(b.number));

            console.log(`TooniTube found ${uniqueChapters.length} chapters`);
            return uniqueChapters;
        } catch (error) {
            console.error('TooniTube chapters error:', error.message);
            return [];
        }
    }

    async getPages(chapterUrl) {
        try {
            console.log(`TooniTube getting pages: ${chapterUrl}`);
            const html = await this.fetchHtml(chapterUrl);
            const $ = this.loadHtml(html);

            const pages = [];

            // TooniTube uses img tags with data-src attributes within .chapter-image divs
            const images = $('.chapter-image img[data-src], img[data-src]');

            images.each((i, element) => {
                const $img = $(element);
                const dataSrc = $img.attr('data-src');
                const alt = $img.attr('alt') || '';

                // Only include manga page images (exclude UI elements)
                if (dataSrc &&
                    (dataSrc.includes('.jpg') || dataSrc.includes('.png') || dataSrc.includes('.webp')) &&
                    !dataSrc.includes('loading.svg') &&
                    !dataSrc.includes('logo') &&
                    !dataSrc.includes('avatar') &&
                    !dataSrc.includes('icon')) {

                    // Extract page number from alt text or use index
                    let pageNumber = i + 1;
                    const pageMatch = alt.match(/page\s*(\d+)/i);
                    if (pageMatch) {
                        pageNumber = parseInt(pageMatch[1]);
                    }

                    pages.push({
                        pageNumber: pageNumber,
                        imageUrl: dataSrc
                    });
                }
            });

            // Sort by page number
            pages.sort((a, b) => a.pageNumber - b.pageNumber);

            console.log(`TooniTube found ${pages.length} pages`);
            return pages;
        } catch (error) {
            console.error('TooniTube pages error:', error.message);
            return [];
        }
    }
}

module.exports = TooniTubeParser;