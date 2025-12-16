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
        // Enhanced search based on Kotatsu implementation - include all content ratings
        const searchUrl = `${this.baseUrl}/manga?title=${encodeURIComponent(query)}&limit=20&includes[]=cover_art&includes[]=author&includes[]=artist&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&order[relevance]=desc`;

        try {
            const data = await this.fetchJson(searchUrl);

            const results = [];

            if (data.data) {
                for (const manga of data.data) {
                    // Enhanced title selection with alternative titles
                    let title = manga.attributes.title.en ||
                        manga.attributes.title['ja-ro'] ||
                        manga.attributes.title.ja ||
                        Object.values(manga.attributes.title)[0];

                    // Check alternative titles for better matching
                    let altTitles = [];
                    if (manga.attributes.altTitles) {
                        for (const altTitle of manga.attributes.altTitles) {
                            const altTitleText = altTitle.en || altTitle['ja-ro'] || altTitle.ja || Object.values(altTitle)[0];
                            if (altTitleText) {
                                altTitles.push(altTitleText);
                            }
                        }
                    }

                    const description = manga.attributes.description.en ||
                        manga.attributes.description.ja ||
                        Object.values(manga.attributes.description)[0] || '';

                    // Get cover art - improved handling
                    const coverRel = manga.relationships.find(rel => rel.type === 'cover_art');
                    let coverUrl = null;
                    if (coverRel && coverRel.attributes && coverRel.attributes.fileName) {
                        coverUrl = `https://uploads.mangadex.org/covers/${manga.id}/${coverRel.attributes.fileName}.512.jpg`;
                    }

                    // Get additional metadata
                    let status = manga.attributes.status || '';
                    let year = manga.attributes.year || '';
                    let contentRating = manga.attributes.contentRating || 'safe';
                    let tags = [];

                    if (manga.attributes.tags) {
                        tags = manga.attributes.tags
                            .filter(tag => tag.attributes.name.en)
                            .map(tag => tag.attributes.name.en)
                            .slice(0, 5); // Limit to 5 tags
                    }

                    results.push({
                        id: manga.id,
                        title: title,
                        altTitles: altTitles,
                        url: `https://mangadex.org/title/${manga.id}`,
                        coverUrl: coverUrl,
                        description: description.substring(0, 200) + (description.length > 200 ? '...' : ''),
                        status: status,
                        year: year,
                        contentRating: contentRating,
                        tags: tags,
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

        // Get all chapters with pagination
        let allChapters = [];
        let offset = 0;
        const limit = 500;
        let hasMore = true;

        try {
            while (hasMore) {
                // Get all chapters regardless of language, then filter for best quality
                // Include all content ratings to ensure we get chapters for adult content
                const chaptersUrl = `${this.baseUrl}/manga/${mangaId}/feed?order[chapter]=asc&limit=${limit}&offset=${offset}&includes[]=scanlation_group&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`;

                const data = await this.fetchJson(chaptersUrl);

                if (data.data && data.data.length > 0) {
                    for (const chapter of data.data) {
                        // Skip chapters without chapter numbers (oneshots, extras, etc.)
                        if (!chapter.attributes.chapter) continue;

                        const chapterNumber = parseFloat(chapter.attributes.chapter);

                        // Get scanlation group
                        let scanlationGroup = '';
                        const groupRel = chapter.relationships.find(rel => rel.type === 'scanlation_group');
                        if (groupRel && groupRel.attributes) {
                            scanlationGroup = groupRel.attributes.name;
                        }

                        allChapters.push({
                            id: chapter.id,
                            number: chapter.attributes.chapter,
                            title: chapter.attributes.title || `Chapter ${chapter.attributes.chapter}`,
                            url: `https://mangadex.org/chapter/${chapter.id}`,
                            pages: chapter.attributes.pages || 0,
                            uploadDate: chapter.attributes.publishAt,
                            scanlationGroup: scanlationGroup,
                            source: this.name
                        });
                    }

                    offset += limit;
                    hasMore = data.data.length === limit; // Continue if we got a full page
                } else {
                    hasMore = false;
                }
            }

            // Remove duplicates (same chapter number) and keep the best quality/most recent
            const uniqueChapters = [];
            const seenChapters = new Map();

            for (const chapter of allChapters) {
                const chapterNum = chapter.number;
                if (!seenChapters.has(chapterNum) ||
                    new Date(chapter.uploadDate) > new Date(seenChapters.get(chapterNum).uploadDate)) {
                    seenChapters.set(chapterNum, chapter);
                }
            }

            // Convert back to array and sort
            uniqueChapters.push(...seenChapters.values());
            uniqueChapters.sort((a, b) => parseFloat(a.number) - parseFloat(b.number));

            console.log(`MangaDex found ${uniqueChapters.length} unique chapters`);
            return uniqueChapters;

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