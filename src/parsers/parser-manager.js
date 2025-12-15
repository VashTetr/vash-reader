const MangadexParser = require('./mangadex-parser');
const TrueMangaParser = require('./truemanga-parser');
const MangaBuddyParser = require('./mangabuddy-parser');
const MangaTownParser = require('./mangatown-parser');
// const BatoToParser = require('./batoto-parser'); // Temporarily disabled - 522 errors
const ComickParser = require('./comick-parser');
const MangakakalotParser = require('./mangakakalot-parser');
const AsuraScansParser = require('./asurascans-parser');
const FlameComicsParser = require('./flamecomics-parser');
// Alternative webtoon/manhwa parsers
const ToonilyParser = require('./toonily-parser');
const MangaParkParser = require('./mangapark-parser');
// Additional parsers
// const MangaHereParser = require('./mangahere-parser'); // Temporarily disabled - 522 errors

class ParserManager {
    constructor() {
        this.parsers = [
            new MangadexParser(),
            new TrueMangaParser(),
            new MangaBuddyParser(),
            new MangaTownParser(),
            // new BatoToParser(), // Temporarily disabled - 522 errors
            new ComickParser(),
            new MangakakalotParser(),
            new AsuraScansParser(),
            new FlameComicsParser(),
            new ToonilyParser(),
            new MangaParkParser()
            // new MangaHereParser() // Temporarily disabled - 522 errors
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

        // Flatten and combine results
        results.forEach(parserResults => {
            allResults.push(...parserResults);
        });

        return allResults;
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

    async getPages(chapterUrl, sourceName) {
        const parser = this.getParser(sourceName);
        if (!parser) {
            throw new Error(`Parser not found for source: ${sourceName}`);
        }

        return await parser.getPages(chapterUrl);
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