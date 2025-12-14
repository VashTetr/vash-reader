const BaseParser = require('./base-parser');

class MangaHereParser extends BaseParser {
    constructor() {
        super('MangaHere', 'https://mangahere.onl');
    }

    async search(query, page = 1) {
        try {
            // MangaHere search URL structure
            const searchUrl = `${this.baseUrl}/search?name=${encodeURIComponent(query)}&page=${page}`;
            console.log(`MangaHere search URL: ${searchUrl}`);

            const html = await this.fetchHtml(searchUrl);
            const $ = this.loadHtml(html);
            const results = [];

            // MangaHere uses specific structure
            const selectors = [
                '.manga-list-4 .manga-item',
                '.manga-item',
                '.list-item',
                '.item',
                'article'
            ];

            let items = $();
            for (const selector of selectors) {
                items = $(selector);
                if (items.length > 0) {
                    console.log(`MangaHere found ${items.length} items with selector: ${selector}`);
                    break;
                }
            }

            items.each((i, element) => {
                const $item = $(element);

                // Get title and URL
                let title = '';
                let url = '';

                const titleSelectors = [
                    '.manga-name a',
                    '.title a',
                    'h3 a',
                    'h2 a',
                    'a[href*="/manga/"]'
                ];

                for (const titleSel of titleSelectors) {
                    const titleEl = $item.find(titleSel).first();
                    if (titleEl.length > 0) {
                        title = this.cleanText(titleEl.text());
                        url = this.absoluteUrl(titleEl.attr('href'));
                        break;
                    }
                }

                if (!title || !url) return;

                // Get cover image
                let coverUrl = '';
                const coverSelectors = [
                    '.manga-poster img',
                    '.cover img',
                    '.thumb img',
                    'img'
                ];

                for (const coverSel of coverSelectors) {
                    const coverEl = $item.find(coverSel).first();
                    if (coverEl.length > 0) {
                        coverUrl = this.absoluteUrl(
                            coverEl.attr('src') ||
                            coverEl.attr('data-src') ||
                            coverEl.attr('data-lazy')
                        );
                        break;
                    }
                }

                // Get additional metadata
                let status = '';
                let rating = '';
                let genres = [];

                // Status
                const statusEl = $item.find('.status, .manga-status').first();
                if (statusEl.length > 0) {
                    status = this.cleanText(statusEl.text());
                }

                // Rating
                const ratingEl = $item.find('.rating, .score').first();
                if (ratingEl.length > 0) {
                    rating = this.cleanText(ratingEl.text());
                }

                // Genres
                const genreEls = $item.find('.genres a, .genre a, .tags a');
                genreEls.each((j, genreEl) => {
                    const genre = this.cleanText($(genreEl).text());
                    if (genre) genres.push(genre);
                });

                results.push({
                    id: url.split('/').filter(Boolean).pop(),
                    title: title,
                    url: url,
                    coverUrl: coverUrl,
                    status: status,
                    rating: rating,
                    genres: genres,
                    source: this.name
                });
            });

            return results;
        } catch (error) {
            console.error('MangaHere search error:', error);
            return [];
        }
    }

    async getChapters(mangaUrl) {
        try {
            console.log(`MangaHere getting chapters for: ${mangaUrl}`);
            const html = await this.fetchHtml(mangaUrl);
            const $ = this.loadHtml(html);
            const chapters = [];

            // MangaHere chapter selectors
            const chapterSelectors = [
                '.chapter-list .chapter-item',
                '.chapters .chapter',
                'a[href*="/chapter/"]',
                '.episode-list .episode'
            ];

            let chapterElements = $();
            for (const selector of chapterSelectors) {
                chapterElements = $(selector);
                if (chapterElements.length > 0) {
                    console.log(`MangaHere found ${chapterElements.length} chapters with selector: ${selector}`);
                    break;
                }
            }

            chapterElements.each((i, element) => {
                const $chapter = $(element);

                let chapterUrl = '';
                if ($chapter.is('a')) {
                    chapterUrl = this.absoluteUrl($chapter.attr('href'));
                } else {
                    const link = $chapter.find('a').first();
                    chapterUrl = this.absoluteUrl(link.attr('href'));
                }

                if (!chapterUrl) return;

                const titleText = this.cleanText($chapter.text());
                let chapterNumber = '';
                let chapterTitle = titleText;

                // Extract chapter number
                const numberPatterns = [
                    /(?:chapter|ch\.?|episode|ep\.?)\s*(\d+(?:\.\d+)?)/i,
                    /#(\d+(?:\.\d+)?)/i,
                    /(\d+(?:\.\d+)?)$/
                ];

                for (const pattern of numberPatterns) {
                    const match = titleText.match(pattern);
                    if (match) {
                        chapterNumber = match[1];
                        break;
                    }
                }

                // If no number found, try URL
                if (!chapterNumber) {
                    const urlMatch = chapterUrl.match(/(?:chapter|episode|ch|ep)[-_]?(\d+(?:\.\d+)?)/i);
                    if (urlMatch) {
                        chapterNumber = urlMatch[1];
                    }
                }

                chapters.push({
                    id: chapterUrl.split('/').pop(),
                    number: chapterNumber || (chapters.length + 1).toString(),
                    title: chapterTitle,
                    url: chapterUrl,
                    source: this.name
                });
            });

            // Sort chapters by number (ascending)
            chapters.sort((a, b) => {
                const numA = parseFloat(a.number) || 0;
                const numB = parseFloat(b.number) || 0;
                return numA - numB;
            });

            return chapters;
        } catch (error) {
            console.error('MangaHere getChapters error:', error);
            return [];
        }
    }

    async getPages(chapterUrl) {
        try {
            console.log(`MangaHere getting pages for: ${chapterUrl}`);
            const html = await this.fetchHtml(chapterUrl);
            const $ = this.loadHtml(html);
            const pages = [];

            // MangaHere page image selectors
            const imageSelectors = [
                '.reader-main img',
                '.page-image img',
                '.chapter-img img',
                '.reader img',
                'img[src*="chapter"]',
                'img[src*="page"]'
            ];

            let images = $();
            for (const selector of imageSelectors) {
                images = $(selector);
                if (images.length > 0) {
                    console.log(`MangaHere found ${images.length} images with selector: ${selector}`);
                    break;
                }
            }

            images.each((i, element) => {
                const $img = $(element);
                let imageUrl = $img.attr('src') ||
                    $img.attr('data-src') ||
                    $img.attr('data-lazy') ||
                    $img.attr('data-original');

                if (imageUrl &&
                    !imageUrl.includes('loading') &&
                    !imageUrl.includes('placeholder') &&
                    !imageUrl.includes('data:image')) {

                    imageUrl = this.absoluteUrl(imageUrl);
                    pages.push({
                        pageNumber: i + 1,
                        imageUrl: imageUrl
                    });
                }
            });

            return pages;
        } catch (error) {
            console.error('MangaHere getPages error:', error);
            return [];
        }
    }
}

module.exports = MangaHereParser;