const BaseParser = require('./base-parser');

class ToonilyParser extends BaseParser {
    constructor() {
        super('Toonily', 'https://toonily.com');
    }

    async search(query, page = 1) {
        try {
            // Toonily uses WordPress-style search
            const searchUrl = `${this.baseUrl}/page/${page}/?s=${encodeURIComponent(query)}`;
            console.log(`Toonily search URL: ${searchUrl}`);

            const html = await this.fetchHtml(searchUrl);
            const $ = this.loadHtml(html);
            const results = [];

            // Toonily uses WordPress/Madara theme structure
            const selectors = [
                '.page-item-detail',
                '.manga-item',
                '.wp-manga-item',
                'article.post',
                '.search-item'
            ];

            let items = $();
            for (const selector of selectors) {
                items = $(selector);
                if (items.length > 0) {
                    console.log(`Toonily found ${items.length} items with selector: ${selector}`);
                    break;
                }
            }

            items.each((i, element) => {
                const $item = $(element);

                // Get title and URL
                let title = '';
                let url = '';

                const titleSelectors = [
                    '.post-title a',
                    '.manga-title a',
                    'h3 a',
                    'h2 a',
                    '.item-title a',
                    'a[href*="/webtoon/"]',
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
                    'img.wp-post-image',
                    '.item-thumb img',
                    '.post-thumb img',
                    'img'
                ];

                for (const coverSel of coverSelectors) {
                    const coverEl = $item.find(coverSel).first();
                    if (coverEl.length > 0) {
                        coverUrl = this.absoluteUrl(
                            coverEl.attr('src') ||
                            coverEl.attr('data-src') ||
                            coverEl.attr('data-lazy-src')
                        );
                        break;
                    }
                }

                // Get additional metadata
                let status = '';
                let rating = '';
                let genres = [];

                // Status
                const statusEl = $item.find('.mg_status, .status, .item-status').first();
                if (statusEl.length > 0) {
                    status = this.cleanText(statusEl.text());
                }

                // Rating
                const ratingEl = $item.find('.rating, .score, .item-rating').first();
                if (ratingEl.length > 0) {
                    rating = this.cleanText(ratingEl.text());
                }

                // Genres
                const genreEls = $item.find('.genres a, .genre a, .item-genre a');
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
            console.error('Toonily search error:', error);
            return [];
        }
    }

    async getChapters(mangaUrl) {
        try {
            console.log(`Toonily getting chapters for: ${mangaUrl}`);
            const html = await this.fetchHtml(mangaUrl);
            const $ = this.loadHtml(html);
            const chapters = [];

            // Toonily chapter list selectors
            const chapterSelectors = [
                '.wp-manga-chapter',
                '.chapter-item',
                '.listing-chapters_wrap li',
                '.version-chap li',
                'a[href*="/chapter/"]'
            ];

            let chapterElements = $();
            for (const selector of chapterSelectors) {
                chapterElements = $(selector);
                if (chapterElements.length > 0) {
                    console.log(`Toonily found ${chapterElements.length} chapters with selector: ${selector}`);
                    break;
                }
            }

            chapterElements.each((i, element) => {
                const $chapter = $(element);

                // Get chapter link
                let chapterUrl = '';
                if ($chapter.is('a')) {
                    chapterUrl = this.absoluteUrl($chapter.attr('href'));
                } else {
                    const link = $chapter.find('a').first();
                    chapterUrl = this.absoluteUrl(link.attr('href'));
                }

                if (!chapterUrl) return;

                // Get chapter title and number
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

                // Get upload date
                let uploadDate = '';
                const dateEl = $chapter.find('.chapter-release-date, .post-on, .release-date').first();
                if (dateEl.length > 0) {
                    uploadDate = this.cleanText(dateEl.text());
                }

                chapters.push({
                    id: chapterUrl.split('/').pop(),
                    number: chapterNumber || (chapters.length + 1).toString(),
                    title: chapterTitle,
                    url: chapterUrl,
                    uploadDate: uploadDate,
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
            console.error('Toonily getChapters error:', error);
            return [];
        }
    }

    async getPages(chapterUrl) {
        try {
            console.log(`Toonily getting pages for: ${chapterUrl}`);
            const html = await this.fetchHtml(chapterUrl);
            const $ = this.loadHtml(html);
            const pages = [];

            // Toonily page image selectors
            const imageSelectors = [
                '.reading-content img',
                '.read-container img',
                '.wp-manga-chapter-img',
                '.chapter-content img',
                '.page-break img',
                '.entry-content img'
            ];

            let images = $();
            for (const selector of imageSelectors) {
                images = $(selector);
                if (images.length > 0) {
                    console.log(`Toonily found ${images.length} images with selector: ${selector}`);
                    break;
                }
            }

            images.each((i, element) => {
                const $img = $(element);
                let imageUrl = $img.attr('src') ||
                    $img.attr('data-src') ||
                    $img.attr('data-lazy-src') ||
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

            // If no images found, try script tags
            if (pages.length === 0) {
                const scripts = $('script').toArray();
                for (const script of scripts) {
                    const scriptContent = $(script).html();
                    if (scriptContent) {
                        // Look for image arrays in JavaScript
                        const patterns = [
                            /(?:images|pages|chapter_images)\s*[:=]\s*\[(.*?)\]/s,
                            /ts_reader\.run\((.*?)\)/s
                        ];

                        for (const pattern of patterns) {
                            const match = scriptContent.match(pattern);
                            if (match) {
                                try {
                                    const imageUrls = match[1].match(/"([^"]+\.(?:jpg|jpeg|png|gif|webp))"/gi);
                                    if (imageUrls) {
                                        imageUrls.forEach((url, index) => {
                                            const cleanUrl = url.replace(/"/g, '');
                                            pages.push({
                                                pageNumber: index + 1,
                                                imageUrl: this.absoluteUrl(cleanUrl)
                                            });
                                        });
                                        break;
                                    }
                                } catch (e) {
                                    continue;
                                }
                            }
                        }
                        if (pages.length > 0) break;
                    }
                }
            }

            return pages;
        } catch (error) {
            console.error('Toonily getPages error:', error);
            return [];
        }
    }
}

module.exports = ToonilyParser;