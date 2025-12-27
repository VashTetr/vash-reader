/**a
 * Utility for determining accurate chapter counts using consensus from multiple sources
 */

class ChapterConsensus {
    constructor(scraper) {
        this.scraper = scraper;
    }

    /**
     * Get chapter count consensus from multiple sources
     * @param {string} mangaTitle - The manga title to search for
     * @param {string} mangaUrl - Optional URL from a specific source
     * @param {number} maxSources - Maximum number of sources to check (default: 5)
     * @returns {Promise<{count: number, confidence: number, sources: Array}>}
     */
    async getChapterCountConsensus(mangaTitle, mangaUrl = null, maxSources = 5) {
        try {
            console.log(`Getting chapter count consensus for: ${mangaTitle}`);

            // Find manga in multiple sources
            const sources = await this.scraper.findMangaInAllSources(mangaTitle, mangaUrl);

            if (!sources || sources.length === 0) {
                console.log('No sources found for manga');
                return { count: 0, confidence: 0, sources: [] };
            }

            // Get chapter counts from each source
            const chapterCounts = [];
            const sourceResults = [];
            let checkedSources = 0;

            for (const source of sources.slice(0, maxSources)) {
                if (checkedSources >= maxSources) break;

                try {
                    console.log(`Checking chapters from ${source.parserName}...`);
                    const chapters = await this.scraper.getChapters(source.url, source.parserName);

                    if (chapters && chapters.length > 0) {
                        const count = chapters.length;
                        chapterCounts.push(count);
                        sourceResults.push({
                            source: source.parserName,
                            url: source.url,
                            count: count
                        });
                        console.log(`${source.parserName}: ${count} chapters`);
                    }

                    checkedSources++;
                } catch (error) {
                    console.log(`Failed to get chapters from ${source.parserName}:`, error.message);
                }
            }

            if (chapterCounts.length === 0) {
                console.log('No valid chapter counts found');
                return { count: 0, confidence: 0, sources: sourceResults };
            }

            // Calculate consensus
            const consensus = this.calculateConsensus(chapterCounts);

            console.log(`Chapter count consensus: ${consensus.count} (confidence: ${consensus.confidence}%)`);
            console.log('Source breakdown:', sourceResults);

            return {
                count: consensus.count,
                confidence: consensus.confidence,
                sources: sourceResults,
                allCounts: chapterCounts
            };

        } catch (error) {
            console.error('Error getting chapter count consensus:', error);
            return { count: 0, confidence: 0, sources: [] };
        }
    }

    /**
     * Calculate consensus from an array of chapter counts
     * @param {number[]} counts - Array of chapter counts from different sources
     * @returns {Object} - {count: number, confidence: number}
     */
    calculateConsensus(counts) {
        if (counts.length === 0) {
            return { count: 0, confidence: 0 };
        }

        if (counts.length === 1) {
            return { count: counts[0], confidence: 100 };
        }

        // Count frequency of each chapter count
        const frequency = {};
        for (const count of counts) {
            frequency[count] = (frequency[count] || 0) + 1;
        }

        // Find the most common count
        let maxFreq = 0;
        let consensusCount = 0;

        for (const [count, freq] of Object.entries(frequency)) {
            if (freq > maxFreq) {
                maxFreq = freq;
                consensusCount = parseInt(count);
            }
        }

        // Calculate confidence as percentage of sources that agree
        const confidence = Math.round((maxFreq / counts.length) * 100);

        // If confidence is low, try to find a reasonable range
        if (confidence < 60 && counts.length >= 3) {
            // Sort counts and see if there's a cluster
            const sortedCounts = [...counts].sort((a, b) => a - b);
            const median = sortedCounts[Math.floor(sortedCounts.length / 2)];

            // Check if most counts are within 10% of the median
            const tolerance = Math.max(5, Math.floor(median * 0.1)); // 10% tolerance, minimum 5
            const clusteredCounts = sortedCounts.filter(count =>
                Math.abs(count - median) <= tolerance
            );

            if (clusteredCounts.length >= Math.ceil(counts.length * 0.6)) {
                // Use the median of the clustered counts
                const clusterMedian = clusteredCounts[Math.floor(clusteredCounts.length / 2)];
                return {
                    count: clusterMedian,
                    confidence: Math.round((clusteredCounts.length / counts.length) * 100)
                };
            }
        }

        return { count: consensusCount, confidence };
    }

    /**
     * Get a quick chapter count estimate (fewer sources, faster)
     * @param {string} mangaTitle - The manga title
     * @param {string} mangaUrl - Optional URL from a specific source
     * @returns {Promise<number>} - Estimated chapter count
     */
    async getQuickChapterCount(mangaTitle, mangaUrl = null) {
        const result = await this.getChapterCountConsensus(mangaTitle, mangaUrl, 3);
        return result.count;
    }

    /**
     * Check if a chapter count seems reasonable compared to consensus
     * @param {number} reportedCount - The reported chapter count
     * @param {string} mangaTitle - The manga title
     * @param {string} mangaUrl - Optional URL
     * @returns {Promise<{isReasonable: boolean, suggestedCount: number, confidence: number}>}
     */
    async validateChapterCount(reportedCount, mangaTitle, mangaUrl = null) {
        const consensus = await this.getChapterCountConsensus(mangaTitle, mangaUrl, 4);

        if (consensus.confidence < 50) {
            // Not enough confidence to validate
            return {
                isReasonable: true, // Assume it's reasonable if we can't verify
                suggestedCount: reportedCount,
                confidence: 0
            };
        }

        const tolerance = Math.max(5, Math.floor(consensus.count * 0.15)); // 15% tolerance
        const isReasonable = Math.abs(reportedCount - consensus.count) <= tolerance;

        return {
            isReasonable,
            suggestedCount: consensus.count,
            confidence: consensus.confidence
        };
    }
}

module.exports = ChapterConsensus;