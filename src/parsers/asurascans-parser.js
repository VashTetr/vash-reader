const BaseParser = require('./base-parser');

class AsuraScansParser extends BaseParser {
    constructor() {
        super('AsuraScans', 'https://asuracomic.net');
    }

    async search(query) {
        try {
            // AsuraScans uses a series endpoint with name parameter for search
            const searchUrl = `${this.baseUrl}/series?name=${encodeURIComponent(query)}`;
            const html = await this.fetchHtml(searchUrl);
            const $ = this.loadHtml(html);

            return this.parseMangaList($);
        } catch (error) {
            console.error('AsuraScans search error:', error);
            return [];
        }
    }

    async getPopular(page = 1) {
        try {
            // Popular manga ordered by bookmarks
            const url = `${this.baseUrl}/series?page=${page}&order=bookmarks`;
            const html = await this.fetchHtml(url);
            const $ = this.loadHtml(html);

            return this.parseMangaList($);
        } catch (error) {
            console.error('AsuraScans popular error:', error);
            return [];
        }
    }

    parseMangaList($) {
        const results = [];

        // AsuraScans uses div.grid > a[href] structure
        $('div.grid > a[href]').each((i, element) => {
            try {
                const $element = $(element);
                const href = $element.attr('href');
                const titleElement = $element.find('div.block > span.block').first();
                const imageElement = $element.find('img').first();
                const ratingElement = $element.find('div.block label.ml-1').first();
                const statusElement = $element.find('span.status').last();

                if (href && titleElement.length) {
                    const title = titleElement.text().trim();
                    const url = this.absoluteUrl(href);
                    const coverUrl = imageElement.length ?
                        this.absoluteUrl(imageElement.attr('src')) : null;

                    // Extract rating (out of 10, convert to 5)
                    let rating = null;
                    if (ratingElement.length) {
                        const ratingText = ratingElement.text().trim();
                        const ratingNum = parseFloat(ratingText);
                        if (!isNaN(ratingNum)) {
                            rating = ratingNum / 2; // Convert from 10 to 5 scale
                        }
                    }

                    // Extract status
                    let status = null;
                    if (statusElement.length) {
                        const statusText = statusElement.text().trim();
                        switch (statusText) {
                            case 'Ongoing':
                                status = 'Ongoing';
                                break;
                            case 'Completed':
                                status = 'Completed';
                                break;
                            case 'Hiatus':
                                status = 'Hiatus';
                                break;
                            case 'Dropped':
                                status = 'Dropped';
                                break;
                            case 'Coming Soon':
                                status = 'Coming Soon';
                                break;
                        }
                    }

                    results.push({
                        id: this.extractIdFromUrl(url),
                        title: title,
                        url: url,
                        coverUrl: coverUrl,
                        description: '',
                        source: this.name,
                        rating: rating,
                        status: status
                    });
                }
            } catch (error) {
                console.error('Error parsing manga item:', error);
            }
        });

        return results;
    }

    async getChapters(mangaUrl) {
        try {
            const html = await this.fetchHtml(mangaUrl);
            const $ = this.loadHtml(html);
            const chapters = [];

            // AsuraScans uses div.scrollbar-thumb-themecolor > div.group structure
            $('div.scrollbar-thumb-themecolor > div.group').each((i, element) => {
                try {
                    const $element = $(element);
                    const linkElement = $element.find('a').last();

                    if (linkElement.length) {
                        const href = linkElement.attr('href');
                        if (href) {
                            // Build full chapter URL
                            const chapterUrl = href.startsWith('/series/') ?
                                this.absoluteUrl(href) :
                                this.absoluteUrl('/series/' + href);

                            const titleElement = $element.find('h3').first();
                            const chapterTitle = titleElement.length ? titleElement.text().trim() : '';

                            // Extract chapter number from title or use reverse index
                            let chapterNumber = '0';
                            if (chapterTitle) {
                                // Try to extract chapter number from title
                                const chapterMatch = chapterTitle.match(/chapter\s*(\d+(?:\.\d+)?)/i);
                                if (chapterMatch) {
                                    chapterNumber = chapterMatch[1];
                                } else {
                                    // If no chapter number in title, use reverse index since chapters are in reverse order
                                    // We'll fix this after we know the total count
                                    chapterNumber = 'temp_' + i;
                                }
                            } else {
                                chapterNumber = 'temp_' + i;
                            }

                            // Extract date
                            const dateElement = $element.find('h3').last();
                            let uploadDate = null;
                            if (dateElement.length) {
                                const dateText = dateElement.text().trim();
                                // Clean up ordinal numbers (1st, 2nd, 3rd, etc.)
                                const cleanDate = dateText.replace(/(\d+)(st|nd|rd|th)/g, '$1');
                                uploadDate = cleanDate;
                            }

                            chapters.push({
                                id: this.extractIdFromUrl(chapterUrl),
                                number: chapterNumber,
                                title: chapterTitle,
                                url: chapterUrl,
                                source: this.name,
                                uploadDate: uploadDate
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error parsing chapter:', error);
                }
            });

            // Fix chapter numbers for temp entries (chapters are in reverse order on the page)
            const totalChapters = chapters.length;
            chapters.forEach((chapter, index) => {
                if (chapter.number.startsWith('temp_')) {
                    // Convert reverse index to correct chapter number
                    chapter.number = (totalChapters - index).toString();
                }
            });

            // Reverse chapters to get correct order (Chapter 1 first)
            return chapters.reverse();
        } catch (error) {
            console.error('AsuraScans getChapters error:', error);
            return [];
        }
    }

    async getPages(chapterUrl) {
        try {
            const html = await this.fetchHtml(chapterUrl);
            const $ = this.loadHtml(html);
            const pages = [];

            // AsuraScans uses Next.js and stores page data in script tags
            // Look for script tags containing page data
            $('script').each((i, element) => {
                const scriptContent = $(element).html();
                if (scriptContent && scriptContent.includes('self.__next_f.push(')) {
                    try {
                        // Extract JSON data from Next.js script
                        const matches = scriptContent.match(/self\.__next_f\.push\(\[.*?\]\)/g);
                        if (matches) {
                            for (const match of matches) {
                                try {
                                    // Extract the array content
                                    const arrayContent = match.match(/\[(.*)\]/)[1];
                                    const jsonStrings = JSON.parse(`[${arrayContent}]`);

                                    // Look for page data in the JSON strings
                                    for (const jsonStr of jsonStrings) {
                                        if (typeof jsonStr === 'string') {
                                            const lines = jsonStr.split('\n');
                                            for (const line of lines) {
                                                if (line.includes('"order"') && line.includes('"url"')) {
                                                    try {
                                                        const colonIndex = line.indexOf(':');
                                                        if (colonIndex !== -1) {
                                                            const jsonPart = line.substring(colonIndex + 1);
                                                            const pageData = JSON.parse(jsonPart);

                                                            if (pageData.order !== undefined && pageData.url) {
                                                                pages.push({
                                                                    pageNumber: pageData.order,
                                                                    imageUrl: pageData.url
                                                                });
                                                            }
                                                        }
                                                    } catch (parseError) {
                                                        // Continue if this line doesn't parse
                                                    }
                                                }
                                            }
                                        }
                                    }
                                } catch (matchError) {
                                    // Continue if this match doesn't parse
                                }
                            }
                        }
                    } catch (scriptError) {
                        // Continue if script parsing fails
                    }
                }
            });

            // Sort pages by order and return
            pages.sort((a, b) => a.pageNumber - b.pageNumber);

            // If no pages found via script parsing, try fallback image selectors
            if (pages.length === 0) {
                $('img[src*="chapter"], .chapter-image img, .reading-content img').each((i, element) => {
                    const $img = $(element);
                    const src = $img.attr('src') || $img.attr('data-src');

                    if (src) {
                        pages.push({
                            pageNumber: i + 1,
                            imageUrl: this.absoluteUrl(src)
                        });
                    }
                });
            }

            return pages;
        } catch (error) {
            console.error('AsuraScans getPages error:', error);
            return [];
        }
    }

    extractIdFromUrl(url) {
        // Extract manga/chapter ID from URL
        const match = url.match(/\/([^\/]+)\/?$/);
        return match ? match[1] : url;
    }
}

module.exports = AsuraScansParser;