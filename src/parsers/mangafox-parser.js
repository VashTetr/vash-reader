const BaseParser = require('./base-parser');

class MangaFoxParser extends BaseParser {
    constructor() {
        super('MangaFox', 'https://mangafoxfull.com');
    }

    async search(query) {
        try {
            // MangaFox uses Madara-style search with POST request
            const searchUrl = `${this.baseUrl}/wp-admin/admin-ajax.php`;
            console.log(`MangaFox searching: ${searchUrl}`);

            // For now, use GET search as fallback
            const fallbackUrl = `${this.baseUrl}/?s=${encodeURIComponent(query)}`;
            const html = await this.fetchHtml(fallbackUrl);
            const $ = this.loadHtml(html);

            // Check if site is protected or unavailable
            const title = $('title').text();
            if (title.includes('Just a moment') ||
                title.includes('Checking your browser') ||
                title.includes('Please wait') ||
                title.includes('Error') ||
                html.includes('cloudflare') ||
                html.length < 5000) { // Very short HTML suggests protection page
                console.log('MangaFox is protected by anti-bot measures or unavailable');
                return [];
            }

            return this.parseMangaList($);
        } catch (error) {
            console.error('MangaFox search error:', error.message);
            return [];
        }
    }

    async getPopular(page = 1) {
        try {
            // Popular manga page (Madara style)
            const url = `${this.baseUrl}/manga/?m_orderby=views&page=${page}`;
            const html = await this.fetchHtml(url);
            const $ = this.loadHtml(html);

            return this.parseMangaList($);
        } catch (error) {
            console.error('MangaFox popular error:', error.message);
            return [];
        }
    }

    parseMangaList($) {
        const results = [];

        // Try multiple selectors for manga items (Madara style)
        const selectors = [
            '.page-item-detail',
            '.manga-item',
            '.c-tabs-item__content',
            '.tab-thumb',
            'a[href*="/manga/"]'
        ];

        let items = $();
        for (const selector of selectors) {
            items = $(selector);
            if (items.length > 0) {
                console.log(`MangaFox: Found ${items.length} items with selector: ${selector}`);
                break;
            }
        }

        items.each((i, element) => {
            try {
                const $element = $(element);

                // Find link
                const $link = $element.is('a') ? $element : $element.find('a').first();
                const href = $link.attr('href');

                if (!href || !href.includes('/manga/')) {
                    return; // Skip if not a manga link
                }

                // Find title
                const $title = $element.find('.post-title h3, .post-title h4, .tab-summary h3, h3, h4').first();
                const title = this.cleanText($title.text() || $link.attr('title') || '');

                if (!title) {
                    return; // Skip if no title found
                }

                // Find cover image
                let coverUrl = null;
                const $img = $element.find('img').first();
                if ($img.length) {
                    const src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src');
                    if (src && !src.includes('placeholder') && !src.includes('loading')) {
                        coverUrl = this.absoluteUrl(src);
                    }
                }

                // Find description
                const $desc = $element.find('.tab-summary .summary__content, .post-content, .description').first();
                const description = this.cleanText($desc.text());

                // Find status
                let status = null;
                const $status = $element.find('.mg_status .summary-content, .status, .badge').first();
                if ($status.length) {
                    const statusText = $status.text().trim().toLowerCase();
                    if (statusText.includes('ongoing')) status = 'Ongoing';
                    else if (statusText.includes('completed')) status = 'Completed';
                    else if (statusText.includes('hiatus')) status = 'Hiatus';
                    else if (statusText.includes('dropped')) status = 'Dropped';
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
                console.error('Error parsing MangaFox manga item:', error);
            }
        });

        console.log(`MangaFox found ${results.length} results`);
        return results;
    }

    async getChapters(mangaUrl) {
        try {
            console.log(`MangaFox getting chapters: ${mangaUrl}`);
            const html = await this.fetchHtml(mangaUrl);
            const $ = this.loadHtml(html);
            const chapters = [];

            // Try multiple selectors for chapter lists (Madara style)
            const selectors = [
                '.wp-manga-chapter a',
                '.chapter-list a',
                '.listing-chapters_wrap a',
                'a[href*="/chapter/"]',
                '.version-chap a'
            ];

            let chapterElements = $();
            for (const selector of selectors) {
                chapterElements = $(selector);
                if (chapterElements.length > 0) {
                    console.log(`MangaFox: Found ${chapterElements.length} chapters with selector: ${selector}`);
                    break;
                }
            }

            chapterElements.each((i, element) => {
                try {
                    const $element = $(element);
                    const href = $element.attr('href');

                    if (!href || !href.includes('/chapter/')) {
                        return; // Skip if not a chapter link
                    }

                    const chapterText = this.cleanText($element.text());

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
                                chapterNumber = (i + 1).toString();
                            }
                        }
                    }

                    // Find upload date
                    let uploadDate = null;
                    const $date = $element.find('.chapter-release-date, .date, .time').first();
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
                    console.error('Error parsing MangaFox chapter:', error);
                }
            });

            // Remove duplicates and sort by chapter number (ascending)
            const uniqueChapters = chapters.filter((chapter, index, self) =>
                index === self.findIndex(c => c.url === chapter.url)
            );

            uniqueChapters.sort((a, b) => parseFloat(a.number) - parseFloat(b.number));

            console.log(`MangaFox found ${uniqueChapters.length} chapters`);
            return uniqueChapters;
        } catch (error) {
            console.error('MangaFox getChapters error:', error.message);
            return [];
        }
    }

    async getPages(chapterUrl) {
        try {
            console.log(`MangaFox getting pages: ${chapterUrl}`);
            const html = await this.fetchHtml(chapterUrl);
            const $ = this.loadHtml(html);
            const pages = [];

            // Try multiple selectors for page images (Madara style)
            const selectors = [
                '.reading-content img',
                '.page-break img',
                '.wp-manga-chapter-img',
                'img[src*="chapter"]',
                'img[data-src*="chapter"]'
            ];

            let images = $();
            for (const selector of selectors) {
                images = $(selector);
                if (images.length > 0) {
                    console.log(`MangaFox: Found ${images.length} images with selector: ${selector}`);
                    break;
                }
            }

            images.each((i, element) => {
                try {
                    const $img = $(element);
                    const src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src');

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
                    console.error('Error parsing MangaFox page:', error);
                }
            });

            // Sort by page number
            pages.sort((a, b) => a.pageNumber - b.pageNumber);

            console.log(`MangaFox found ${pages.length} pages`);
            return pages;
        } catch (error) {
            console.error('MangaFox getPages error:', error.message);
            return [];
        }
    }

    extractIdFromUrl(url) {
        // Extract ID from URL
        const match = url.match(/\/([^\/]+)\/?$/);
        return match ? match[1] : url.split('/').pop() || url;
    }
}

module.exports = MangaFoxParser;