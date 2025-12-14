const BaseParser = require('./base-parser');

class MangadexParser extends BaseParser {
    constructor() {
        super('MangaDex', 'https://api.mangadex.org');
    }

    async fetchJson(url) {
        try {
            const html = await this.fetchHtml(url);
            return JSON.parse(html);
        } catch (error) {
            console.error(`Fetch JSON error for ${url}:`, error);
            throw error;
        }
    }

    async search(query) {
        const searchUrl = `${this.baseUrl}/manga?title=${encodeURIComponent(query)}&limit=20`;

        try {
            const data = await this.fetchJson(searchUrl);

            const results = [];

            if (data.data) {
                for (const manga of data.data) {
                    const title = manga.attributes.title.en ||
                        manga.attributes.title.ja ||
                        Object.values(manga.attributes.title)[0];

                    const description = manga.attributes.description.en ||
                        manga.attributes.description.ja ||
                        Object.values(manga.attributes.description)[0] || '';

                    // Get cover art
                    const coverRel = manga.relationships.find(rel => rel.type === 'cover_art');
                    let coverUrl = null;
                    if (coverRel && coverRel.attributes) {
                        coverUrl = `https://uploads.mangadex.org/covers/${manga.id}/${coverRel.attributes.fileName}`;
                    }

                    results.push({
                        id: manga.id,
                        title: title,
                        url: `https://mangadex.org/title/${manga.id}`,
                        coverUrl: coverUrl,
                        description: description.substring(0, 200) + (description.length > 200 ? '...' : ''),
                        source: this.name
                    });
                }
            }

            return results;
        } catch (error) {
            console.error('MangaDex search error:', error);
            return [];
        }
    }

    async getChapters(mangaUrl) {
        // Extract manga ID from URL
        const mangaId = mangaUrl.split('/').pop();
        const chaptersUrl = `${this.baseUrl}/manga/${mangaId}/feed?translatedLanguage[]=en&order[chapter]=asc&limit=500`;

        try {
            const data = await this.fetchJson(chaptersUrl);

            const chapters = [];

            if (data.data) {
                for (const chapter of data.data) {
                    chapters.push({
                        id: chapter.id,
                        number: chapter.attributes.chapter || '0',
                        title: chapter.attributes.title || `Chapter ${chapter.attributes.chapter}`,
                        url: `https://mangadex.org/chapter/${chapter.id}`,
                        pages: chapter.attributes.pages,
                        source: this.name
                    });
                }
            }

            return chapters;
        } catch (error) {
            console.error('MangaDex chapters error:', error);
            return [];
        }
    }

    async getPages(chapterUrl) {
        // Extract chapter ID from URL
        const chapterId = chapterUrl.split('/').pop();
        const pagesUrl = `${this.baseUrl}/at-home/server/${chapterId}`;

        try {
            const data = await this.fetchJson(pagesUrl);

            const pages = [];

            if (data.chapter && data.chapter.data) {
                const baseUrl = data.baseUrl;
                const hash = data.chapter.hash;

                data.chapter.data.forEach((filename, index) => {
                    pages.push({
                        pageNumber: index + 1,
                        imageUrl: `${baseUrl}/data/${hash}/${filename}`
                    });
                });
            }

            return pages;
        } catch (error) {
            console.error('MangaDex pages error:', error);
            return [];
        }
    }
}

module.exports = MangadexParser;