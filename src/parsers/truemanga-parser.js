const BaseParser = require('./base-parser');

class TrueMangaParser extends BaseParser {
    constructor() {
        super('TrueManga', 'https://truemanga.com');
    }

    async search(query) {
        const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;

        try {
            console.log(`TrueManga searching: ${searchUrl}`);
            const html = await this.fetchHtml(searchUrl);
            const $ = this.loadHtml(html);

            const results = [];

            // Try multiple selectors for search results
            const items = $('.book-item, .manga-item, .search-item, .grid-item');

            items.each((i, element) => {
                const $el = $(element);
                const $link = $el.find('a').first();
                const $img = $el.find('img').first();
                const $title = $el.find('.title, .name, h3, h4').first();

                if ($link.length) {
                    const href = $link.attr('href');
                    const title = this.cleanText($title.text() || $link.attr('title') || $link.text() || '');

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
                            id: href.split('/').pop() || href.split('=').pop(),
                            title: title,
                            url: this.absoluteUrl(href),
                            coverUrl: coverUrl,
                            description: this.cleanText($el.find('.description, .summary, p').first().text()),
                            source: this.name
                        });
                    }
                }
            });

            console.log(`TrueManga found ${results.length} results`);
            return results;
        } catch (error) {
            console.error('TrueManga search error:', error.message);
            return [];
        }
    }

    async getChapters(mangaUrl) {
        try {
            console.log(`TrueManga getting chapters: ${mangaUrl}`);
            const html = await this.fetchHtml(mangaUrl);
            const $ = this.loadHtml(html);

            const chapters = [];

            // Try multiple selectors for chapters
            const chapterElements = $('.chapter-item, .chapter, .episode, li a[href*="chapter"]');

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

            console.log(`TrueManga found ${chapters.length} chapters`);
            return chapters;
        } catch (error) {
            console.error('TrueManga chapters error:', error.message);
            return [];
        }
    }

    async getPages(chapterUrl) {
        try {
            console.log(`TrueManga getting pages: ${chapterUrl}`);
            const html = await this.fetchHtml(chapterUrl);
            const $ = this.loadHtml(html);

            const pages = [];

            // First try JavaScript parsing (like MangaBuddy - TrueManga also uses chapImages)
            const scripts = $('script');
            let foundImages = false;

            scripts.each((i, script) => {
                const scriptContent = $(script).html() || '';
                const regexMatch = scriptContent.match(/chapImages\s*=\s*['"]([^'"]*)['"]/);
                if (regexMatch && regexMatch[1]) {
                    const chapImages = regexMatch[1];
                    console.log(`TrueManga found chapImages: ${chapImages.substring(0, 200)}...`);

                    const imageUrls = chapImages.split(',');
                    const subDomain = "sb.mbcdn.xyz"; // Use same subdomain as MangaBuddy

                    imageUrls.forEach((url, index) => {
                        if (url && url.trim()) {
                            // Convert to sb.mbcdn.xyz subdomain like MangaBuddy does
                            const cleanUrl = url.trim().replace(/^.*\/manga/, '');
                            const fullImageUrl = `https://${subDomain}/manga${cleanUrl}`;

                            console.log(`TrueManga page ${index + 1}: ${fullImageUrl}`);
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
                console.log('TrueManga: chapImages not found, trying HTML parsing');
                const images = $('img[src*=".jpg"], img[src*=".png"], img[data-src*=".jpg"], img[data-src*=".png"]');

                images.each((i, element) => {
                    const $img = $(element);
                    const src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original');

                    if (src && src.includes('/manga/') && !src.includes('x.gif')) {
                        pages.push({
                            pageNumber: pages.length + 1,
                            imageUrl: this.absoluteUrl(src)
                        });
                    }
                });
            }

            console.log(`TrueManga found ${pages.length} pages`);
            return pages;
        } catch (error) {
            console.error('TrueManga pages error:', error.message);
            return [];
        }
    }
}

module.exports = TrueMangaParser;