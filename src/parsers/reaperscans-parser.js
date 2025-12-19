const BaseParser = require('./base-parser');

class ReaperScansParser extends BaseParser {
    constructor() {
        super('ReaperScans', 'https://reaper-scans.com');
    }

    async search(query) {
        try {
            // ReaperScans uses WordPress-style search
            const searchUrl = `${this.baseUrl}/page/1/?s=${encodeURIComponent(query)}`;
            console.log(`ReaperScans searching: ${searchUrl}`);
            const html = await this.fetchHtml(searchUrl);
            const $ = this.loadHtml(html);

            // Check if site is accessible
            const title = $('title').text();
            if (title.includes('Maintenance Mode') ||
                title.includes('Redirecting') ||
                title.includes('Error') ||
                html.includes('Cease and Desist') ||
                html.length < 5000) { // Very short HTML suggests redirect or error page
                console.log('ReaperScans is currently unavailable or redirecting');
                return [];
            }

            return this.parseMangaList($);
        } catch (error) {
            console.error('ReaperScans search error:', error.message);
            return [];
        }
    }

    async getPopular(page = 1) {
        try {
            // Popular manga page using MangaReader structure
            const url = `${this.baseUrl}/manga/?order=popular&page=${page}`;
            const html = await this.fetchHtml(url);
            const $ = this.loadHtml(html);

            // Check if site is accessible
            const title = $('title').text();
            if (title.includes('Maintenance Mode') ||
                title.includes('Redirecting') ||
                title.includes('Error') ||
                html.includes('Cease and Desist') ||
                html.length < 5000) { // Very short HTML suggests redirect or error page
                console.log('ReaperScans is currently unavailable or redirecting');
                return [];
            }

            return this.parseMangaList($);
        } catch (error) {
            console.error('ReaperScans popular error:', error.message);
            return [];
        }
    }

    parseMangaList($) {
        const results = [];

        // Try multiple selectors for manga items (MangaReader style)
        const selectors = [
            '.listupd .bs .bsx a', // Common MangaReader layout
            '.manga-item a',
            '.series-item a',
            '.post-item a',
            '.grid-item a',
            'article a[href*="/manga/"]', // Direct manga links
            '.wp-manga-item a'
        ];

        let items = $();
        for (const selector of selectors) {
            items = $(selector);
            if (items.length > 0) {
                console.log(`ReaperScans: Found ${items.length} items with selector: ${selector}`);
                break;
            }
        }

        items.each((i, element) => {
            try {
                const $element = $(element);
                const href = $element.attr('href');

                if (!href || (!href.includes('/manga/') && !href.includes('/series/'))) {
                    return; // Skip if not a manga link
                }

                // Find title - could be in various places
                let title = '';
                const $titleElement = $element.find('.tt, .title, h3, h2').first();
                if ($titleElement.length) {
                    title = this.cleanText($titleElement.text());
                } else {
                    title = this.cleanText($element.attr('title') || $element.text());
                }

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
                let description = '';
                const $desc = $element.closest('article, .bsx').find('.excerpt, .summary, .description').first();
                if ($desc.length) {
                    description = this.cleanText($desc.text());
                }

                // Find status
                let status = null;
                const $status = $element.closest('article, .bsx').find('.status, .badge, .ongoing, .completed').first();
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
                console.error('Error parsing ReaperScans manga item:', error);
            }
        });

        console.log(`ReaperScans found ${results.length} results`);
        return results;
    }

    async getChapters(mangaUrl) {
        try {
            console.log(`ReaperScans getting chapters: ${mangaUrl}`);
            const html = await this.fetchHtml(mangaUrl);
            const $ = this.loadHtml(html);
            const chapters = [];

            // Try multiple selectors for chapter lists (MangaReader style)
            const selectors = [
                '.chapter-list a',
                '.chapters a',
                '.listing-chapters_wrap a',
                '.wp-manga-chapter a',
                'a[href*="/chapter/"]',
                '.episode-list a'
            ];

            let chapterElements = $();
            for (const selector of selectors) {
                chapterElements = $(selector);
                if (chapterElements.length > 0) {
                    console.log(`ReaperScans: Found ${chapterElements.length} chapters with selector: ${selector}`);
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
                    console.error('Error parsing ReaperScans chapter:', error);
                }
            });

            // Remove duplicates and sort by chapter number (ascending)
            const uniqueChapters = chapters.filter((chapter, index, self) =>
                index === self.findIndex(c => c.url === chapter.url)
            );

            uniqueChapters.sort((a, b) => parseFloat(a.number) - parseFloat(b.number));

            console.log(`ReaperScans found ${uniqueChapters.length} chapters`);
            return uniqueChapters;
        } catch (error) {
            console.error('ReaperScans getChapters error:', error.message);
            return [];
        }
    }

    async getPages(chapterUrl) {
        try {
            console.log(`ReaperScans getting pages: ${chapterUrl}`);
            const html = await this.fetchHtml(chapterUrl);
            const $ = this.loadHtml(html);
            const pages = [];

            // Try multiple selectors for page images (MangaReader style)
            const selectors = [
                '.reading-content img',
                '.chapter-content img',
                '.page-break img',
                '.entry-content img',
                '#readerarea img',
                '.reader-area img',
                'img[src*="chapter"]',
                'img[data-src*="chapter"]'
            ];

            let images = $();
            for (const selector of selectors) {
                images = $(selector);
                if (images.length > 0) {
                    console.log(`ReaperScans: Found ${images.length} images with selector: ${selector}`);
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
                        !src.includes('avatar') &&
                        !src.includes('icon')) {

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
                    console.error('Error parsing ReaperScans page:', error);
                }
            });

            // Sort by page number
            pages.sort((a, b) => a.pageNumber - b.pageNumber);

            console.log(`ReaperScans found ${pages.length} pages`);
            return pages;
        } catch (error) {
            console.error('ReaperScans getPages error:', error.message);
            return [];
        }
    }

    extractIdFromUrl(url) {
        // Extract ID from URL
        const match = url.match(/\/([^\/]+)\/?$/);
        return match ? match[1] : url.split('/').pop() || url;
    }
}

module.exports = ReaperScansParser;