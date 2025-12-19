const BaseParser = require('./base-parser');

class MangaJinxParser extends BaseParser {
    constructor() {
        super('MangaJinx', 'https://mgjinx.com');
    }

    async search(query) {
        const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;

        try {

            const html = await this.fetchHtml(searchUrl);
            const $ = this.loadHtml(html);

            const results = [];

            // MangaJinx uses .book-item for search results
            $('.book-item').each((i, element) => {
                const $el = $(element);
                const $link = $el.find('a').first();
                const $img = $el.find('img').first();

                if ($link.length) {
                    const href = $link.attr('href');
                    let title = this.cleanText($el.find('.title, .name, h3, h4').text() || $link.text() || '');
                    // Remove duplicate title if it appears twice
                    const words = title.split(' ');
                    const halfLength = Math.floor(words.length / 2);
                    if (words.length > 2 && words.slice(0, halfLength).join(' ') === words.slice(halfLength).join(' ')) {
                        title = words.slice(0, halfLength).join(' ');
                    }

                    if (href && title) {
                        // Try multiple attributes for cover image (lazy loading)
                        let coverUrl = null;
                        if ($img.length) {
                            const imgSrc = $img.attr('data-src') || $img.attr('data-original') || $img.attr('src');
                            if (imgSrc && !imgSrc.includes('x.gif') && !imgSrc.includes('placeholder')) {
                                coverUrl = this.absoluteUrl(imgSrc);
                            }
                        }

                        results.push({
                            id: href.split('/').pop() || href.split('-').pop(),
                            title: title,
                            url: this.absoluteUrl(href),
                            coverUrl: coverUrl,
                            description: this.cleanText($el.find('.description, .summary, p').first().text()),
                            source: this.name
                        });
                    }
                }
            });


            return results;
        } catch (error) {
            console.error('MangaJinx search error:', error.message);
            return [];
        }
    }

    async getChapters(mangaUrl) {
        try {

            const html = await this.fetchHtml(mangaUrl);
            const $ = this.loadHtml(html);

            const chapters = [];

            // MangaJinx uses ul#chapter-list li for chapters
            $('ul#chapter-list li').each((i, element) => {
                const $el = $(element);
                const $link = $el.find('a').first();

                if ($link.length) {
                    const href = $link.attr('href');
                    const chapterText = this.cleanText($link.text() || $el.text());

                    // Extract chapter number from URL (more reliable than text)
                    let chapterNumber = '0';
                    const urlMatch = href.match(/chapter-(\d+(?:\.\d+)?)/i);
                    if (urlMatch) {
                        chapterNumber = urlMatch[1];
                    } else {
                        // Fallback to text parsing
                        const chapterMatch = chapterText.match(/chapter\s*(\d+(?:\.\d+)?)/i);
                        if (chapterMatch) {
                            chapterNumber = chapterMatch[1];
                        } else {
                            chapterNumber = (i + 1).toString();
                        }
                    }

                    if (href && chapterText) {
                        chapters.push({
                            id: href.split('/').pop() || href.split('-').pop(),
                            number: chapterNumber,
                            title: chapterText,
                            url: this.absoluteUrl(href),
                            source: this.name
                        });
                    }
                }
            });

            // Sort chapters by number (ascending - Chapter 1 first)
            chapters.sort((a, b) => parseFloat(a.number) - parseFloat(b.number));


            return chapters;
        } catch (error) {
            console.error('MangaJinx chapters error:', error.message);
            return [];
        }
    }

    async getPages(chapterUrl) {
        try {

            const html = await this.fetchHtml(chapterUrl);
            const $ = this.loadHtml(html);

            const pages = [];

            // MangaJinx uses chapImages JavaScript variable
            const scripts = $('script');
            let foundImages = false;

            scripts.each((i, script) => {
                const scriptContent = $(script).html() || '';
                const regexMatch = scriptContent.match(/chapImages\s*=\s*['"]([^'"]*)['"]/);
                if (regexMatch && regexMatch[1]) {
                    const chapImages = regexMatch[1];


                    const imageUrls = chapImages.split(',');

                    imageUrls.forEach((url, index) => {
                        if (url && url.trim()) {
                            const cleanUrl = url.trim();


                            pages.push({
                                pageNumber: index + 1,
                                imageUrl: cleanUrl // Use the full URL as provided
                            });
                        }
                    });
                    foundImages = true;
                    return false; // Break the loop
                }
            });

            // Fallback to HTML parsing if JavaScript method didn't work
            if (!foundImages) {

                const images = $('div#chapter-images img, .chapter-images img, .reading-content img');

                images.each((i, element) => {
                    const $img = $(element);
                    const src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original');

                    if (src) {
                        pages.push({
                            pageNumber: pages.length + 1,
                            imageUrl: this.absoluteUrl(src)
                        });
                    }
                });
            }


            return pages;
        } catch (error) {
            console.error('MangaJinx pages error:', error.message);
            return [];
        }
    }
}

module.exports = MangaJinxParser;