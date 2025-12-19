// Search utility functions for better relevance scoring

class SearchUtils {
    static calculateRelevance(searchQuery, manga) {
        const query = searchQuery.toLowerCase().trim();
        const title = manga.title.toLowerCase();
        const description = (manga.description || '').toLowerCase();

        let score = 0;

        // Exact title match gets highest score
        if (title === query) {
            score += 100;
        }
        // Title starts with query
        else if (title.startsWith(query)) {
            score += 80;
        }
        // Title contains all words from query
        else if (this.containsAllWords(title, query)) {
            score += 60;
        }
        // Title contains some words from query
        else if (this.containsSomeWords(title, query)) {
            score += 40;
        }
        // Description contains query
        else if (description.includes(query)) {
            score += 20;
        }
        // Description contains some words
        else if (this.containsSomeWords(description, query)) {
            score += 10;
        }

        // Bonus for shorter titles (more likely to be exact matches)
        if (title.length < 50) {
            score += 5;
        }

        return score;
    }

    static containsAllWords(text, query) {
        const queryWords = query.split(' ').filter(word => word.length > 2);
        return queryWords.every(word => text.includes(word));
    }

    static containsSomeWords(text, query) {
        const queryWords = query.split(' ').filter(word => word.length > 2);
        return queryWords.some(word => text.includes(word));
    }

    static filterAndSortResults(results, searchQuery, minScore = 15) {
        // Calculate relevance scores
        const scoredResults = results.map(manga => ({
            ...manga,
            relevanceScore: this.calculateRelevance(searchQuery, manga)
        }));

        // Filter out low relevance results
        const filteredResults = scoredResults.filter(manga => manga.relevanceScore >= minScore);

        // Sort by relevance score (highest first)
        filteredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

        // Remove the relevanceScore property before returning
        return filteredResults.map(manga => {
            const { relevanceScore, ...mangaWithoutScore } = manga;
            return mangaWithoutScore;
        });
    }

    static highlightMatchedTerms(title, searchQuery) {
        const query = searchQuery.toLowerCase().trim();
        const queryWords = query.split(' ').filter(word => word.length > 2);

        let highlightedTitle = title;

        // Highlight exact query match
        const regex = new RegExp(`(${query})`, 'gi');
        highlightedTitle = highlightedTitle.replace(regex, '<mark>$1</mark>');

        // If no exact match, highlight individual words
        if (!highlightedTitle.includes('<mark>')) {
            queryWords.forEach(word => {
                const wordRegex = new RegExp(`(${word})`, 'gi');
                highlightedTitle = highlightedTitle.replace(wordRegex, '<mark>$1</mark>');
            });
        }

        return highlightedTitle;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchUtils;
} else {
    // Browser context
    window.SearchUtils = SearchUtils;
}