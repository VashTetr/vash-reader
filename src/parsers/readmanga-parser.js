const BaseParser = require('./base-parser');

class ReadMangaParser extends BaseParser {
    constructor() {
        super('ReadManga', 'https://readmanga.live');
    }

    async search(query) {
        try {
            // ReadManga uses a search endpoint
            const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;
            console.log(`ReadManga searching: ${searchUrl}`);
            const html = await this.fetchHtml(searchUrl);
            const $ = this.loadHtml(html);

            // Check if site is protected or unavailable
            const title = $('title').text();
            if (title.includes('Just a moment') ||
                title.includes('Checking your browser') ||
                title.includes('Please wait') ||
                title.includes('Error') ||
                html.includes('cloudflare') ||
                html.length < 5000) { // Very short HTML suggests protection page
                console.log('ReadManga is protected by anti-bot measures or unavailable');
                return [];
            }

            return this.parseMangaList($);
        } catch (error) {
            console.error('ReadManga search error:', error.message);
            return [];
        }
    }

    async getPopular(page = 1) {
        try {
            // Popular manga page
            const url = `${this.baseUrl}/list?sortType=rate&offset=${(page - 1) * 20}`;
            const html = await this.fetchHtml(url);
            const $ = this.loadHtml(html);

            return this.parseMangaList($);
        } catch (error) {
            console.error('ReadManga popular error:', error.message);
            return [];
        }
    }

    parseMangaList($) {
        const results = [];

        // Try multiple selectors for manga items (Grouple style)
        const selectors = [
            '.tiles .tile',
            'div.img', // Grouple specific structure
            '.manga-item',
            '.search-item',
            '.list-item',
            'a[href*="/manga/"]'
        ];

        let items = $();
        for (const selector of selectors) {
            items = $(selector);
            if (items.length > 0) {
                console.log(`ReadManga: Found ${items.length} items with selector: ${selector}`);
                break;
            }
        }

        items.each((i, element) => {
            try {
                const $element = $(element);

                // Find link
                const $link = $element.is('a') ? $element : $element.find('a').first();
                const href = $link.attr('href');

                if (!href || (!href.includes('/manga/') && !href.includes('/'))) {
                    return; // Skip if not a manga link
                }

                // Find title
                const $title = $element.find('.title, h3, h4, .name').first();
                const title = this.cleanText($title.text() || $link.attr('title') || $link.text() || '');

                if (!title) {
                    return; // Skip if no title found
                }

                // Find cover image - Grouple specific lazy loading
                let coverUrl = null;
                const $img = $element.find('img.lazy, img').first();
                if ($img.length) {
                    // Check data-original first (lazy loading), then data-src, then src
                    let src = $img.attr('data-original') || $img.attr('data-src') || $img.attr('src');
                    if (src && !src.includes('placeholder') && !src.includes('loading')) {
                        // Replace _p. with . for full size image (Grouple pattern)
                        src = src.replace('_p.', '.');
                        coverUrl = this.absoluteUrl(src);
                    }
                }

                // Find description
                const $desc = $element.find('.description, .summary, .manga-description').first();
                const description = this.cleanText($desc.text());

                // Find status
                let status = null;
                const $status = $element.find('.status, .badge').first();
                if ($status.length) {
                    const statusText = $status.text().trim().toLowerCase();
                    if (statusText.includes('продолжается') || statusText.includes('ongoing')) status = 'Ongoing';
                    else if (statusText.includes('завершён') || statusText.includes('completed')) status = 'Completed';
                    else if (statusText.includes('заморожен') || statusText.includes('hiatus')) status = 'Hiatus';
                    else if (statusText.includes('заброшен') || statusText.includes('dropped')) status = 'Dropped';
                }

                results.push({
                    id: this.extractIdFromUrl(href),
                    title: title,
                    url: this.absoluteUrl(href),
                    coverUrl: coverUrl,
                    description: description,
                    source: this.name,
                    status: status
                });
            } catch (error) {
                console.error('Error parsing ReadManga manga item:', error);
            }
        });

        console.log(`ReadManga found ${results.length} results`);
        return results;
    }

    async getChapters(mangaUrl) {
        try {
            console.log(`ReadManga getting chapters: ${mangaUrl}`);
            const html = await this.fetchHtml(mangaUrl);
            const $ = this.loadHtml(html);
            const chapters = [];

            // Try multiple selectors for chapter lists (Grouple style)
            const selectors = [
                '.chapters-link a',
                '.chapter-link a',
                'a[href*="/vol"]',
                '.table a',
                '.list-group a'
            ];

            let chapterElements = $();
            for (const selector of selectors) {
                chapterElements = $(selector);
                if (chapterElements.length > 0) {
                    console.log(`ReadManga: Found ${chapterElements.length} chapters with selector: ${selector}`);
                    break;
                }
            }

            chapterElements.each((i, element) => {
                try {
                    const $element = $(element);
                    const href = $element.attr('href');

                    if (!href || (!href.includes('/vol') && !href.includes('/chapter'))) {
                        return; // Skip if not a chapter link
                    }

                    const chapterText = this.cleanText($element.text());

                    // Extract chapter number
                    let chapterNumber = '0';

                    // Try to extract from URL first (most reliable)
                    const urlMatch = href.match(/vol(\d+)\/(\d+(?:\.\d+)?)/i) || href.match(/chapter[/-](\d+(?:\.\d+)?)/i);
                    if (urlMatch) {
                        chapterNumber = urlMatch[2] || urlMatch[1];
                    } else {
                        // Try to extract from text
                        const chapterMatch = chapterText.match(/(?:глава|chapter|том|vol)\s*(\d+(?:\.\d+)?)/i);
                        if (chapterMatch) {
                            chapterNumber = chapterMatch[1];
                        } else {
                            // Try to find any number in the text
                            const numberMatch = chapterText.match(/(\d+(?:\.\d+)?)/);
                            if (numberMatch) {
                                chapterNumber = numberMatch[1];
                            } else {
                                // Use index as fallback
                                chapterNumber = (i + 1).toString();
                            }
                        }
                    }

                    // Find upload date
                    let uploadDate = null;
                    const $date = $element.find('.date, .time, .chapter-date').first();
                    if ($date.length) {
                        uploadDate = this.cleanText($date.text());
                    }

                    chapters.push({
                        id: this.extractIdFromUrl(href),
                        number: chapterNumber,
                        title: chapterText,
                        url: this.absoluteUrl(href),
                        source: this.name,
                        uploadDate: uploadDate
                    });
                } catch (error) {
                    console.error('Error parsing ReadManga chapter:', error);
                }
            });

            // Remove duplicates and sort by chapter number (ascending)
            const uniqueChapters = chapters.filter((chapter, index, self) =>
                index === self.findIndex(c => c.url === chapter.url)
            );

            uniqueChapters.sort((a, b) => parseFloat(a.number) - parseFloat(b.number));

            console.log(`ReadManga found ${uniqueChapters.length} chapters`);
            return uniqueChapters;
        } catch (error) {
            console.error('ReadManga getChapters error:', error.message);
            return [];
        }
    }

    async getPages(chapterUrl) {
        try {
            console.log(`ReadManga getting pages: ${chapterUrl}`);
            const html = await this.fetchHtml(chapterUrl);
            const $ = this.loadHtml(html);
            const pages = [];

            // Try multiple selectors for page images (Grouple style)
            const selectors = [
                '.reader img',
                '.reading-content img',
                '.chapter-content img',
                'img[src*="img"]',
                'img[data-src*="img"]'
            ];

            let images = $();
            for (const selector of selectors) {
                images = $(selector);
                if (images.length > 0) {
                    console.log(`ReadManga: Found ${images.length} images with selector: ${selector}`);
                    break;
                }
            }

            images.each((i, element) => {
                try {
                    const $img = $(element);
                    const src = $img.attr('src') || $img.attr('data-src');

                    if (src &&
                        (src.includes('.jpg') || src.includes('.png') || src.includes('.webp') || src.includes('.jpeg')) &&
                        !src.includes('loading') &&
                        !src.includes('placeholder') &&
                        !src.includes('logo') &&
                        !src.includes('avatar')) {

                        // Extract page number from alt text or use index
                        let pageNumber = i + 1;
                        const alt = $img.attr('alt') || '';
                        const pageMatch = alt.match(/page\s*(\d+)/i);
                        if (pageMatch) {
                            pageNumber = parseInt(pageMatch[1]);
                        }

                        pages.push({
                            pageNumber: pageNumber,
                            imageUrl: this.absoluteUrl(src)
                        });
                    }
                } catch (error) {
                    console.error('Error parsing ReadManga page:', error);
                }
            });

            // Sort by page number
            pages.sort((a, b) => a.pageNumber - b.pageNumber);

            console.log(`ReadManga found ${pages.length} pages`);
            return pages;
        } catch (error) {
            console.error('ReadManga getPages error:', error.message);
            return [];
        }
    }

    extractIdFromUrl(url) {
        // Extract ID from URL
        const match = url.match(/\/([^\/]+)\/?$/);
        return match ? match[1] : url.split('/').pop() || url;
    }
}

module.exports = ReadMangaParser;