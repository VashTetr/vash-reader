const MangadexParser = require('./mangadex-parser');
const TrueMangaParser = require('./truemanga-parser');
const MangaBuddyParser = require('./mangabuddy-parser');
const MangaTownParser = require('./mangatown-parser');
// const BatoToParser = require('./batoto-parser'); // Commented out due to connection issues
const ComickParser = require('./comick-parser');
const MangakakalotParser = require('./mangakakalot-parser');
const AsuraScansParser = require('./asurascans-parser');
const ReaperScansParser = require('./reaperscans-parser');
const FlameComicsParser = require('./flamecomics-parser');
const MangaJinxParser = require('./mangajinx-parser');
const ManhwaXParser = require('./manhwax-parser');
const TooniTubeParser = require('./toonitube-parser');
// Alternative webtoon/manhwa parsers
const ToonilyParser = require('./toonily-parser');
const MangaParkParser = require('./mangapark-parser');
// Additional parsers
const MangaHereParser = require('./mangahere-parser');
const CutieComicsParser = require('./cutiecomics-parser');
const MangaHubParser = require('./mangahub-parser');
const ReadMangaParser = require('./readmanga-parser');
const MangaFoxParser = require('./mangafox-parser');
const TMOMangaParser = require('./tmomanga-parser');
// const HitomiParser = require('./hitomi-parser'); // Removed - too problematic

class ParserManager {
    constructor() {
        this.parsers = [
            new MangadexParser(),
            new TrueMangaParser(),
            new MangaBuddyParser(),
            new MangaTownParser(),
            // new BatoToParser(), // Commented out due to connection issues
            new ComickParser(),
            new MangakakalotParser(),
            new AsuraScansParser(),
            new ReaperScansParser(),
            new FlameComicsParser(),
            new MangaJinxParser(),
            new ManhwaXParser(),
            new TooniTubeParser(),
            new ToonilyParser(),
            new MangaParkParser(),
            new MangaHereParser(),
            new CutieComicsParser(),
            new MangaHubParser(),
            new ReadMangaParser(),
            new MangaFoxParser(),
            new TMOMangaParser()
            // new HitomiParser() // Removed - too problematic
        ];
    }

    getAvailableSources() {
        return this.parsers.map(parser => ({
            name: parser.name,
            baseUrl: parser.baseUrl
        }));
    }

    getParser(sourceName) {
        return this.parsers.find(parser => parser.name === sourceName);
    }

    async searchAll(query, maxResults = 10) {
        const allResults = [];
        const seenTitles = new Map(); // Track seen manga titles for deduplication

        // Search all parsers except Comick (which is for home page only) in parallel
        const searchParsers = this.parsers.filter(parser => parser.name !== 'Comick');
        const searchPromises = searchParsers.map(async (parser) => {
            try {
                const results = await parser.search(query);
                return results.slice(0, maxResults);
            } catch (error) {
                console.error(`Search failed for ${parser.name}:`, error);
                return [];
            }
        });

        const results = await Promise.all(searchPromises);

        // Flatten and deduplicate results based on title similarity
        results.forEach(parserResults => {
            parserResults.forEach(manga => {
                const normalizedTitle = this.normalizeTitle(manga.title);

                if (seenTitles.has(normalizedTitle)) {
                    // Manga already exists, add this source to the existing entry
                    const existingManga = seenTitles.get(normalizedTitle);
                    if (!existingManga.sources) {
                        existingManga.sources = [existingManga.source];
                    }
                    existingManga.sources.push(manga.source);
                } else {
                    // New manga, add to results
                    seenTitles.set(normalizedTitle, manga);
                    allResults.push(manga);
                }
            });
        });

        return allResults;
    }

    async searchEnabledSources(query, enabledSources = ['Comick'], maxResults = 10) {
        const allResults = [];
        const seenTitles = new Map(); // Track seen manga titles for deduplication

        // Filter parsers to only enabled sources
        const searchParsers = this.parsers.filter(parser => enabledSources.includes(parser.name));

        if (searchParsers.length === 0) {
            console.warn('No enabled sources found, falling back to Comick');
            const comickParser = this.parsers.find(parser => parser.name === 'Comick');
            if (comickParser) {
                searchParsers.push(comickParser);
            }
        }

        const searchPromises = searchParsers.map(async (parser) => {
            try {
                const results = await parser.search(query);
                return results.slice(0, maxResults);
            } catch (error) {
                console.error(`Search failed for ${parser.name}:`, error);
                return [];
            }
        });

        const results = await Promise.all(searchPromises);

        // Flatten and deduplicate results based on title similarity
        results.forEach(parserResults => {
            parserResults.forEach(manga => {
                const normalizedTitle = this.normalizeTitle(manga.title);

                if (seenTitles.has(normalizedTitle)) {
                    // Manga already exists, add this source to the existing entry
                    const existingManga = seenTitles.get(normalizedTitle);
                    if (!existingManga.sources) {
                        existingManga.sources = [existingManga.source];
                    }
                    existingManga.sources.push(manga.source);
                } else {
                    // New manga, add to results
                    seenTitles.set(normalizedTitle, manga);
                    allResults.push(manga);
                }
            });
        });

        return allResults;
    }

    // Helper method to normalize titles for deduplication
    normalizeTitle(title) {
        if (!title) return '';

        return title
            .toLowerCase()
            .trim()
            // Replace hyphens and underscores with spaces
            .replace(/[-_]/g, ' ')
            // Remove other punctuation and special characters
            .replace(/[^\w\s]/g, '')
            // Replace multiple spaces with single space
            .replace(/\s+/g, ' ')
            // Remove common words that might cause differences
            .replace(/\b(the|a|an)\b/g, '')
            .trim();
    }

    async searchBySource(query, sourceName, page = 1, limit = 50) {
        const parser = this.getParser(sourceName);
        if (!parser) {
            throw new Error(`Parser not found for source: ${sourceName}`);
        }

        return await parser.search(query, page, limit);
    }

    async getChapters(mangaUrl, sourceName) {
        const parser = this.getParser(sourceName);
        if (!parser) {
            throw new Error(`Parser not found for source: ${sourceName}`);
        }

        return await parser.getChapters(mangaUrl);
    }

    async getPages(chapterUrl, sourceName, options = {}) {
        const parser = this.getParser(sourceName);
        if (!parser) {
            throw new Error(`Parser not found for source: ${sourceName}`);
        }

        return await parser.getPages(chapterUrl, { loadAll: true, ...options });
    }

    async resolvePageUrl(pageUrl, sourceName) {
        const parser = this.getParser(sourceName);
        if (!parser) {
            throw new Error(`Parser not found for source: ${sourceName}`);
        }

        // Check if parser has getPageUrl method (like MangaTown)
        if (typeof parser.getPageUrl === 'function') {
            return await parser.getPageUrl(pageUrl);
        }

        // If no getPageUrl method, return the original URL
        return pageUrl;
    }
}

module.exports = ParserManager;