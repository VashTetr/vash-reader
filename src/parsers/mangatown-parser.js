const BaseParser = require('./base-parser');
const ParserUtils = require('../utils/parser-utils');

class MangaTownParser extends BaseParser {
    constructor() {
        super('MangaTown', 'https://www.mangatown.com');
        this.minRequestInterval = 200; // Slower requests for MangaTown
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
                        // Enhanced image extraction
                        const coverUrl = this.extractImageSrc($img);

                        results.push({
                            id: this.generateId(href),
                            title: title,
                            url: this.absoluteUrl(href),
                            coverUrl: coverUrl ? this.absoluteUrl(coverUrl) : null,
                            description: this.cleanText($el.find('.description, .summary, p').first().text()),
                            source: this.name,
                            // Additional metadata
                            rating: this.extractRating($el),
                            status: this.normalizeState($el.find('.status, .state').text()),
                            lastUpdated: this.parseDate($el.find('.date, .updated, .time').text())
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

                    // Enhanced chapter number extraction
                    const chapterNumber = this.extractChapterNumber(chapterText) || (i + 1);

                    // Extract date if available
                    const dateText = $el.find('.date, .time, .updated').text() ||
                        $el.parent().find('.date, .time, .updated').text();
                    const uploadDate = this.parseDate(dateText);

                    if (href && chapterText) {
                        chapters.push({
                            id: this.generateId(href),
                            number: chapterNumber.toString(),
                            title: chapterText,
                            url: this.absoluteUrl(href),
                            source: this.name,
                            uploadDate: uploadDate,
                            // Additional metadata
                            scanlator: this.cleanText($el.find('.scanlator, .group').text()),
                            views: this.extractViews($el)
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
                // Webtoon format - direct images
                console.log('MangaTown: Detected webtoon format');
                const images = $('div#viewer.read_img img.image');

                images.each((i, element) => {
                    const $img = $(element);
                    const src = this.extractImageSrc($img);

                    if (src && !ParserUtils.isPlaceholderImage(src)) {
                        pages.push({
                            pageNumber: i + 1,
                            imageUrl: this.absoluteUrl(src)
                        });
                    }
                });
            } else {
                // Manga format - page selector
                console.log('MangaTown: Detected manga format with page selector');
                const options = pageSelect.find('option');

                // Return page URLs that will be resolved later
                options.each((i, option) => {
                    const $option = $(option);
                    const pageUrl = $option.attr('value');

                    if (pageUrl && !pageUrl.endsWith('featured.html')) {
                        pages.push({
                            pageNumber: i + 1,
                            imageUrl: this.absoluteUrl(pageUrl),
                            needsResolution: true
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

    // Method to resolve page URL to actual image URL
    async getPageUrl(pageUrl) {
        try {
            if (pageUrl.startsWith('//')) {
                return this.absoluteUrl(pageUrl);
            }

            console.log(`MangaTown: Resolving page URL: ${pageUrl}`);
            const html = await this.fetchHtml(pageUrl);
            const $ = this.loadHtml(html);

            // Try multiple selectors for the image
            const $img = $('#image, .read_img img, .viewer img').first();
            const imgSrc = this.extractImageSrc($img);

            if (imgSrc && !ParserUtils.isPlaceholderImage(imgSrc)) {
                return this.absoluteUrl(imgSrc);
            }

            return pageUrl; // Fallback
        } catch (error) {
            console.error('MangaTown getPageUrl error:', error.message);
            return pageUrl;
        }
    }

    // Helper methods for enhanced metadata extraction
    extractRating($el) {
        const ratingText = $el.find('.rating, .score, .stars').text();
        const ratingMatch = ratingText.match(/(\d+(?:\.\d+)?)/);
        return ratingMatch ? parseFloat(ratingMatch[1]) : null;
    }

    extractViews($el) {
        const viewsText = $el.find('.views, .read-count').text();
        const viewsMatch = viewsText.match(/(\d+(?:,\d+)*)/);
        return viewsMatch ? parseInt(viewsMatch[1].replace(/,/g, '')) : null;
    }

    // Browse functionality for popular manga
    async browse() {
        try {
            const browseUrl = `${this.baseUrl}/directory/`;
            console.log(`MangaTown browsing: ${browseUrl}`);

            const html = await this.fetchHtml(browseUrl);
            const $ = this.loadHtml(html);

            const results = [];
            const items = $('.manga_pic_list li, .book-item, .manga-item');

            items.each((i, element) => {
                const $el = $(element);
                const $link = $el.find('a').first();
                const $img = $el.find('img').first();
                const $title = $el.find('.title, .name, h3, h4, .manga_name').first();

                if ($link.length) {
                    const href = $link.attr('href');
                    const title = this.cleanText($title.text() || $link.attr('title') || $link.text() || '');

                    if (href && title) {
                        const coverUrl = this.extractImageSrc($img);

                        results.push({
                            id: this.generateId(href),
                            title: title,
                            url: this.absoluteUrl(href),
                            coverUrl: coverUrl ? this.absoluteUrl(coverUrl) : null,
                            description: this.cleanText($el.find('.description, .summary, p').first().text()),
                            source: this.name,
                            rating: this.extractRating($el),
                            status: this.normalizeState($el.find('.status, .state').text()),
                            lastUpdated: this.parseDate($el.find('.date, .updated, .time').text())
                        });
                    }
                }
            });

            console.log(`MangaTown browse found ${results.length} results`);
            return results.slice(0, 20); // Limit to 20 results for browse
        } catch (error) {
            console.error('MangaTown browse error:', error.message);
            return [];
        }
    }
}

module.exports = MangaTownParser;