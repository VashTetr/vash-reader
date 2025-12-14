const BaseParser = require('./base-parser');

class FlameComicsParser extends BaseParser {
    constructor() {
        super();
        this.name = 'FlameComics';
        this.baseUrl = 'https://flamecomics.xyz';
        this.commonPrefix = null; // Will be fetched dynamically
    }

    async fetchCommonPrefix() {
        if (this.commonPrefix) {
            return this.commonPrefix;
        }

        try {
            console.log('FlameComics fetching common prefix...');
            const response = await fetch(this.baseUrl);
            const html = await response.text();

            // Extract the build manifest path to get the common prefix
            const regex = /_next\/static\/([^/]+)\/_buildManifest\.js/;
            const match = html.match(regex);

            if (match && match[1]) {
                this.commonPrefix = match[1];
                console.log('FlameComics common prefix:', this.commonPrefix);
                return this.commonPrefix;
            } else {
                throw new Error('Unable to find common prefix');
            }
        } catch (error) {
            console.error('FlameComics prefix fetch error:', error);
            throw error;
        }
    }

    async search(query) {
        try {
            console.log(`FlameComics searching: ${query}`);

            const prefix = await this.fetchCommonPrefix();
            const url = `${this.baseUrl}/_next/data/${prefix}/browse.json`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const series = data.pageProps?.series || [];

            // Filter by search query
            const normalizedQuery = query.toLowerCase().replace(/[^a-za-z0-9 ]/g, '');
            const results = series.filter(manga => {
                const titles = [manga.title];
                if (manga.altTitles) {
                    try {
                        const altTitles = JSON.parse(manga.altTitles);
                        titles.push(...altTitles);
                    } catch (e) {
                        // Ignore parsing errors
                    }
                }

                return titles.some(title => {
                    const normalizedTitle = title.toLowerCase().replace(/[^a-za-z0-9 ]/g, '');
                    return normalizedTitle.includes(normalizedQuery);
                });
            });

            console.log(`FlameComics found ${results.length} results`);

            return results.slice(0, 20).map(manga => this.parseManga(manga));
        } catch (error) {
            console.error('FlameComics search error:', error);
            return [];
        }
    }

    parseManga(data) {
        const seriesId = data.series_id;
        const cover = data.cover;

        return {
            id: seriesId.toString(),
            title: data.title || 'Unknown Title',
            url: `${this.baseUrl}/series/${seriesId}`,
            coverUrl: cover ? this.imageUrl(seriesId, cover, 384) : null,
            source: this.name,
            description: data.description || '',
            author: data.author || '',
            status: this.parseStatus(data.status),
            tags: this.parseTags(data.categories)
        };
    }

    parseStatus(status) {
        switch (status) {
            case 'Dropped': return 'Abandoned';
            case 'Completed': return 'Finished';
            case 'Hiatus': return 'Paused';
            case 'Ongoing': return 'Ongoing';
            default: return 'Unknown';
        }
    }

    parseTags(categoriesJson) {
        if (!categoriesJson) return [];

        try {
            const categories = JSON.parse(categoriesJson);
            return Array.isArray(categories) ? categories : [];
        } catch (e) {
            return [];
        }
    }

    imageUrl(seriesId, imagePath, width = 384) {
        const cdnUrl = `https://cdn.flamecomics.xyz/uploads/images/series/${seriesId}/${imagePath}`;
        return `${this.baseUrl}/_next/image?url=${encodeURIComponent(cdnUrl)}&w=${width}&q=100`;
    }

    async getChapters(mangaUrl) {
        try {
            console.log('FlameComics getting chapters:', mangaUrl);

            // Extract series ID from URL
            const seriesId = mangaUrl.split('/').pop();
            const prefix = await this.fetchCommonPrefix();

            const url = `${this.baseUrl}/_next/data/${prefix}/series/${seriesId}.json?id=${seriesId}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const chapters = data.pageProps?.chapters || [];

            console.log(`FlameComics found ${chapters.length} chapters`);

            // Reverse to get correct order (oldest first)
            return chapters.reverse().map((chapter, index) => ({
                id: chapter.chapter_id.toString(),
                title: chapter.name || `Chapter ${chapter.chapter || index + 1}`,
                number: chapter.chapter || index + 1,
                url: `${seriesId}?${chapter.token || ''}`,
                uploadDate: chapter.release_date ? new Date(chapter.release_date * 1000) : null,
                scanlator: null,
                source: this.name
            }));
        } catch (error) {
            console.error('FlameComics chapters error:', error);
            return [];
        }
    }

    async getPages(chapterUrl) {
        try {
            console.log('FlameComics getting pages:', chapterUrl);

            const [seriesId, token] = chapterUrl.split('?');
            const prefix = await this.fetchCommonPrefix();

            const url = `${this.baseUrl}/_next/data/${prefix}/series/${seriesId}/${token}.json?id=${seriesId}&token=${token}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const images = data.pageProps?.chapter?.images || {};

            const pages = Object.entries(images).map(([index, imageData]) => ({
                pageNumber: parseInt(index) + 1, // Convert 0-based index to 1-based page number
                imageUrl: this.imageUrl(seriesId, `${token}/${imageData.name}`, 1920)
            }));

            console.log(`FlameComics found ${pages.length} pages`);
            return pages.sort((a, b) => a.pageNumber - b.pageNumber);
        } catch (error) {
            console.error('FlameComics pages error:', error);
            return [];
        }
    }
}

module.exports = FlameComicsParser;