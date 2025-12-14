const ParserManager = require('./parsers/parser-manager');

class MangaScraper {
    constructor() {
        this.parserManager = new ParserManager();
    }

    async searchManga(query) {
        try {
            // Search across all sources
            return await this.parserManager.searchAll(query, 8);
        } catch (error) {
            console.error('Search failed:', error);
            return [];
        }
    }

    async searchBySource(query, sourceName, page = 1, limit = 50) {
        try {
            return await this.parserManager.searchBySource(query, sourceName, page, limit);
        } catch (error) {
            console.error(`Search failed for ${sourceName}:`, error);
            return [];
        }
    }

    async advancedSearch(filters) {
        try {
            // Use Comick parser for advanced search since it has the most comprehensive API
            const comickParser = this.parserManager.parsers.find(p => p.name === 'Comick');
            if (!comickParser || !comickParser.advancedSearch) {
                throw new Error('Advanced search not available');
            }

            return await comickParser.advancedSearch(filters);
        } catch (error) {
            console.error('Advanced search failed:', error);
            return [];
        }
    }

    async getGenres() {
        try {
            // Use Comick parser for genres
            const comickParser = this.parserManager.parsers.find(p => p.name === 'Comick');
            if (!comickParser || !comickParser.getGenres) {
                throw new Error('Genres not available');
            }

            return await comickParser.getGenres();
        } catch (error) {
            console.error('Get genres failed:', error);
            return [];
        }
    }

    async getCategories() {
        try {
            // Use Comick parser for categories/tags
            const comickParser = this.parserManager.parsers.find(p => p.name === 'Comick');
            if (!comickParser || !comickParser.getCategories) {
                throw new Error('Categories not available');
            }

            return await comickParser.getCategories();
        } catch (error) {
            console.error('Get categories failed:', error);
            return [];
        }
    }

    async findMangaInAllSources(mangaTitle, mangaUrl = null) {
        try {
            console.log(`Searching for "${mangaTitle}" in all sources...`);

            // If we have a Comick URL, get all alternative titles
            let allTitles = [mangaTitle];
            if (mangaUrl && mangaUrl.includes('comick')) {
                try {
                    const comickParser = this.parserManager.parsers.find(p => p.name === 'Comick');
                    if (comickParser) {
                        console.log('Fetching alternative titles from Comick...');
                        const mangaDetails = await comickParser.getMangaDetails(mangaUrl);
                        if (mangaDetails && mangaDetails.allTitles) {
                            allTitles = mangaDetails.allTitles;
                            console.log(`Found ${allTitles.length} alternative titles:`, allTitles);
                        }
                    }
                } catch (error) {
                    console.error('Failed to get alternative titles from Comick:', error);
                }
            }

            // Search for the manga in all reading sources (exclude Comick)
            const readingSources = this.parserManager.parsers.filter(parser => parser.name !== 'Comick');
            console.log(`Available reading sources: ${readingSources.map(p => p.name).join(', ')}`);

            // Smart title selection - prioritize English titles and limit to top 5
            const prioritizedTitles = this.selectBestTitles(allTitles, 5);
            console.log(`Using ${prioritizedTitles.length} prioritized titles:`, prioritizedTitles);

            // Parallelize searches across all sources
            const searchPromises = readingSources.map(async (parser) => {
                try {
                    console.log(`Searching in ${parser.name}...`);

                    // Try titles in priority order, stop at first good match
                    let bestResults = [];
                    let bestScore = 0;

                    for (const title of prioritizedTitles) {
                        try {
                            const results = await parser.search(title);

                            if (results.length > 0) {
                                // Calculate relevance scores for these results against ALL known titles
                                const scoredResults = results.map(result => {
                                    let maxScore = 0;
                                    for (const knownTitle of allTitles) {
                                        const score = this.calculateTitleSimilarity(knownTitle, result.title);
                                        maxScore = Math.max(maxScore, score);
                                    }
                                    return {
                                        ...result,
                                        parserName: parser.name,
                                        relevanceScore: maxScore
                                    };
                                });

                                // Find the best match from this search
                                const topResult = scoredResults.reduce((best, current) =>
                                    current.relevanceScore > best.relevanceScore ? current : best
                                );

                                // If this is better than our current best, use it
                                if (topResult.relevanceScore > bestScore) {
                                    bestResults = scoredResults.filter(r => r.relevanceScore >= 60); // Only high-confidence matches
                                    bestScore = topResult.relevanceScore;
                                }

                                // If we found a very good match (85+), stop searching with other titles
                                if (topResult.relevanceScore >= 85) {
                                    console.log(`${parser.name} found excellent match (${topResult.relevanceScore}%) with "${title}"`);
                                    break;
                                }
                            }
                        } catch (termError) {
                            console.error(`Search term "${title}" failed for ${parser.name}:`, termError.message);
                        }
                    }

                    console.log(`${parser.name} returned ${bestResults.length} relevant results (best score: ${bestScore})`);
                    return bestResults;

                } catch (error) {
                    console.error(`Search failed for ${parser.name}:`, error.message);
                    return [];
                }
            });

            // Wait for all searches to complete
            const searchResults = await Promise.all(searchPromises);

            // Flatten all results into a single array
            const allResults = searchResults.flat();

            // Sort all results by relevance score
            allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

            console.log(`Total relevant results found: ${allResults.length}`);
            return allResults;
        } catch (error) {
            console.error('Failed to search in all sources:', error);
            return [];
        }
    }

    selectBestTitles(allTitles, maxTitles = 5) {
        // Score titles by how likely they are to work in searches
        const scoredTitles = allTitles.map(title => {
            let score = 0;

            // Prefer English titles (contain Latin characters)
            if (/^[a-zA-Z0-9\s\-:.'!?]+$/.test(title)) {
                score += 100;
            }

            // Prefer shorter titles (easier to match)
            if (title.length <= 30) score += 50;
            else if (title.length <= 50) score += 25;

            // Prefer titles without special characters
            if (!/[^\w\s\-:.'!?]/.test(title)) score += 30;

            // Prefer titles with common English words
            const commonWords = ['the', 'of', 'and', 'return', 'revenge', 'blood', 'sword', 'iron'];
            const titleLower = title.toLowerCase();
            const hasCommonWords = commonWords.some(word => titleLower.includes(word));
            if (hasCommonWords) score += 20;

            return { title, score };
        });

        // Sort by score and take top titles
        return scoredTitles
            .sort((a, b) => b.score - a.score)
            .slice(0, maxTitles)
            .map(item => item.title);
    }

    generateSearchTerms(title) {
        const terms = [title]; // Start with original title

        // Remove common prefixes/suffixes and generate variations
        let cleanTitle = title
            .replace(/\s*\(.*?\)\s*/g, '') // Remove parentheses content
            .replace(/\s*\[.*?\]\s*/g, '') // Remove bracket content
            .replace(/\s*-\s*.*$/g, '') // Remove everything after dash
            .replace(/\s*:\s*.*$/g, '') // Remove everything after colon
            .trim();

        if (cleanTitle !== title && cleanTitle.length > 3) {
            terms.push(cleanTitle);
        }

        // Extract key words (longer than 3 characters)
        const words = title.split(/\s+/).filter(word =>
            word.length > 3 &&
            !['the', 'and', 'of', 'in', 'to', 'for', 'with', 'on', 'at', 'by', 'from'].includes(word.toLowerCase())
        );

        if (words.length >= 2) {
            // Try combinations of key words
            terms.push(words.slice(0, 2).join(' '));
            if (words.length >= 3) {
                terms.push(words.slice(0, 3).join(' '));
            }
        }

        // Remove duplicates and return
        return [...new Set(terms)];
    }

    calculateTitleSimilarity(originalTitle, compareTitle) {
        const orig = originalTitle.toLowerCase().trim();
        const comp = compareTitle.toLowerCase().trim();

        // Exact match
        if (orig === comp) return 100;

        // One contains the other
        if (orig.includes(comp) || comp.includes(orig)) return 90;

        // Calculate word overlap
        const origWords = orig.split(/\s+/).filter(w => w.length > 2);
        const compWords = comp.split(/\s+/).filter(w => w.length > 2);

        if (origWords.length === 0 || compWords.length === 0) return 0;

        const commonWords = origWords.filter(word =>
            compWords.some(cw => cw.includes(word) || word.includes(cw))
        );

        const similarity = (commonWords.length / Math.max(origWords.length, compWords.length)) * 100;

        // Bonus for similar length
        const lengthDiff = Math.abs(orig.length - comp.length);
        const lengthBonus = Math.max(0, 20 - lengthDiff);

        return Math.min(100, similarity + lengthBonus);
    }

    async getChapters(mangaUrl, sourceName) {
        try {
            return await this.parserManager.getChapters(mangaUrl, sourceName);
        } catch (error) {
            console.error('Failed to get chapters:', error);
            return [];
        }
    }

    async getPages(chapterUrl, sourceName) {
        try {
            return await this.parserManager.getPages(chapterUrl, sourceName);
        } catch (error) {
            console.error('Failed to get pages:', error);
            return [];
        }
    }

    async resolvePageUrl(pageUrl, sourceName) {
        try {
            return await this.parserManager.resolvePageUrl(pageUrl, sourceName);
        } catch (error) {
            console.error('Failed to resolve page URL:', error);
            return pageUrl; // Return original URL as fallback
        }
    }

    getAvailableSources() {
        return this.parserManager.getAvailableSources();
    }
}

module.exports = MangaScraper;