const BaseParser = require('./base-parser');

class ManhwaXParser extends BaseParser {
    constructor() {
        super('ManhwaX', 'https://manhwax.me');
    }



    async search(query) {
        const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;

        try {
            console.log(`ManhwaX searching: ${searchUrl}`);
            const html = await this.fetchHtml(searchUrl);
            const $ = this.loadHtml(html);

            const results = [];

            // ManhwaX uses .manga-listing-item for search results
            const items = $('.manga-listing-item');

            items.each((i, element) => {
                const $el = $(element);
                const $link = $el.find('a').first();
                const $img = $el.find('img').first();
                const $title = $el.find('.item-title').first();

                if ($link.length) {
                    const href = $link.attr('href');
                    const title = this.cleanText($title.text() || $link.attr('title') || $link.text() || '');

                    if (href && title) {
                        results.push({
                            id: href.split('/').pop() || href.split('=').pop(),
                            title: title,
                            url: this.absoluteUrl(href),
                            coverUrl: $img.attr('src') ? this.absoluteUrl($img.attr('src')) : null,
                            description: this.cleanText($el.find('.item-summary, .description, p').first().text()),
                            source: this.name
                        });
                    }
                }
            });

            console.log(`ManhwaX found ${results.length} results`);
            return results;
        } catch (error) {
            console.error('ManhwaX search error:', error.message);
            return [];
        }
    }

    async getChapters(mangaUrl) {
        try {
            console.log(`ManhwaX getting chapters: ${mangaUrl}`);
            const html = await this.fetchHtml(mangaUrl);
            const $ = this.loadHtml(html);

            const chapters = [];

            // ManhwaX uses a[href*="chapter"] for chapter links
            const chapterElements = $('a[href*="chapter"]');

            chapterElements.each((i, element) => {
                const $el = $(element);
                const href = $el.attr('href');
                const chapterText = this.cleanText($el.text());

                // Only include chapters that belong to this manga
                if (href && href.includes(mangaUrl.split('/').pop()) && chapterText) {
                    // Extract chapter number
                    let chapterNumber = '0';
                    const chapterMatch = chapterText.match(/(?:chapter|ch\.?|episode|ep\.?)\s*(\d+(?:\.\d+)?)/i);
                    if (chapterMatch) {
                        chapterNumber = chapterMatch[1];
                    } else {
                        // Try to extract from URL
                        const urlMatch = href.match(/chapter[/-](\d+(?:\.\d+)?)/i);
                        if (urlMatch) {
                            chapterNumber = urlMatch[1];
                        } else {
                            const numberMatch = chapterText.match(/(\d+(?:\.\d+)?)/);
                            if (numberMatch) {
                                chapterNumber = numberMatch[1];
                            } else {
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

            console.log(`ManhwaX found ${uniqueChapters.length} chapters`);
            return uniqueChapters;
        } catch (error) {
            console.error('ManhwaX chapters error:', error.message);
            return [];
        }
    }

    async getPages(chapterUrl) {
        try {
            console.log(`ManhwaX getting pages: ${chapterUrl}`);
            const html = await this.fetchHtml(chapterUrl);
            const $ = this.loadHtml(html);

            const pages = [];

            // Method 1: Try to extract from JavaScript chapterData
            const scripts = $('script');
            let foundImages = false;

            scripts.each((i, script) => {
                const scriptContent = $(script).html() || '';

                // Look for chapterData with processedImages
                if (scriptContent.includes('chapterData') && scriptContent.includes('processedImages')) {
                    console.log('ManhwaX: Found chapterData script');

                    // Extract the processedImages data
                    const processedImagesMatch = scriptContent.match(/processedImages[^}]+}/);
                    if (processedImagesMatch) {
                        try {
                            // Try to parse the JavaScript object
                            const dataMatch = scriptContent.match(/processedImages:\s*({[^}]+})/);
                            if (dataMatch) {
                                const processedData = dataMatch[1];
                                console.log('Found processedImages data:', processedData.substring(0, 200));

                                // Parse the JSON-like structure to get different image sources
                                try {
                                    // Clean up the JSON string properly
                                    let jsonStr = processedData
                                        .replace(/([a-zA-Z0-9_]+):/g, '"$1":')  // Add quotes around keys
                                        .replace(/\\\//g, '/')                   // Fix escaped slashes
                                        .replace(/\\"/g, '"');                   // Fix escaped quotes

                                    const imageData = JSON.parse(jsonStr);

                                    console.log('Available image sources:', Object.keys(imageData));

                                    // Prioritize image sources (manga18fx and manga18me work better than manhwaclub)
                                    const sourcePriority = ['manga18fx', 'manga18me', 'manhwaclubnet'];

                                    for (const source of sourcePriority) {
                                        if (imageData[source] && imageData[source].length > 0) {
                                            console.log(`Using image source: ${source} (${imageData[source].length} images)`);

                                            imageData[source].forEach((url, index) => {
                                                const cleanUrl = url.replace(/\\/g, ''); // Remove escape characters
                                                pages.push({
                                                    pageNumber: index + 1,
                                                    imageUrl: cleanUrl
                                                });
                                            });
                                            foundImages = true;
                                            break; // Use only the first available source
                                        }
                                    }
                                } catch (parseError) {
                                    console.log('Failed to parse as JSON, falling back to regex extraction');

                                    // Fallback to original regex method but filter out manhwaclub URLs
                                    const urlMatches = processedData.match(/http[^"]+\.jpg/g);
                                    if (urlMatches) {
                                        // Filter out manhwaclub URLs and prioritize manga18fx/manga18me
                                        const filteredUrls = urlMatches.filter(url =>
                                            !url.includes('manhwaclub.net') ||
                                            url.includes('manga18fx.com') ||
                                            url.includes('manga18.me')
                                        );

                                        // If we have manga18fx or manga18me URLs, use only those
                                        const preferredUrls = filteredUrls.filter(url =>
                                            url.includes('manga18fx.com') || url.includes('manga18.me')
                                        );

                                        const urlsToUse = preferredUrls.length > 0 ? preferredUrls : filteredUrls;

                                        urlsToUse.forEach((url, index) => {
                                            const cleanUrl = url.replace(/\\/g, '');
                                            pages.push({
                                                pageNumber: index + 1,
                                                imageUrl: cleanUrl
                                            });
                                        });
                                        foundImages = true;
                                    }
                                }
                            }
                        } catch (error) {
                            console.log('Error parsing chapterData:', error.message);
                        }
                    }
                    return false; // Break the loop
                }
            });

            // Method 2: Fallback to HTML parsing if JavaScript method didn't work
            if (!foundImages) {
                console.log('ManhwaX: Falling back to HTML parsing');

                // Look for manga page images - exclude logos and UI images
                const images = $('img[src*=".jpg"], img[src*=".png"], img[src*=".webp"], img[src*=".jpeg"]');

                images.each((i, element) => {
                    const $img = $(element);
                    const src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original');

                    if (src &&
                        !src.includes('logo') &&
                        !src.includes('user-image') &&
                        !src.includes('avatar') &&
                        !src.includes('icon') &&
                        !src.includes('thumb/') && // Exclude thumbnail images
                        src.length > 50) { // Only include longer URLs (manga pages)

                        pages.push({
                            pageNumber: pages.length + 1,
                            imageUrl: this.absoluteUrl(src)
                        });
                    }
                });
            }

            console.log(`ManhwaX found ${pages.length} pages`);
            return pages;
        } catch (error) {
            console.error('ManhwaX pages error:', error.message);
            return [];
        }
    }
}

module.exports = ManhwaXParser;