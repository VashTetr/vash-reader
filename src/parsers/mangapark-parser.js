const BaseParser = require('./base-parser');

class MangaParkParser extends BaseParser {
    constructor() {
        super('MangaPark', 'https://mangapark.net');
    }

    async search(query, page = 1) {
        try {
            // MangaPark uses 'word' parameter for search
            const searchUrl = `${this.baseUrl}/search?word=${encodeURIComponent(query)}`;
            console.log(`MangaPark search URL: ${searchUrl}`);

            const html = await this.fetchHtml(searchUrl);
            const $ = this.loadHtml(html);
            const results = [];

            // Look for title links directly - MangaPark has a simple structure
            const titleLinks = $('a[href*="/title/"]');
            console.log(`MangaPark found ${titleLinks.length} title links`);

            const processedUrls = new Set(); // Avoid duplicates

            titleLinks.each((i, element) => {
                const $link = $(element);
                const href = $link.attr('href');
                const title = this.cleanText($link.text());

                // Skip if no title or if it's a chapter link
                if (!title || !href || href.includes('/chapter') || href.includes('-chapter-')) {
                    return;
                }

                // Skip duplicates
                if (processedUrls.has(href)) {
                    return;
                }
                processedUrls.add(href);

                const url = this.absoluteUrl(href);

                // Try to find cover image - look in parent elements
                let coverUrl = '';
                const $parent = $link.closest('div, article, li');
                const coverImg = $parent.find('img').first();
                if (coverImg.length > 0) {
                    coverUrl = this.absoluteUrl(
                        coverImg.attr('src') ||
                        coverImg.attr('data-src') ||
                        coverImg.attr('data-lazy')
                    );
                }

                // Get additional metadata from parent
                let status = '';
                let rating = '';
                let genres = [];

                // Status
                const statusEl = $parent.find('.status, .state').first();
                if (statusEl.length > 0) {
                    status = this.cleanText(statusEl.text());
                }

                // Rating
                const ratingEl = $parent.find('.rating, .score').first();
                if (ratingEl.length > 0) {
                    rating = this.cleanText(ratingEl.text());
                }

                // Genres
                const genreEls = $parent.find('.genres a, .genre a, .tags a');
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
            console.error('MangaPark search error:', error);
            return [];
        }
    }

    async getChapters(mangaUrl) {
        try {
            console.log(`MangaPark getting chapters for: ${mangaUrl}`);
            const html = await this.fetchHtml(mangaUrl);
            const $ = this.loadHtml(html);
            const chapters = [];

            // MangaPark chapter list selectors - they use specific URL patterns
            const chapterSelectors = [
                'a[href*="-chapter-"]',
                'a[href*="-ch-"]',
                'a[href*="/chapter/"]',
                'a[href*="/episode/"]'
            ];

            let chapterElements = $();
            for (const selector of chapterSelectors) {
                chapterElements = $(selector);
                if (chapterElements.length > 0) {
                    console.log(`MangaPark found ${chapterElements.length} chapters with selector: ${selector}`);
                    break;
                }
            }

            const processedChapters = new Set(); // Avoid duplicates

            chapterElements.each((i, element) => {
                const $chapter = $(element);

                // Get chapter link - these are already <a> elements
                const chapterUrl = this.absoluteUrl($chapter.attr('href'));
                if (!chapterUrl) return;

                // Skip duplicates
                if (processedChapters.has(chapterUrl)) return;
                processedChapters.add(chapterUrl);

                // Get chapter title and number
                const titleText = this.cleanText($chapter.text());
                if (!titleText) return; // Skip empty titles

                let chapterNumber = '';
                let chapterTitle = titleText;

                // Extract chapter number - MangaPark uses specific patterns
                const numberPatterns = [
                    /(?:chapter|ch\.?)\s*(\d+(?:\.\d+)?)/i,
                    /(\d+(?:\.\d+)?)(?:\s*-\s*.*)?$/,
                    /(\d+(?:\.\d+)?)/
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
                    const urlMatch = chapterUrl.match(/(?:chapter|ch)[-_]?(\d+(?:\.\d+)?)/i);
                    if (urlMatch) {
                        chapterNumber = urlMatch[1];
                    }
                }

                // Get upload date from parent or sibling elements
                let uploadDate = '';
                const $parent = $chapter.closest('div, li, tr');
                const dateEl = $parent.find('.date, .time, .upload-date, .updated').first();
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
            console.error('MangaPark getChapters error:', error);
            return [];
        }
    }

    async getPages(chapterUrl) {
        try {
            console.log(`MangaPark getting pages for: ${chapterUrl}`);

            // MangaPark chapter URLs don't directly show images - they might need transformation
            // The issue is that MangaPark uses JavaScript to load images dynamically
            // For now, return empty array to indicate this parser needs different handling
            console.log('MangaPark uses dynamic image loading - pages not directly accessible');
            return [];

            /* 
            // Future implementation could try:
            // 1. Check if URL needs transformation to reader format
            // 2. Handle JavaScript-rendered content
            // 3. Use different API endpoints if available
            */
        } catch (error) {
            console.error('MangaPark getPages error:', error);
            return [];
        }
    }
}

module.exports = MangaParkParser;