const BaseParser = require('./base-parser');

class CutieComicsParser extends BaseParser {
    constructor() {
        super('CutieComics', 'https://cutiecomics.com');
    }

    async search(query, page = 1, limit = 20) {
        try {
            if (!query || query.trim() === '') {
                // Empty search - use browse functionality
                return await this.browseManga(page, limit);
            }

            // Use the proper search endpoint
            const searchUrl = `${this.baseUrl}/index.php?do=search&subaction=search&story=${encodeURIComponent(query)}`;
            const html = await this.fetchHtml(searchUrl);
            const $ = this.loadHtml(html);

            const results = [];

            // Extract manga entries from search results
            $('.w25').each((index, element) => {
                if (results.length >= limit) return false;

                const $container = $(element);

                // Get title and URL
                const $titleLink = $container.find('.field-content a').first();
                const href = $titleLink.attr('href');
                const title = $titleLink.text().trim();

                // Get cover image
                const $img = $container.find('.field-content img').first();
                const imgSrc = $img.attr('src') || $img.attr('data-src');

                // Filter for actual manga pages
                if (href && title && title.length > 3 && href.includes('.html')) {
                    // Extract ID from URL
                    const urlParts = href.split('/');
                    const mangaId = urlParts[urlParts.length - 1].replace('.html', '') ||
                        urlParts[urlParts.length - 2];

                    // Check for duplicates
                    const isDuplicate = results.some(r => r.id === mangaId || r.title === title);
                    if (!isDuplicate) {
                        let coverUrl = null;
                        if (imgSrc) {
                            coverUrl = imgSrc.startsWith('http') ? imgSrc : this.absoluteUrl(imgSrc);
                        }

                        results.push({
                            id: mangaId,
                            title: title,
                            url: href.startsWith('http') ? href : this.absoluteUrl(href),
                            coverUrl: coverUrl,
                            description: '',
                            source: this.name
                        });
                    }
                }
            });

            return results;
        } catch (error) {
            console.error('CutieComics search error:', error);
            return [];
        }
    }

    async getChapters(mangaUrl) {
        try {
            // CutieComics has single-chapter manga - each manga page contains all images
            // We just return a single chapter that points to the manga page itself
            const chapters = [{
                id: 'chapter-1',
                number: '1',
                title: 'Chapter 1',
                url: mangaUrl,
                source: this.name
            }];

            return chapters;
        } catch (error) {
            console.error('CutieComics getChapters error:', error);
            return [];
        }
    }

    async getPages(chapterUrl) {
        try {
            const html = await this.fetchHtml(chapterUrl);
            const $ = this.loadHtml(html);

            const pages = [];

            // Look for images in the gallery container
            $('.xfieldimagegallery img').each((index, element) => {
                const $img = $(element);
                const src = $img.attr('src');

                if (src && src.includes('/uploads/posts/')) {
                    // Use the actual URL from the HTML - CutieComics serves thumbnails
                    let imageUrl = src.startsWith('http') ? src : this.absoluteUrl(src);

                    pages.push({
                        pageNumber: pages.length + 1,
                        imageUrl: imageUrl
                    });
                }
            });

            // If no images found in gallery, try the generic approach
            if (pages.length === 0) {
                $('img').each((index, element) => {
                    const $img = $(element);
                    const src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original');

                    if (src && src.includes('/uploads/posts/')) {
                        // Skip small images, ads, or navigation images
                        const width = parseInt($img.attr('width')) || 0;
                        const height = parseInt($img.attr('height')) || 0;

                        // Only include images that are likely manga pages (reasonably sized)
                        if ((width === 0 && height === 0) || (width > 200 && height > 200)) {
                            let imageUrl = src.startsWith('http') ? src : this.absoluteUrl(src);

                            pages.push({
                                pageNumber: pages.length + 1,
                                imageUrl: imageUrl
                            });
                        }
                    }
                });
            }

            return pages;
        } catch (error) {
            console.error('CutieComics getPages error:', error);
            return [];
        }
    }

    // Browse functionality for empty searches
    async browseManga(page = 1, limit = 20) {
        try {
            // Get the main page to find recent/popular manga
            const html = await this.fetchHtml(this.baseUrl);
            const $ = this.loadHtml(html);

            const results = [];

            // Extract manga entries from main page with cover images
            $('.w25').each((index, element) => {
                if (results.length >= limit) return false;

                const $container = $(element);

                // Get title and URL
                const $titleLink = $container.find('.field-content a').first();
                const href = $titleLink.attr('href');
                const title = $titleLink.text().trim();

                // Get cover image
                const $img = $container.find('.field-content img').first();
                const imgSrc = $img.attr('src');

                // Filter for actual manga pages
                if (href && title && title.length > 3) {
                    const urlParts = href.split('/');
                    const mangaId = urlParts[urlParts.length - 1].replace('.html', '') ||
                        urlParts[urlParts.length - 2];

                    // Check for duplicates
                    const isDuplicate = results.some(r => r.id === mangaId || r.title === title);
                    if (!isDuplicate) {
                        let coverUrl = null;
                        if (imgSrc) {
                            coverUrl = imgSrc.startsWith('http') ? imgSrc : this.absoluteUrl(imgSrc);
                        }

                        results.push({
                            id: mangaId,
                            title: title,
                            url: href.startsWith('http') ? href : this.absoluteUrl(href),
                            coverUrl: coverUrl,
                            description: '',
                            source: this.name
                        });
                    }
                }
            });

            return results;
        } catch (error) {
            console.error('CutieComics browse error:', error);
            return [];
        }
    }

    // Get manga details including cover image and tags
    async getMangaDetails(mangaUrl) {
        try {
            const html = await this.fetchHtml(mangaUrl);
            const $ = this.loadHtml(html);

            // Extract cover image (first image is the cover)
            let coverUrl = null;
            const firstImg = $('img').first();
            if (firstImg.length > 0) {
                const src = firstImg.attr('src') || firstImg.attr('data-src');
                if (src) {
                    // Convert thumbnail to full-size image
                    let imageUrl = src.startsWith('http') ? src : this.absoluteUrl(src);
                    if (imageUrl.includes('/thumbs/')) {
                        imageUrl = imageUrl.replace('/thumbs/', '/');
                    }
                    coverUrl = imageUrl;
                }
            }

            // Extract tags
            const tags = [];
            $('a[href*="tag"]').each((index, element) => {
                const $link = $(element);
                const tagText = $link.text().trim();
                if (tagText && tagText.length > 1 && !tags.includes(tagText)) {
                    tags.push(tagText);
                }
            });

            // Try to extract description from various selectors
            let description = '';
            const descriptionSelectors = [
                '.description',
                '.summary',
                '.excerpt',
                '.post-content p',
                '.entry-content p',
                '.content p'
            ];

            for (const selector of descriptionSelectors) {
                const element = $(selector).first();
                if (element.length > 0) {
                    description = element.text().trim();
                    if (description.length > 10) {
                        break;
                    }
                }
            }

            return {
                coverUrl: coverUrl,
                tags: tags,
                description: description
            };
        } catch (error) {
            console.error('CutieComics getMangaDetails error:', error);
            return null;
        }
    }
}

module.exports = CutieComicsParser;