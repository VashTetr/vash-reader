class MangaReader {
    constructor() {
        this.currentManga = null;
        this.currentChapter = null;
        this.currentPages = [];
        this.currentPageIndex = 0;

        // Home page data
        this.popularData = [];
        this.recentData = [];
        this.lastReadData = [];
        this.currentPopularPage = 0;
        this.currentLastReadPage = 0;
        this.currentTrendingPage = 0;
        this.currentNewFollowPage = 0;

        // Search pagination
        this.currentSearchQuery = '';
        this.currentSearchFilters = null;
        this.currentSearchPage = 1;
        this.isLoadingMore = false;
        this.hasMoreResults = true;

        // Initialize content filter
        this.contentFilter = new ContentFilter();

        // Navigation history
        this.navigationHistory = [];
        this.currentContinueInfo = null;

        this.initializeEventListeners();
        this.loadHomePage();
        this.updateNotificationBadge();
        this.updateFilterToggle();

        // Check for new chapters on startup (with delay to let app load first)
        setTimeout(() => {
            this.checkForNewChaptersIfNeeded();
        }, 5000); // 5 second delay

        // Add window resize listener to recalculate layout
        window.addEventListener('resize', () => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 300); // Debounce resize events
        });
    }

    handleResize() {
        const oldItemsToShow = this.itemsToShow;
        this.calculateItemsPerRow();

        // Only reload if the number of items to show has changed significantly
        if (Math.abs(this.itemsToShow - oldItemsToShow) >= 4) {
            console.log('Screen size changed significantly, reloading home page...');
            this.loadHomePage();
        }
    }



    initializeEventListeners() {
        // Helper function to safely add event listeners
        const addListener = (id, event, handler) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
            } else {
                console.error(`Element with id '${id}' not found`);
            }
        };

        // Search functionality
        addListener('searchBtn', 'click', () => this.searchManga());
        addListener('searchInput', 'keypress', (e) => {
            if (e.key === 'Enter') this.searchManga();
        });
        addListener('advancedSearchBtn', 'click', () => this.showAdvancedSearch());
        addListener('closeAdvancedSearch', 'click', () => this.hideAdvancedSearch());
        addListener('advancedSearchForm', 'submit', (e) => {
            e.preventDefault();
            this.performAdvancedSearch();
        });
        addListener('clearAdvancedSearch', 'click', () => this.clearAdvancedSearchForm());
        addListener('genreSearch', 'input', (e) => this.filterGenres('genresContainer', e.target.value));
        addListener('excludedGenreSearch', 'input', (e) => this.filterGenres('excludedGenresContainer', e.target.value));

        // Navigation
        addListener('homeTitle', 'click', () => this.showHomePage());

        addListener('backToSourceSelection', 'click', () => this.showMangaDetails(this.currentManga, this.currentContinueInfo));
        addListener('backToHomeFromFollows', 'click', () => this.showHomePage());
        addListener('backToHomeFromNotifications', 'click', () => this.showHomePage());
        addListener('backToSearchResults', 'click', () => this.goBack());
        addListener('backFromReader', 'click', () => this.goBackFromReader());

        // Reader navigation menu
        addListener('readerNavToggle', 'click', () => this.toggleReaderNavMenu());
        addListener('navHomeBtn', 'click', () => this.navigateFromReaderMenu('home'));
        addListener('navPrevChapterBtn', 'click', () => this.navigateFromReaderMenu('prevChapter'));
        addListener('navChapterSelect', 'change', (e) => {
            if (e.target.value) {
                this.goToChapter(parseInt(e.target.value));
            }
        });
        addListener('navNextChapterBtn', 'click', () => this.navigateFromReaderMenu('nextChapter'));

        // Header buttons
        addListener('followsBtn', 'click', () => this.showFollowsPage());
        addListener('notificationsBtn', 'click', () => this.showNotificationsPage());
        addListener('markAllReadBtn', 'click', () => this.markAllNotificationsRead());
        addListener('clearAllNotificationsBtn', 'click', () => this.clearAllNotifications());
        addListener('filterToggleBtn', 'click', () => this.toggleContentFilter());

        // Bottom navigation buttons
        addListener('bottomHomeTitle', 'click', () => this.showHomePage());
        addListener('bottomFollowsBtn', 'click', () => this.showFollowsPage());
        addListener('bottomNotificationsBtn', 'click', () => this.showNotificationsPage());

        // Import/Export buttons
        addListener('checkUpdatesBtn', 'click', () => this.manualCheckForUpdates());
        addListener('fetchCoversBtn', 'click', () => this.fetchAllCovers());
        addListener('updateReadingProgressBtn', 'click', () => this.updateReadingProgress());
        addListener('importFollowsBtn', 'click', () => this.importFollows());
        addListener('exportFollowsBtn', 'click', () => this.exportFollows());

        // Search and filter functionality
        addListener('followsSearchInput', 'input', () => this.filterFollows());
        addListener('statusFilter', 'change', () => this.filterFollows());
        addListener('clearFiltersBtn', 'click', () => this.clearFilters());
        addListener('csvFileInput', 'change', (e) => this.handleCSVFileSelect(e));

        // Reader controls (top)
        addListener('prevChapter', 'click', () => this.previousChapter());
        addListener('nextChapter', 'click', () => this.nextChapter());
        addListener('chapterSelect', 'change', (e) => this.goToChapter(parseInt(e.target.value)));

        // Reader controls (bottom)
        addListener('prevChapterBottom', 'click', () => this.previousChapter());
        addListener('nextChapterBottom', 'click', () => this.nextChapter());
        addListener('chapterSelectBottom', 'change', (e) => this.goToChapter(parseInt(e.target.value)));

        // Home page navigation
        addListener('lastReadPrev', 'click', () => this.navigateLastRead(-1));
        addListener('lastReadNext', 'click', () => this.navigateLastRead(1));
        addListener('popularPrev', 'click', () => this.navigatePopular(-1));
        addListener('popularNext', 'click', () => this.navigatePopular(1));
        addListener('trendingPrev', 'click', () => this.navigateTrending(-1));
        addListener('trendingNext', 'click', () => this.navigateTrending(1));
        addListener('newFollowPrev', 'click', () => this.navigateNewFollow(-1));
        addListener('newFollowNext', 'click', () => this.navigateNewFollow(1));

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (this.isReaderActive()) {
                if (e.key === 'ArrowLeft') this.previousChapter();
                if (e.key === 'ArrowRight') this.nextChapter();
                if (e.key === 'Escape') this.showHomePage();
            }
        });
    }

    async searchManga() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) return;

        // Reset pagination for new search
        this.currentSearchQuery = query;
        this.currentSearchFilters = null;
        this.currentSearchPage = 1;
        this.hasMoreResults = true;

        this.showLoading('Searching...');

        try {
            // Use Comick search for main search with pagination
            const comickResults = await window.mangaAPI.searchBySource(query, 'Comick', 1, 100);
            await this.displaySearchResults(comickResults, query, true); // true = new search
        } catch (error) {
            this.showError('Search failed: ' + error.message);
        }
    }

    async showAdvancedSearch() {
        const modal = document.getElementById('advancedSearchModal');
        modal.classList.remove('hidden');

        // Load genres and categories if not already loaded
        await this.loadGenresAndCategories();
    }

    hideAdvancedSearch() {
        const modal = document.getElementById('advancedSearchModal');
        modal.classList.add('hidden');
    }

    async loadGenresAndCategories() {
        try {
            // Load genres for both include and exclude containers
            const [genres, categories] = await Promise.all([
                window.mangaAPI.getGenres(),
                window.mangaAPI.getCategories()
            ]);

            // Combine genres and categories, filter out invalid entries and inappropriate content
            this.allGenres = [...genres, ...categories]
                .filter(genre =>
                    genre &&
                    genre.name &&
                    genre.name !== 'undefined' &&
                    genre.name.trim() !== '' &&
                    (genre.slug || genre.id) &&
                    // Hard filter: Never include loli content
                    !genre.name.toLowerCase().includes('loli') &&
                    !genre.slug?.toLowerCase().includes('loli')
                )
                .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically

            // Populate both containers
            this.populateGenreContainer('genresContainer', 'genre');
            this.populateGenreContainer('excludedGenresContainer', 'excludedGenre');

        } catch (error) {
            console.error('Failed to load genres:', error);
            document.getElementById('genresContainer').innerHTML = '<div class="loading">Failed to load genres</div>';
            document.getElementById('excludedGenresContainer').innerHTML = '<div class="loading">Failed to load genres</div>';
        }
    }

    populateGenreContainer(containerId, inputName, filteredGenres = null) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

        const genresToShow = filteredGenres || this.allGenres || [];

        if (genresToShow.length === 0) {
            container.innerHTML = '<div class="no-results">No genres found</div>';
            return;
        }

        genresToShow.forEach(genre => {
            const genreItem = document.createElement('div');
            genreItem.className = 'genre-item';
            genreItem.innerHTML = `
                <label>
                    <input type="checkbox" name="${inputName}" value="${genre.slug || genre.id}">
                    ${genre.name}
                </label>
            `;
            container.appendChild(genreItem);
        });
    }

    filterGenres(containerId, searchTerm) {
        if (!this.allGenres) return;

        const inputName = containerId === 'genresContainer' ? 'genre' : 'excludedGenre';

        if (!searchTerm.trim()) {
            // Show all genres if search is empty
            this.populateGenreContainer(containerId, inputName);
            return;
        }

        // Filter genres based on search term
        const filteredGenres = this.allGenres.filter(genre =>
            genre.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        this.populateGenreContainer(containerId, inputName, filteredGenres);
    }

    async performAdvancedSearch() {
        try {
            this.hideAdvancedSearch();
            this.showLoading('Searching with filters...');

            // Collect form data
            const filters = this.collectAdvancedSearchFilters();

            // Reset pagination for new search
            this.currentSearchQuery = '';
            this.currentSearchFilters = filters;
            this.currentSearchPage = 1;
            this.hasMoreResults = true;

            console.log('Advanced search filters:', filters);

            // Perform search
            const results = await window.mangaAPI.advancedSearch(filters);

            // Display results
            await this.displaySearchResults(results, filters.query || 'Advanced Search', true); // true = new search

        } catch (error) {
            console.error('Advanced search failed:', error);
            this.showError('Advanced search failed: ' + error.message);
        }
    }

    collectAdvancedSearchFilters() {
        const filters = {};

        // Basic query
        const query = document.getElementById('advancedQuery').value.trim();
        if (query) filters.query = query;

        // Type checkboxes
        const types = Array.from(document.querySelectorAll('input[name="type"]:checked'))
            .map(cb => cb.value);
        if (types.length > 0) filters.comic_types = types;

        // Demographics
        const demographics = Array.from(document.querySelectorAll('input[name="demographic"]:checked'))
            .map(cb => parseInt(cb.value));
        if (demographics.length > 0) filters.demographics = demographics;

        // Status
        const status = document.getElementById('status').value;
        if (status) filters.status = parseInt(status);

        // Content rating
        const contentRating = Array.from(document.querySelectorAll('input[name="contentRating"]:checked'))
            .map(cb => cb.value);
        if (contentRating.length > 0) filters.contentRating = contentRating;

        // Country
        const countries = Array.from(document.querySelectorAll('input[name="country"]:checked'))
            .map(cb => cb.value);
        if (countries.length > 0) filters.countries = countries;

        // Year range
        const fromYear = document.getElementById('fromYear').value;
        const toYear = document.getElementById('toYear').value;
        if (fromYear) filters.fromYear = parseInt(fromYear);
        if (toYear) filters.toYear = parseInt(toYear);

        // Minimum chapters
        const minChapters = document.getElementById('minChapters').value;
        if (minChapters) filters.minChapters = parseInt(minChapters);

        // Genres (include)
        const genres = Array.from(document.querySelectorAll('input[name="genre"]:checked'))
            .map(cb => cb.value);
        if (genres.length > 0) filters.genres = genres;

        // Excluded genres
        const excludedGenres = Array.from(document.querySelectorAll('input[name="excludedGenre"]:checked'))
            .map(cb => cb.value);
        if (excludedGenres.length > 0) filters.excludedGenres = excludedGenres;

        // Sort
        const sort = document.getElementById('sort').value;
        if (sort) filters.sort = sort;

        // Default pagination (API limits: page max 50, limit max 300)
        filters.page = 1;
        filters.limit = 100;

        return filters;
    }

    clearAdvancedSearchForm() {
        // Clear text inputs
        document.getElementById('advancedQuery').value = '';
        document.getElementById('fromYear').value = '';
        document.getElementById('toYear').value = '';
        document.getElementById('minChapters').value = '';

        // Clear genre search inputs
        document.getElementById('genreSearch').value = '';
        document.getElementById('excludedGenreSearch').value = '';

        // Clear select
        document.getElementById('status').value = '';
        document.getElementById('sort').value = '';

        // Clear all checkboxes
        document.querySelectorAll('#advancedSearchForm input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });

        // Reset genre containers to show all genres
        if (this.allGenres) {
            this.populateGenreContainer('genresContainer', 'genre');
            this.populateGenreContainer('excludedGenresContainer', 'excludedGenre');
        }
    }

    filterSearchResults(results, searchQuery) {
        const query = searchQuery.toLowerCase().trim();

        // Calculate relevance scores
        const scoredResults = results.map(manga => {
            let score = 0;
            const title = manga.title.toLowerCase();
            const description = (manga.description || '').toLowerCase();

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

            return { ...manga, relevanceScore: score };
        });

        // Filter out low relevance results (score < 25 for stricter filtering)
        const filteredResults = scoredResults.filter(manga => manga.relevanceScore >= 25);

        // Sort by relevance score (highest first)
        filteredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

        // Remove the relevanceScore property and return top 20 results
        return filteredResults.slice(0, 20).map(manga => {
            const { relevanceScore, ...mangaWithoutScore } = manga;
            return mangaWithoutScore;
        });
    }

    containsAllWords(text, query) {
        const queryWords = query.split(' ').filter(word => word.length > 2);
        return queryWords.every(word => text.includes(word));
    }

    containsSomeWords(text, query) {
        const queryWords = query.split(' ').filter(word => word.length > 2);
        return queryWords.some(word => text.includes(word));
    }

    highlightSearchTerms(title, searchQuery) {
        if (!searchQuery) return title;

        const query = searchQuery.toLowerCase().trim();
        const queryWords = query.split(' ').filter(word => word.length > 2);

        let highlightedTitle = title;

        // First try to highlight the exact query
        const exactRegex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        if (title.toLowerCase().includes(query)) {
            highlightedTitle = highlightedTitle.replace(exactRegex, '<mark style="background: #ff6b6b; color: white; padding: 1px 3px; border-radius: 2px;">$1</mark>');
        } else {
            // If no exact match, highlight individual words
            queryWords.forEach(word => {
                const wordRegex = new RegExp(`(${this.escapeRegex(word)})`, 'gi');
                highlightedTitle = highlightedTitle.replace(wordRegex, '<mark style="background: #ff6b6b; color: white; padding: 1px 3px; border-radius: 2px;">$1</mark>');
            });
        }

        return highlightedTitle;
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    async displaySearchResults(results, searchQuery = '', isNewSearch = false) {
        const resultsGrid = document.getElementById('resultsGrid');

        // Clear grid only for new searches
        if (isNewSearch) {
            resultsGrid.innerHTML = '';
            this.setupInfiniteScroll();
        }

        if (results.length === 0) {
            if (isNewSearch) {
                resultsGrid.innerHTML = '<p>No relevant results found. Try different keywords or check spelling.</p>';
                this.hasMoreResults = false;
            }
        } else {
            // Deduplicate results based on title similarity
            const deduplicatedResults = this.deduplicateResults(results);

            console.log(`Page ${this.currentSearchPage}: Original results: ${results.length}, After deduplication: ${deduplicatedResults.length}`);

            // Check if we have fewer results than requested (indicates last page)
            // Also check if we've hit the API's page limit (50 pages max)
            if (results.length < 100 || this.currentSearchPage >= 50) {
                this.hasMoreResults = false;
                if (this.currentSearchPage >= 50) {
                    console.log('Reached Comick API page limit (50 pages max)');
                }
            }

            // Process cards sequentially to handle async createMangaCard
            for (const manga of deduplicatedResults) {
                const card = await this.createMangaCard(manga, searchQuery);
                resultsGrid.appendChild(card);
            }
        }

        // Show loading indicator at bottom if there are more results
        this.updateLoadMoreIndicator();
        this.showSearchResults();
        this.hideLoading();
    }

    setupInfiniteScroll() {
        // Remove existing scroll listener
        if (this.scrollListener) {
            window.removeEventListener('scroll', this.scrollListener);
        }

        // Add new scroll listener
        this.scrollListener = () => {
            if (this.isLoadingMore || !this.hasMoreResults) return;

            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;

            // Load more when user is 200px from bottom
            if (scrollTop + windowHeight >= documentHeight - 200) {
                this.loadMoreResults();
            }
        };

        window.addEventListener('scroll', this.scrollListener);
    }

    async loadMoreResults() {
        if (this.isLoadingMore || !this.hasMoreResults) return;

        this.isLoadingMore = true;
        this.currentSearchPage++;

        try {
            let results = [];

            if (this.currentSearchFilters) {
                // Advanced search
                const filters = { ...this.currentSearchFilters, page: this.currentSearchPage };
                results = await window.mangaAPI.advancedSearch(filters);
            } else if (this.currentSearchQuery) {
                // Regular search
                results = await window.mangaAPI.searchBySource(this.currentSearchQuery, 'Comick', this.currentSearchPage, 100);
            }

            await this.displaySearchResults(results, this.currentSearchQuery || 'Advanced Search', false); // false = append results

        } catch (error) {
            console.error('Failed to load more results:', error);
            this.hasMoreResults = false;
        } finally {
            this.isLoadingMore = false;
            this.updateLoadMoreIndicator();
        }
    }

    updateLoadMoreIndicator() {
        // Remove existing indicator
        const existingIndicator = document.getElementById('loadMoreIndicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }

        const resultsGrid = document.getElementById('resultsGrid');

        if (this.hasMoreResults) {
            const indicator = document.createElement('div');
            indicator.id = 'loadMoreIndicator';
            indicator.className = 'load-more-indicator';
            indicator.innerHTML = this.isLoadingMore ?
                '<div class="loading-spinner">Loading more results...</div>' :
                '<div class="scroll-hint">Scroll down for more results</div>';

            resultsGrid.appendChild(indicator);
        }
    }

    deduplicateResults(results) {
        const seen = new Map();
        const deduplicated = [];

        for (const manga of results) {
            // Create a normalized title for comparison
            const normalizedTitle = this.normalizeTitle(manga.title);

            // Check if we've seen this title before
            if (!seen.has(normalizedTitle)) {
                seen.set(normalizedTitle, manga);
                deduplicated.push(manga);
            } else {
                // If we have a duplicate, keep the one with better data
                const existing = seen.get(normalizedTitle);
                const better = this.chooseBetterManga(existing, manga);

                if (better !== existing) {
                    // Replace the existing one
                    const index = deduplicated.findIndex(m => m === existing);
                    if (index !== -1) {
                        deduplicated[index] = better;
                        seen.set(normalizedTitle, better);
                    }
                }
            }
        }

        return deduplicated;
    }

    normalizeTitle(title) {
        return title
            .toLowerCase()
            .trim()
            // Remove common variations
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/\b(the|a|an)\b/g, '') // Remove articles
            .trim();
    }

    chooseBetterManga(manga1, manga2) {
        // Prefer manga with more complete data
        let score1 = 0;
        let score2 = 0;

        // Score based on available data
        if (manga1.coverUrl) score1 += 2;
        if (manga1.description && manga1.description.length > 50) score1 += 2;
        if (manga1.rating) score1 += 1;
        if (manga1.follows) score1 += 1;

        if (manga2.coverUrl) score2 += 2;
        if (manga2.description && manga2.description.length > 50) score2 += 2;
        if (manga2.rating) score2 += 1;
        if (manga2.follows) score2 += 1;

        // Prefer the one with higher score, or the first one if tied
        return score2 > score1 ? manga2 : manga1;
    }

    async createMangaCard(manga, searchQuery = '') {
        const card = document.createElement('div');
        card.className = 'manga-card';

        // Highlight search terms in title if search query provided
        let displayTitle = manga.title;
        if (searchQuery) {
            displayTitle = this.highlightSearchTerms(manga.title, searchQuery);
        }

        // Check if this manga is in following list
        let continueButton = '';
        try {
            const followedManga = await window.mangaAPI.getFollows();
            const exactMatch = followedManga.find(followed =>
                followed.title.toLowerCase().trim() === manga.title.toLowerCase().trim()
            );

            if (exactMatch) {
                // Check for reading progress (both regular and imported)
                let progress = null;
                let progressChapter = null;
                let hasProgress = false;

                // First check regular reading progress
                if (exactMatch.source && exactMatch.source !== 'Unknown') {
                    try {
                        progress = await window.mangaAPI.getReadingProgress(exactMatch.id, exactMatch.source);
                        if (progress && progress.chapterNumber) {
                            // If chapter is completed, suggest next chapter
                            if (progress.isChapterCompleted) {
                                progressChapter = parseFloat(progress.chapterNumber) + 1;
                            } else {
                                progressChapter = progress.chapterNumber;
                            }
                            hasProgress = true;
                        }
                    } catch (error) {
                        console.log('No regular progress found:', error.message);
                    }
                }

                // If no regular progress, check for imported progress (lastKnownChapter)
                if (!hasProgress && exactMatch.lastKnownChapter && exactMatch.lastKnownChapter > 0) {
                    progressChapter = exactMatch.lastKnownChapter;
                    hasProgress = true;
                }

                // Add continue button based on progress
                if (hasProgress) {
                    const isNextChapter = progress && progress.isChapterCompleted;
                    const buttonText = isNextChapter ? `📖 Next Ch. ${progressChapter}` : `📖 Continue Ch. ${progressChapter}`;
                    continueButton = `<button class="continue-btn-search" onclick="event.stopPropagation()" data-manga-id="${exactMatch.id}" data-source="${exactMatch.source}" data-chapter="${progressChapter}">${buttonText}</button>`;
                } else {
                    continueButton = `<button class="start-reading-btn-search" onclick="event.stopPropagation()" data-manga-id="${exactMatch.id}" data-source="${exactMatch.source}">📚 Start Reading</button>`;
                }
            }
        } catch (error) {
            console.error('Failed to check following list:', error);
        }

        // Fetch detailed metadata from Comick API if this is a Comick result
        let detailedManga = manga;
        if (manga.source === 'Comick' && manga.id) {
            try {
                const comickDetails = await window.mangaAPI.getMangaDetails(manga.id, 'Comick');
                if (comickDetails) {
                    detailedManga = { ...manga, ...comickDetails };
                }
            } catch (error) {
                console.log('Could not fetch Comick details for', manga.title, ':', error.message);
            }
        }

        // Format metadata for display (always show metadata, never description)
        const chapterCount = detailedManga.chapterCount || detailedManga.chapters || 'Unknown';
        const status = detailedManga.status || 'Unknown';
        const year = detailedManga.year || 'Unknown';

        // Check if all metadata is unknown (treat as 18+ content)
        const allMetadataUnknown = chapterCount === 'Unknown' && status === 'Unknown' && year === 'Unknown' &&
            (!detailedManga.genres || detailedManga.genres.length === 0);

        // Format genres (show first 3-4 genres)
        let genresDisplay = '';
        if (detailedManga.genres && detailedManga.genres.length > 0) {
            const displayGenres = detailedManga.genres.slice(0, 4);
            genresDisplay = displayGenres.map(genre => `<span class="genre-tag">${genre}</span>`).join('');
        }

        const contentSection = `
            <div class="manga-metadata">
                <div class="metadata-row">
                    <span class="metadata-label">Chapters:</span>
                    <span class="metadata-value">${chapterCount}</span>
                </div>
                <div class="metadata-row">
                    <span class="metadata-label">Status:</span>
                    <span class="metadata-value">${status}</span>
                </div>
                <div class="metadata-row">
                    <span class="metadata-label">Year:</span>
                    <span class="metadata-value">${year}</span>
                </div>
                ${genresDisplay ? `<div class="manga-genres">${genresDisplay}</div>` : ''}
            </div>
        `;

        // Check if content should be filtered (adult content OR unknown metadata)
        const isAdultContent = this.contentFilter.isAdultContent(detailedManga);
        const shouldCensor = (isAdultContent || allMetadataUnknown) && this.contentFilter.isEnabled;

        // Determine the reason for censoring
        let censorReason = 'Adult Content';
        if (allMetadataUnknown && !isAdultContent) {
            censorReason = 'Unknown Content - 18+';
        }

        // Apply content filtering
        let coverImage = '';
        if (manga.coverUrl) {
            if (shouldCensor) {
                // Create censored image HTML
                coverImage = `
                    <div class="censored-container">
                        <img src="${manga.coverUrl}" alt="${manga.title}" class="manga-cover censored-content">
                        <div class="censor-overlay">
                            <div class="censor-content">
                                <div class="censor-icon">🔞</div>
                                <div class="censor-text">${censorReason}</div>
                                <button class="censor-toggle" onclick="event.stopPropagation(); this.parentElement.parentElement.parentElement.classList.toggle('uncensored'); this.textContent = this.parentElement.parentElement.parentElement.classList.contains('uncensored') ? 'Hide' : 'Click to View'">Click to View</button>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                coverImage = `<img src="${manga.coverUrl}" alt="${manga.title}" class="manga-cover">`;
            }
        } else {
            coverImage = '<div class="manga-cover" style="background: #444; display: flex; align-items: center; justify-content: center; color: #999;">No Image</div>';
        }

        card.innerHTML = `
            ${coverImage}
            <div class="manga-title">${displayTitle}</div>
            <div class="manga-source">${manga.source}</div>
            ${contentSection}
            ${(isAdultContent || allMetadataUnknown) ? '<div class="content-warning">18+</div>' : ''}
            ${continueButton}
            <button class="manga-menu" onclick="event.stopPropagation()">⋮</button>
        `;

        card.addEventListener('click', () => this.selectManga(manga));

        // Add continue button functionality
        const continueBtn = card.querySelector('.continue-btn-search');
        const startBtn = card.querySelector('.start-reading-btn-search');

        if (continueBtn) {
            continueBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const mangaId = continueBtn.dataset.mangaId;

                // Get the followed manga details
                try {
                    const followedManga = await window.mangaAPI.getFollows();
                    const followedMangaData = followedManga.find(m => m.id === mangaId);

                    if (followedMangaData) {
                        // Use the same method as Following tab
                        this.showContinueFromImported(followedMangaData);
                    } else {
                        this.showError('Manga not found in following list');
                    }
                } catch (error) {
                    this.showError('Failed to continue reading: ' + error.message);
                }
            });
        }

        if (startBtn) {
            startBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const mangaId = startBtn.dataset.mangaId;

                // Get the followed manga details
                try {
                    const followedManga = await window.mangaAPI.getFollows();
                    const followedMangaData = followedManga.find(m => m.id === mangaId);

                    if (followedMangaData) {
                        // Use regular manga selection for start reading (same as Following tab)
                        this.selectManga(followedMangaData);
                    } else {
                        this.showError('Manga not found in following list');
                    }
                } catch (error) {
                    this.showError('Failed to start reading: ' + error.message);
                }
            });
        }

        // Add menu functionality
        const menuBtn = card.querySelector('.manga-menu');
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showMangaMenu(e, manga, card);
        });

        // Apply content filtering
        this.contentFilter.applyCensorToCard(card, manga);
        this.contentFilter.addContentWarning(card, manga);

        return card;
    }

    async checkForNewChaptersIfNeeded() {
        try {
            // Check if we should run the notification check (3-hour cooldown)
            const shouldCheck = await window.mangaAPI.shouldCheckForNotifications();

            if (shouldCheck) {
                console.log('3+ hours since last check, running notification check...');
                await this.checkForNewChapters();
            } else {
                console.log('Skipping notification check (less than 3 hours since last check)');
            }
        } catch (error) {
            console.error('Failed to check notification timing:', error);
        }
    }

    async manualCheckForUpdates() {
        try {
            const checkBtn = document.getElementById('checkUpdatesBtn');
            const originalText = checkBtn.innerHTML;

            checkBtn.disabled = true;
            checkBtn.innerHTML = '⏳ Checking...';

            console.log('Manual chapter update check requested...');
            const results = await window.mangaAPI.checkForUpdates();

            if (results.error) {
                this.showError('Update check failed: ' + results.error);
            } else {
                // Update notification badge
                await this.updateNotificationBadge();

                // Show results
                if (results.newChapters > 0) {
                    this.showSuccess(`Found ${results.newChapters} new chapter${results.newChapters > 1 ? 's' : ''} across ${results.checked} manga!`);
                } else {
                    this.showSuccess(`Checked ${results.checked} manga, no new chapters found.`);
                }
            }

            checkBtn.disabled = false;
            checkBtn.innerHTML = originalText;
        } catch (error) {
            console.error('Manual update check failed:', error);
            this.showError('Failed to check for updates: ' + error.message);

            const checkBtn = document.getElementById('checkUpdatesBtn');
            checkBtn.disabled = false;
            checkBtn.innerHTML = '🔄 Check for Updates';
        }
    }

    async checkForNewChapters() {
        try {
            console.log('Starting automatic chapter update check...');

            // Show a subtle loading indicator
            const originalTitle = document.title;
            document.title = '🔄 Checking for updates... - Vash Reader';

            const results = await window.mangaAPI.checkForUpdates();

            // Restore title
            document.title = originalTitle;

            if (results.error) {
                console.error('Update check failed:', results.error);
                return;
            }

            console.log('Update check completed:', results);

            // Update notification badge
            await this.updateNotificationBadge();

            // Show success message if new chapters found
            if (results.newChapters > 0) {
                this.showSuccess(`Found ${results.newChapters} new chapter${results.newChapters > 1 ? 's' : ''} across ${results.checked} manga!`);
            } else if (results.checked > 0) {
                console.log(`Checked ${results.checked} manga, no new chapters found`);
            }

        } catch (error) {
            console.error('Failed to check for updates:', error);
            document.title = 'Vash Reader'; // Restore title on error
        }
    }

    displayChapterList(chapters) {
        document.getElementById('mangaTitle').textContent = this.currentManga.title;
        this.allChapters = chapters; // Store for navigation

        const chaptersGrid = document.getElementById('chaptersGrid');
        chaptersGrid.innerHTML = '';

        if (chapters.length === 0) {
            chaptersGrid.innerHTML = '<p>No chapters available</p>';
        } else {
            // Sort chapters by number (ascending - Chapter 1 first)
            const sortedChapters = [...chapters].sort((a, b) => {
                const numA = parseFloat(a.number) || 0;
                const numB = parseFloat(b.number) || 0;
                return numA - numB;
            });

            sortedChapters.forEach((chapter, index) => {
                chapter.index = index; // Add index for navigation
                const item = this.createChapterItem(chapter);
                chaptersGrid.appendChild(item);
            });
        }

        this.showChapterList();
    }

    createChapterItem(chapter) {
        const item = document.createElement('div');
        item.className = 'chapter-item';
        item.innerHTML = `
            <div><strong>Chapter ${chapter.number}</strong></div>
            <div>${chapter.title}</div>
            ${chapter.pages ? `<div>${chapter.pages} pages</div>` : ''}
        `;

        item.addEventListener('click', () => this.readChapter(chapter));
        return item;
    }

    async readChapter(chapter, fromPage = 'chapterList') {
        // Ensure chapter has correct index if not already set
        if (chapter.index === undefined && this.allChapters) {
            const chapterIndex = this.allChapters.findIndex(ch => ch.id === chapter.id);
            if (chapterIndex !== -1) {
                chapter.index = chapterIndex;
            }
        }

        this.currentChapter = chapter;
        this.showLoading('Loading pages...');

        try {
            const pages = await window.mangaAPI.getPages(chapter.url, chapter.source);
            this.currentPages = pages;

            // Initialize reading progress tracking (will be updated as user scrolls)
            this.initializeProgressTracking();

            // Add to last read with current chapter
            await window.mangaAPI.addToLastRead(this.currentManga, chapter);

            await this.displayReader(fromPage);

            // Scroll to top of the page when loading a new chapter
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            this.showError('Failed to load pages: ' + error.message);
        }
    }

    async displayReader(fromPage = 'chapterList') {
        if (this.currentPages.length === 0) {
            this.showError('No pages available');
            return;
        }

        await this.updateReaderDisplay();
        this.showReader(fromPage);

        // Resume at saved position if available (but not when navigating between chapters)
        if (fromPage !== 'navigation') {
            await this.resumeAtSavedPosition();
        }

        this.hideLoading(); // Hide loading after pages are displayed
    }

    async resumeAtSavedPosition() {
        if (!this.currentManga || !this.currentChapter) return;

        try {
            const progress = await window.mangaAPI.getReadingProgress(this.currentManga.id, this.currentManga.source);

            if (progress &&
                progress.chapterNumber == this.currentChapter.number &&
                progress.pageNumber &&
                progress.scrollPosition !== undefined) {

                console.log(`Resuming at page ${progress.pageNumber}/${progress.totalPages}, scroll: ${(progress.scrollPosition * 100).toFixed(1)}%`);

                // Wait for images to load before scrolling
                setTimeout(() => {
                    this.scrollToSavedPosition(progress.pageNumber, progress.scrollPosition);
                }, 1500); // Give more time for images to load

                // Show resume indicator
                this.showResumeIndicator(progress.pageNumber, progress.totalPages, progress.scrollPosition);
            }
        } catch (error) {
            console.error('Failed to resume at saved position:', error);
        }
    }

    scrollToSavedPosition(pageNumber, scrollPosition) {
        const pageContainer = document.getElementById('pageContainer');
        if (!pageContainer) return;

        const pages = pageContainer.querySelectorAll('.manga-page-container');
        if (pages.length === 0 || pageNumber > pages.length) return;

        const targetPage = pages[pageNumber - 1]; // Convert to 0-based index
        if (!targetPage) return;

        const rect = targetPage.getBoundingClientRect();
        const pageTop = window.pageYOffset + rect.top;
        const pageHeight = rect.height;

        // Calculate exact scroll position within the page
        const targetScrollTop = pageTop + (pageHeight * scrollPosition);

        // Smooth scroll to position
        window.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
        });
    }

    showResumeIndicator(pageNumber, totalPages, scrollPosition) {
        const indicator = document.createElement('div');
        indicator.className = 'resume-indicator';
        const scrollPercent = (scrollPosition * 100).toFixed(0);
        indicator.innerHTML = `📖 Resumed at page ${pageNumber}/${totalPages} (${scrollPercent}% through page)`;
        indicator.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #2196F3;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        document.body.appendChild(indicator);

        // Animate in
        setTimeout(() => {
            indicator.style.opacity = '1';
        }, 100);

        // Remove after 4 seconds
        setTimeout(() => {
            indicator.style.opacity = '0';
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.parentNode.removeChild(indicator);
                }
            }, 300);
        }, 4000);
    }

    async updateReaderDisplay() {
        const pageContainer = document.getElementById('pageContainer');
        const pageInfo = document.getElementById('pageInfo');
        const chapterSelect = document.getElementById('chapterSelect');

        // Display all pages vertically
        pageContainer.innerHTML = '';

        // Process pages sequentially to handle async resolution
        for (const page of this.currentPages) {
            console.log(`Loading page ${page.pageNumber}: ${page.imageUrl}`);

            const pageDiv = document.createElement('div');
            pageDiv.className = 'manga-page-container';

            const img = document.createElement('img');
            img.alt = `Page ${page.pageNumber}`;
            img.className = 'manga-page';

            // Handle page URL resolution for MangaTown
            let imageUrl = page.imageUrl;
            if (page.needsResolution && this.currentSource === 'MangaTown') {
                try {
                    console.log(`Resolving MangaTown page URL: ${page.imageUrl}`);
                    imageUrl = await window.mangaAPI.resolvePageUrl(page.imageUrl, this.currentSource);
                    console.log(`Resolved to image URL: ${imageUrl}`);
                } catch (error) {
                    console.error(`Failed to resolve page URL: ${error.message}`);
                    imageUrl = page.imageUrl; // Fallback
                }
            }

            // Load image with proper referrer headers
            try {
                const referrerMap = {
                    'MangaBuddy': 'https://mangabuddy.com/',
                    'TrueManga': 'https://truemanga.com/',
                    'MangaTown': 'https://www.mangatown.com/'
                };

                const referrer = referrerMap[this.currentSource];

                // Direct loading for all sources now
                // MangaTown images will have proper headers added by the global request interceptor
                img.src = imageUrl;
            } catch (error) {
                console.error(`Failed to load image with referrer: ${error.message}`);
                img.src = imageUrl; // Fallback to direct loading
            }

            // Add error handling for images
            img.onerror = () => {
                console.error(`Failed to load image: ${imageUrl}`);
                img.alt = `Failed to load page ${page.pageNumber}`;
                img.style.background = '#333';
                img.style.color = '#fff';
                img.style.padding = '20px';
                img.style.textAlign = 'center';
            };

            img.onload = () => {
                console.log(`Successfully loaded page ${page.pageNumber}`);
            };

            pageDiv.appendChild(img);
            pageContainer.appendChild(pageDiv);
        }

        // Update chapter info (both top and bottom)
        const chapterTitle = this.currentChapter.title || `Chapter ${this.currentChapter.number}`;
        const pageInfoText = `${chapterTitle} - ${this.currentPages.length} pages`;

        pageInfo.textContent = pageInfoText;
        const pageInfoBottom = document.getElementById('pageInfoBottom');
        if (pageInfoBottom) {
            pageInfoBottom.textContent = pageInfoText;
        }

        // Update chapter selector (both top and bottom)
        const chapterSelectBottom = document.getElementById('chapterSelectBottom');

        if (this.allChapters) {
            // Update top selector
            if (chapterSelect) {
                chapterSelect.innerHTML = '';
                this.allChapters.forEach(chapter => {
                    const option = document.createElement('option');
                    option.value = chapter.index;
                    option.textContent = `Ch. ${chapter.number}${chapter.title ? ` - ${chapter.title}` : ''}`;
                    if (chapter.number === this.currentChapter.number) {
                        option.selected = true;
                    }
                    chapterSelect.appendChild(option);
                });
            }

            // Update bottom selector
            if (chapterSelectBottom) {
                chapterSelectBottom.innerHTML = '';
                this.allChapters.forEach(chapter => {
                    const option = document.createElement('option');
                    option.value = chapter.index;
                    option.textContent = `Ch. ${chapter.number}${chapter.title ? ` - ${chapter.title}` : ''}`;
                    if (chapter.number === this.currentChapter.number) {
                        option.selected = true;
                    }
                    chapterSelectBottom.appendChild(option);
                });
            }

            // Update navigation menu chapter selector
            this.updateNavChapterSelect();
        }

        // Update navigation buttons (both top and bottom)
        const currentIndex = this.currentChapter.index || 0;
        const isFirstChapter = currentIndex === 0;
        const isLastChapter = currentIndex >= (this.allChapters?.length - 1 || 0);

        // Top navigation
        document.getElementById('prevChapter').disabled = isFirstChapter;
        document.getElementById('nextChapter').disabled = isLastChapter;

        // Bottom navigation
        const prevChapterBottom = document.getElementById('prevChapterBottom');
        const nextChapterBottom = document.getElementById('nextChapterBottom');
        if (prevChapterBottom) prevChapterBottom.disabled = isFirstChapter;
        if (nextChapterBottom) nextChapterBottom.disabled = isLastChapter;
    }

    async previousChapter() {
        // Save current progress before changing chapters
        this.updateReadingProgressFromScroll();
        console.log('💾 Progress saved before previous chapter');

        const currentIndex = this.currentChapter.index || 0;
        if (currentIndex > 0 && this.allChapters) {
            const prevChapter = this.allChapters[currentIndex - 1];
            await this.readChapter(prevChapter, 'navigation');
        }
    }

    async nextChapter() {
        // Save current progress before changing chapters
        this.updateReadingProgressFromScroll();
        console.log('💾 Progress saved before next chapter');

        const currentIndex = this.currentChapter.index || 0;
        if (currentIndex < (this.allChapters?.length - 1 || 0) && this.allChapters) {
            const nextChapter = this.allChapters[currentIndex + 1];
            await this.readChapter(nextChapter, 'navigation');
        }
    }

    async goToChapter(chapterIndex) {
        if (this.allChapters && this.allChapters[chapterIndex]) {
            const chapter = this.allChapters[chapterIndex];
            await this.readChapter(chapter, 'navigation');
        }
    }

    isReaderActive() {
        return !document.getElementById('reader').classList.contains('hidden');
    }

    initializeProgressTracking() {
        // Remove existing scroll listener if any
        if (this.progressTrackingListener) {
            window.removeEventListener('scroll', this.progressTrackingListener);
        }

        // Add scroll listener for progress tracking (more frequent)
        this.progressTrackingListener = this.throttle(() => {
            this.updateReadingProgressFromScroll();
        }, 500); // Update every 500ms for more responsiveness

        window.addEventListener('scroll', this.progressTrackingListener);

        // Add additional progress tracking triggers
        this.setupAdditionalProgressTracking();

        // Setup header visibility tracking
        this.setupHeaderVisibilityTracking();

        // Initial progress update
        setTimeout(() => {
            this.updateReadingProgressFromScroll();
        }, 1000); // Give time for images to load
    }

    updateReadingProgressFromScroll() {
        if (!this.isReaderActive() || !this.currentManga || !this.currentChapter || !this.currentPages) {
            return;
        }

        const pageContainer = document.getElementById('pageContainer');
        if (!pageContainer) return;

        const pages = pageContainer.querySelectorAll('.manga-page-container');
        if (pages.length === 0) return;

        // Calculate which page is currently visible and scroll position
        const viewportHeight = window.innerHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const viewportCenter = scrollTop + viewportHeight / 2;

        let currentPageNumber = 1;
        let scrollPosition = 0;

        // Find the page that's most visible in the viewport (improved algorithm)
        let maxVisibleArea = 0;
        let bestPageIndex = 0;
        let bestScrollPosition = 0;

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const rect = page.getBoundingClientRect();
            const pageTop = scrollTop + rect.top;
            const pageBottom = pageTop + rect.height;

            // Calculate how much of this page is visible in the viewport
            const visibleTop = Math.max(pageTop, scrollTop);
            const visibleBottom = Math.min(pageBottom, scrollTop + viewportHeight);
            const visibleArea = Math.max(0, visibleBottom - visibleTop);

            // If this page has more visible area, it's the current page
            if (visibleArea > maxVisibleArea) {
                maxVisibleArea = visibleArea;
                bestPageIndex = i;

                // Calculate more accurate scroll position within this page
                if (rect.height > 0) {
                    // How far through the page is the viewport center?
                    const pageProgress = Math.max(0, Math.min(1, (viewportCenter - pageTop) / rect.height));
                    bestScrollPosition = pageProgress;
                } else {
                    bestScrollPosition = 0;
                }
            }
        }

        currentPageNumber = bestPageIndex + 1;
        scrollPosition = bestScrollPosition;

        // If we're past all pages, we're on the last page at the bottom
        if (viewportCenter > pages[pages.length - 1].getBoundingClientRect().bottom + scrollTop) {
            currentPageNumber = pages.length;
            scrollPosition = 1.0;
        }

        // Update reading progress
        this.updateReadingProgressData(currentPageNumber, scrollPosition);
    }

    async updateReadingProgressData(pageNumber, scrollPosition) {
        if (!this.currentManga || !this.currentChapter || !this.currentPages) return;

        const totalPages = this.currentPages.length;

        try {
            await window.mangaAPI.updateReadingProgress(
                this.currentManga.id,
                this.currentManga.source,
                this.currentChapter.number,
                pageNumber,
                scrollPosition,
                totalPages
            );

            // Debug logging for progress tracking
            console.log(`📊 Progress: Ch.${this.currentChapter.number}, Page ${pageNumber}/${totalPages}, Scroll: ${(scrollPosition * 100).toFixed(1)}%`);

            // Check if chapter is completed (on last page and scrolled to bottom)
            const isChapterCompleted = pageNumber >= totalPages && scrollPosition >= 0.9;

            if (isChapterCompleted && !this.chapterMarkedComplete) {
                this.chapterMarkedComplete = true;
                console.log(`Chapter ${this.currentChapter.number} marked as completed`);

                // Show subtle completion indicator
                this.showChapterCompletionIndicator();
            }
        } catch (error) {
            console.error('Failed to update reading progress:', error);
        }
    }

    showChapterCompletionIndicator() {
        // Create a subtle completion indicator
        const indicator = document.createElement('div');
        indicator.className = 'chapter-completion-indicator';
        indicator.innerHTML = '✓ Chapter completed';
        indicator.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 14px;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        document.body.appendChild(indicator);

        // Animate in
        setTimeout(() => {
            indicator.style.opacity = '1';
        }, 100);

        // Remove after 3 seconds
        setTimeout(() => {
            indicator.style.opacity = '0';
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.parentNode.removeChild(indicator);
                }
            }, 300);
        }, 3000);
    }

    setupAdditionalProgressTracking() {
        // Track progress on page visibility change (when user switches tabs/apps)
        this.visibilityChangeListener = () => {
            if (document.visibilityState === 'hidden') {
                // User is leaving the page, save current progress
                this.updateReadingProgressFromScroll();
                console.log('📱 Progress saved on page visibility change');
            }
        };
        document.addEventListener('visibilitychange', this.visibilityChangeListener);

        // Track progress on window blur (when user clicks outside)
        this.windowBlurListener = () => {
            this.updateReadingProgressFromScroll();
            console.log('📱 Progress saved on window blur');
        };
        window.addEventListener('blur', this.windowBlurListener);

        // Periodic progress saving (every 10 seconds)
        this.progressInterval = setInterval(() => {
            if (this.isReaderActive()) {
                this.updateReadingProgressFromScroll();
                console.log('⏰ Periodic progress save');
            }
        }, 10000); // Every 10 seconds

        // Track progress on mouse movement (user is actively reading)
        let mouseTimeout;
        this.mouseMoveListener = () => {
            clearTimeout(mouseTimeout);
            mouseTimeout = setTimeout(() => {
                this.updateReadingProgressFromScroll();
                console.log('🖱️ Progress saved after mouse activity');
            }, 2000); // Save 2 seconds after mouse stops moving
        };
        document.addEventListener('mousemove', this.mouseMoveListener);

        // Track progress on keyboard activity
        this.keyboardListener = () => {
            this.updateReadingProgressFromScroll();
            console.log('⌨️ Progress saved on keyboard activity');
        };
        document.addEventListener('keydown', this.keyboardListener);
    }

    setupHeaderVisibilityTracking() {
        // Track header visibility to show/hide navigation menu
        this.headerVisibilityListener = this.throttle(() => {
            this.updateNavMenuVisibility();
        }, 100); // Check every 100ms for smooth visibility changes

        window.addEventListener('scroll', this.headerVisibilityListener);
    }

    updateNavMenuVisibility() {
        if (!this.isReaderActive()) return;

        const header = document.querySelector('.reader-controls-top');
        const navMenu = document.getElementById('readerNavMenu');

        if (!header || !navMenu) {
            return;
        }

        const headerRect = header.getBoundingClientRect();
        const isHeaderVisible = headerRect.bottom > 0; // Header is visible if bottom is above viewport top

        // Show menu only when header is not visible
        if (isHeaderVisible) {
            navMenu.classList.remove('visible');
        } else {
            navMenu.classList.add('visible');
        }
    }

    updateNavChapterSelect() {
        const navChapterSelect = document.getElementById('navChapterSelect');

        if (!navChapterSelect || !this.allChapters) {
            return;
        }

        // Clear existing options except the first one
        navChapterSelect.innerHTML = '<option value="">Chapter List</option>';

        // Add all chapters
        this.allChapters.forEach(chapter => {
            const option = document.createElement('option');
            option.value = chapter.index;
            option.textContent = `Ch. ${chapter.number}${chapter.title ? ` - ${chapter.title}` : ''}`;
            if (chapter.number === this.currentChapter?.number) {
                option.selected = true;
            }
            navChapterSelect.appendChild(option);
        });
    }











    // Utility function to throttle scroll events
    throttle(func, limit) {
        let inThrottle;
        return function () {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }

    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const text = document.getElementById('loadingText');
        if (overlay && text) {
            text.textContent = message;
            overlay.classList.remove('hidden');
        }
        console.log('Loading:', message);
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    showError(message) {
        alert('Error: ' + message);
        this.hideLoading(); // Hide loading when showing error
    }

    // Home page methods
    async loadHomePage() {
        try {
            // Calculate how many items can fit based on screen width
            this.calculateItemsPerRow();

            // Load all home page data
            await Promise.all([
                this.loadLastRead(),
                this.loadPopular(),
                this.loadTrending(),
                this.loadNewFollow(),
                this.loadRecent()
            ]);
        } catch (error) {
            console.error('Failed to load home page:', error);
        }
    }

    calculateItemsPerRow() {
        // Calculate based on screen width and card size
        const screenWidth = window.innerWidth;
        const cardWidth = 180; // Approximate card width including margins
        const sidebarPadding = 80; // Account for page padding

        // Calculate how many cards can fit in one row
        const itemsPerRow = Math.floor((screenWidth - sidebarPadding) / cardWidth);

        // Set minimum of 4 items per row, maximum of 12
        this.itemsPerRow = Math.max(4, Math.min(12, itemsPerRow));

        // Calculate total items to show (2 rows worth)
        this.itemsToShow = this.itemsPerRow * 2;

        console.log(`Screen width: ${screenWidth}px, Items per row: ${this.itemsPerRow}, Total items: ${this.itemsToShow}`);
    }

    async loadLastRead() {
        try {
            this.lastReadData = await window.mangaAPI.getLastRead();
            this.displayLastRead();
        } catch (error) {
            console.error('Failed to load last read:', error);
        }
    }

    async loadPopular() {
        try {
            // Load first page
            this.popularData = await window.mangaAPI.getPopular(1);

            // If we need more items to fill the screen, load additional pages
            if (this.popularData.length < this.itemsToShow) {
                const additionalPages = Math.ceil((this.itemsToShow - this.popularData.length) / 20); // Assuming 20 items per API page

                for (let page = 2; page <= Math.min(2 + additionalPages, 5); page++) { // Limit to 5 pages max
                    try {
                        const moreData = await window.mangaAPI.getPopular(page);
                        if (moreData.length > 0) {
                            this.popularData.push(...moreData);
                        }

                        // Stop if we have enough items
                        if (this.popularData.length >= this.itemsToShow) {
                            break;
                        }
                    } catch (error) {
                        console.warn(`Failed to load popular page ${page}:`, error);
                        break;
                    }
                }
            }

            this.displayPopular();
        } catch (error) {
            console.error('Failed to load popular:', error);
        }
    }

    async loadTrending() {
        try {
            // Load first page
            this.trendingData = await window.mangaAPI.getTrending(1);

            // If we need more items to fill the screen, load additional pages
            if (this.trendingData.length < this.itemsToShow) {
                const additionalPages = Math.ceil((this.itemsToShow - this.trendingData.length) / 20);

                for (let page = 2; page <= Math.min(2 + additionalPages, 5); page++) {
                    try {
                        const moreData = await window.mangaAPI.getTrending(page);
                        if (moreData.length > 0) {
                            this.trendingData.push(...moreData);
                        }

                        if (this.trendingData.length >= this.itemsToShow) {
                            break;
                        }
                    } catch (error) {
                        console.warn(`Failed to load trending page ${page}:`, error);
                        break;
                    }
                }
            }

            this.displayTrending();
        } catch (error) {
            console.error('Failed to load trending:', error);
        }
    }

    async loadNewFollow() {
        try {
            // Load first page
            this.newFollowData = await window.mangaAPI.getNewFollow(1);

            // If we need more items to fill the screen, load additional pages
            if (this.newFollowData.length < this.itemsToShow) {
                const additionalPages = Math.ceil((this.itemsToShow - this.newFollowData.length) / 20);

                for (let page = 2; page <= Math.min(2 + additionalPages, 5); page++) {
                    try {
                        const moreData = await window.mangaAPI.getNewFollow(page);
                        if (moreData.length > 0) {
                            this.newFollowData.push(...moreData);
                        }

                        if (this.newFollowData.length >= this.itemsToShow) {
                            break;
                        }
                    } catch (error) {
                        console.warn(`Failed to load new follow page ${page}:`, error);
                        break;
                    }
                }
            }

            this.displayNewFollow();
        } catch (error) {
            console.error('Failed to load new follow:', error);
        }
    }

    async loadRecent() {
        try {
            // Load first page
            this.recentData = await window.mangaAPI.getRecent(1);

            // If we need more items to fill the screen, load additional pages
            if (this.recentData.length < this.itemsToShow) {
                const additionalPages = Math.ceil((this.itemsToShow - this.recentData.length) / 20);

                for (let page = 2; page <= Math.min(2 + additionalPages, 5); page++) {
                    try {
                        const moreData = await window.mangaAPI.getRecent(page);
                        if (moreData.length > 0) {
                            this.recentData.push(...moreData);
                        }

                        if (this.recentData.length >= this.itemsToShow) {
                            break;
                        }
                    } catch (error) {
                        console.warn(`Failed to load recent page ${page}:`, error);
                        break;
                    }
                }
            }

            this.displayRecent();
        } catch (error) {
            console.error('Failed to load recent:', error);
        }
    }

    displayLastRead() {
        const grid = document.getElementById('lastReadGrid');
        grid.innerHTML = '';

        const itemsPerPage = this.itemsToShow || 8; // Fallback to 8 if not calculated
        const startIndex = this.currentLastReadPage * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const visibleItems = this.lastReadData.slice(startIndex, endIndex);

        visibleItems.forEach(manga => {
            const card = this.createHomeMangaCard(manga, true);
            grid.appendChild(card);
        });

        // Update navigation buttons
        document.getElementById('lastReadPrev').disabled = this.currentLastReadPage === 0;
        document.getElementById('lastReadNext').disabled = endIndex >= this.lastReadData.length;
    }

    displayPopular() {
        const grid = document.getElementById('popularGrid');
        grid.innerHTML = '';

        const itemsPerPage = this.itemsToShow || 8; // Fallback to 8 if not calculated
        const startIndex = this.currentPopularPage * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const visibleItems = this.popularData.slice(startIndex, endIndex);

        visibleItems.forEach(manga => {
            const card = this.createHomeMangaCard(manga);
            grid.appendChild(card);
        });

        // Update navigation buttons
        document.getElementById('popularPrev').disabled = this.currentPopularPage === 0;
        document.getElementById('popularNext').disabled = endIndex >= this.popularData.length;
    }

    displayTrending() {
        const grid = document.getElementById('trendingGrid');
        grid.innerHTML = '';

        const itemsPerPage = this.itemsToShow || 8; // Fallback to 8 if not calculated
        const startIndex = this.currentTrendingPage * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const visibleItems = this.trendingData.slice(startIndex, endIndex);

        visibleItems.forEach(manga => {
            const card = this.createHomeMangaCard(manga);
            grid.appendChild(card);
        });

        // Update navigation buttons
        document.getElementById('trendingPrev').disabled = this.currentTrendingPage === 0;
        document.getElementById('trendingNext').disabled = endIndex >= this.trendingData.length;
    }

    displayNewFollow() {
        const grid = document.getElementById('newFollowGrid');
        grid.innerHTML = '';

        const itemsPerPage = this.itemsToShow || 8; // Fallback to 8 if not calculated
        const startIndex = this.currentNewFollowPage * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const visibleItems = this.newFollowData.slice(startIndex, endIndex);

        visibleItems.forEach(manga => {
            const card = this.createHomeMangaCard(manga);
            grid.appendChild(card);
        });

        // Update navigation buttons
        document.getElementById('newFollowPrev').disabled = this.currentNewFollowPage === 0;
        document.getElementById('newFollowNext').disabled = endIndex >= this.newFollowData.length;
    }

    displayRecent() {
        const grid = document.getElementById('recentGrid');
        grid.innerHTML = '';

        const itemsToShow = this.itemsToShow || 20; // Fallback to 20 if not calculated
        this.recentData.slice(0, itemsToShow).forEach(manga => {
            const item = this.createRecentItem(manga);
            grid.appendChild(item);
        });
    }

    createHomeMangaCard(manga, isLastRead = false) {
        const card = document.createElement('div');
        card.className = 'home-manga-card';

        const chapterInfo = isLastRead && manga.lastChapter ?
            `<div class="home-manga-chapter">Last: ${manga.lastChapter.title || `Ch. ${manga.lastChapter.number}`}</div>` :
            manga.chapterTitle ? `<div class="home-manga-chapter">${manga.chapterTitle}</div>` : '';

        card.innerHTML = `
            ${manga.coverUrl ? `<img src="${manga.coverUrl}" alt="${manga.title}" class="home-manga-cover">` : '<div class="home-manga-cover" style="background: #444; display: flex; align-items: center; justify-content: center; color: #999;">No Image</div>'}
            <div class="home-manga-title">${manga.title}</div>
            <div class="home-manga-source">${manga.source}</div>
            ${chapterInfo}
            ${isLastRead ?
                (manga.lastChapter ?
                    `<button class="continue-btn-home" onclick="event.stopPropagation()">📖 Continue Ch. ${manga.lastChapter.number}</button>` :
                    `<button class="start-reading-btn-home" onclick="event.stopPropagation()">📚 Start Reading</button>`
                ) : ''
            }
            <button class="manga-menu" onclick="event.stopPropagation()">⋮</button>
        `;

        card.addEventListener('click', () => this.selectManga(manga));

        // Add button functionality for Last Read items
        if (isLastRead) {
            const continueBtn = card.querySelector('.continue-btn-home');
            const startBtn = card.querySelector('.start-reading-btn-home');

            if (continueBtn) {
                continueBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.continueFromLastRead(manga);
                });
            }

            if (startBtn) {
                startBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.selectManga(manga); // Just use regular manga selection for start reading
                });
            }
        }

        // Add menu functionality
        const menuBtn = card.querySelector('.manga-menu');
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showMangaMenu(e, manga, card, isLastRead);
        });

        return card;
    }

    createRecentItem(manga) {
        const item = document.createElement('div');
        item.className = 'recent-item';
        item.innerHTML = `
            ${manga.coverUrl ? `<img src="${manga.coverUrl}" alt="${manga.title}" class="recent-cover">` : '<div class="recent-cover" style="background: #444; display: flex; align-items: center; justify-content: center; color: #999; font-size: 0.7rem;">No Image</div>'}
            <div class="recent-info">
                <div class="recent-title">${manga.title}</div>
                <div class="recent-chapter">${manga.chapterTitle || `Chapter ${manga.chapterNumber}`}</div>
                <div class="recent-source">${manga.source}</div>
            </div>
        `;

        item.addEventListener('click', () => this.selectManga(manga));
        return item;
    }

    navigateLastRead(direction) {
        const newPage = this.currentLastReadPage + direction;
        const maxPage = Math.ceil(this.lastReadData.length / 8) - 1;

        if (newPage >= 0 && newPage <= maxPage) {
            this.currentLastReadPage = newPage;
            this.displayLastRead();
        }
    }

    navigatePopular(direction) {
        const newPage = this.currentPopularPage + direction;
        const maxPage = Math.ceil(this.popularData.length / 8) - 1;

        if (newPage >= 0 && newPage <= maxPage) {
            this.currentPopularPage = newPage;
            this.displayPopular();
        }
    }

    navigateTrending(direction) {
        const newPage = this.currentTrendingPage + direction;
        const maxPage = Math.ceil(this.trendingData.length / 8) - 1;

        if (newPage >= 0 && newPage <= maxPage) {
            this.currentTrendingPage = newPage;
            this.displayTrending();
        }
    }

    navigateNewFollow(direction) {
        const newPage = this.currentNewFollowPage + direction;
        const maxPage = Math.ceil(this.newFollowData.length / 8) - 1;

        if (newPage >= 0 && newPage <= maxPage) {
            this.currentNewFollowPage = newPage;
            this.displayNewFollow();
        }
    }

    // View management
    showHomePage() {
        this.hideAllViews();
        document.getElementById('homePage').classList.remove('hidden');
        this.loadHomePage(); // Refresh data
    }

    showSearchResults() {
        this.hideAllViews();
        document.getElementById('searchResults').classList.remove('hidden');
    }

    async showMangaDetails(manga, continueInfo = null, fromPage = null) {
        try {
            // Store continue info for when we navigate back
            this.currentContinueInfo = continueInfo;

            // Add to navigation history if fromPage is specified
            if (fromPage) {
                this.navigationHistory.push(fromPage);
            }

            this.hideAllViews();
            document.getElementById('mangaDetails').classList.remove('hidden');

            // Populate basic manga information
            await this.populateMangaDetails(manga, continueInfo);

            // Find and display available sources
            await this.findMangaSources(manga);
        } catch (error) {
            console.error('Error showing manga details:', error);
            this.showError('Failed to load manga details: ' + error.message);
        }
    }

    showChapterList() {
        this.hideAllViews();
        document.getElementById('chapterList').classList.remove('hidden');
        this.hideLoading();
    }

    showReader(fromPage = 'chapterList') {
        // Add current page to navigation history
        this.navigationHistory.push(fromPage);

        this.hideAllViews();
        document.getElementById('reader').classList.remove('hidden');

        // Initialize navigation menu state
        setTimeout(() => {
            this.updateNavMenuButtonStates();
            this.updateNavMenuVisibility();
        }, 100);
    }

    async populateMangaDetails(manga, continueInfo = null) {
        // Ensure manga object has basic properties
        if (!manga || typeof manga !== 'object') {
            console.error('Invalid manga object:', manga);
            return;
        }

        // Set title
        document.getElementById('mangaDetailsTitle').textContent = manga.title || 'Unknown Title';

        // Set cover image
        const coverImg = document.getElementById('mangaCoverImage');
        if (manga.coverUrl) {
            coverImg.src = manga.coverUrl;
            coverImg.style.display = 'block';
        } else {
            coverImg.style.display = 'none';
        }

        // Set rating
        const ratingElement = document.getElementById('mangaRating');
        const starsElement = document.getElementById('mangaStars');
        if (manga.rating) {
            // Convert to number and validate
            const rating = parseFloat(manga.rating);
            if (!isNaN(rating) && rating > 0) {
                ratingElement.textContent = rating.toFixed(1);
                starsElement.textContent = this.generateStars(rating);
            } else {
                ratingElement.textContent = 'N/A';
                starsElement.textContent = '';
            }
        } else {
            ratingElement.textContent = 'N/A';
            starsElement.textContent = '';
        }

        // Add continue button below rating if there's reading progress
        const ratingContainer = document.querySelector('.manga-rating');

        // Remove any existing continue button
        const existingContinueBtn = ratingContainer.querySelector('.manga-continue-btn');
        if (existingContinueBtn) {
            existingContinueBtn.remove();
        }

        if (continueInfo) {
            const continueBtn = document.createElement('button');
            continueBtn.className = 'manga-continue-btn';
            continueBtn.innerHTML = `
                <span class="continue-icon">📖</span>
                <span class="continue-text">Continue Ch. ${continueInfo.progress.chapterNumber}</span>
                <span class="continue-source">${continueInfo.parserName}</span>
            `;

            continueBtn.addEventListener('click', async () => {
                await this.continueReading(manga, continueInfo);
            });

            ratingContainer.appendChild(continueBtn);
        }

        // Get detailed information from Comick if available (with timeout)
        let detailedInfo = null;
        if (manga.url && manga.url.includes('comick')) {
            try {
                // Add a 10-second timeout to prevent hanging
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), 10000)
                );

                detailedInfo = await Promise.race([
                    window.mangaAPI.getMangaDetails(manga.url),
                    timeoutPromise
                ]);
                console.log('Detailed manga info:', detailedInfo);
            } catch (error) {
                console.error('Failed to get detailed manga info:', error.message);
            }
        }

        // Use detailed info if available, otherwise use basic manga data
        const displayData = detailedInfo || manga;

        // Set description with read more functionality
        this.populateDescription(displayData.description || 'No description available.');

        // Set metadata using detailed info
        document.getElementById('mangaStatus').textContent = this.getStatusText(displayData.status) || 'Unknown';
        document.getElementById('mangaYear').textContent = displayData.year || 'Unknown';
        document.getElementById('mangaCountry').textContent = this.getCountryText(displayData.country) || 'Unknown';

        // Set alternative names
        this.populateAlternativeNames(detailedInfo?.allTitles || [manga.title]);

        // Set genres and categories using detailed info
        this.populateGenresAndCategories(displayData);

        // Set chapter count
        if (detailedInfo?.chapterCount) {
            document.getElementById('mangaChapterCount').textContent = detailedInfo.chapterCount;
        } else {
            document.getElementById('mangaChapterCount').textContent = 'Loading...';
        }
    }

    generateStars(rating) {
        const fullStars = Math.floor(rating / 2);
        const halfStar = (rating % 2) >= 1;
        const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

        return '★'.repeat(fullStars) + (halfStar ? '☆' : '') + '☆'.repeat(emptyStars);
    }

    getStatusText(status) {
        const statusMap = {
            1: 'Ongoing',
            2: 'Completed',
            3: 'Cancelled',
            4: 'Hiatus'
        };
        return statusMap[status] || status;
    }

    getCountryText(country) {
        const countryMap = {
            'jp': 'Japan',
            'kr': 'Korea',
            'cn': 'China'
        };
        return countryMap[country] || country;
    }

    populateAlternativeNames(titles) {
        const container = document.getElementById('mangaAltNames');
        container.innerHTML = '';

        if (titles && titles.length > 0) {
            titles.forEach(title => {
                const tag = document.createElement('span');
                tag.className = 'alt-name-tag';
                tag.textContent = title;
                container.appendChild(tag);
            });
        } else {
            container.innerHTML = '<span class="alt-name-tag">No alternative names</span>';
        }
    }

    populateDescription(description) {
        const descriptionElement = document.getElementById('mangaDescription');

        if (!description || description === 'No description available.') {
            descriptionElement.textContent = 'No description available.';
            return;
        }

        // Always show the full description
        descriptionElement.textContent = description;
    }

    populateGenresAndCategories(manga) {
        const genresContainer = document.getElementById('mangaGenres');
        const categoriesContainer = document.getElementById('mangaCategories');

        // Clear containers
        genresContainer.innerHTML = '';
        categoriesContainer.innerHTML = '';

        // Populate genres
        if (manga.genres && manga.genres.length > 0) {
            manga.genres.forEach(genre => {
                const tag = document.createElement('span');
                tag.className = 'tag-item';
                tag.textContent = genre;
                genresContainer.appendChild(tag);
            });
        } else {
            genresContainer.innerHTML = '<span class="tag-item">No genres available</span>';
        }

        // Populate categories/tags
        if (manga.tags && manga.tags.length > 0) {
            manga.tags.forEach(tag => {
                const tagElement = document.createElement('span');
                tagElement.className = 'tag-item';
                tagElement.textContent = tag;
                categoriesContainer.appendChild(tagElement);
            });
        } else {
            categoriesContainer.innerHTML = '<span class="tag-item">No categories available</span>';
        }
    }

    async findMangaSources(manga) {
        const sourcesContainer = document.getElementById('mangaSources');
        sourcesContainer.innerHTML = '<div class="loading-message">🔍 Finding available sources...</div>';

        try {
            // Use multiple search strategies to find sources
            let sources = [];

            // Strategy 1: Use existing findMangaSources with title and URL
            if (manga.url) {
                sources = await window.mangaAPI.findMangaSources(manga.title, manga.url);
            }

            // Strategy 2: If no sources found or no URL, try with just title
            if (sources.length === 0) {
                console.log('Trying source search with title only...');
                sources = await window.mangaAPI.findMangaSources(manga.title);
            }

            // Strategy 3: If still no sources, try with alternative titles if available
            if (sources.length === 0 && manga.alternativeTitles && manga.alternativeTitles.length > 0) {
                console.log('Trying with alternative titles...');
                for (const altTitle of manga.alternativeTitles.slice(0, 3)) { // Try first 3 alt titles
                    const altSources = await window.mangaAPI.findMangaSources(altTitle);
                    if (altSources.length > 0) {
                        sources = altSources;
                        break;
                    }
                }
            }

            if (sources.length === 0) {
                sourcesContainer.innerHTML = '<div class="loading-message">❌ No sources found for this manga. Try searching for it manually.</div>';
                return;
            }

            sourcesContainer.innerHTML = '';

            // Group sources by parser name (like the old version)
            const groupedSources = {};
            sources.forEach(source => {
                const parserName = source.parserName || source.source;
                if (!groupedSources[parserName]) {
                    groupedSources[parserName] = [];
                }
                groupedSources[parserName].push(source);
            });

            // Create cards for each source group
            Object.entries(groupedSources).forEach(([parserName, sourceList]) => {
                const bestMatch = sourceList[0]; // Take the first/best match
                const card = this.createSourceCard(manga, bestMatch, parserName);
                sourcesContainer.appendChild(card);
            });

        } catch (error) {
            console.error('Failed to find manga sources:', error);
            sourcesContainer.innerHTML = '<div class="loading-message">❌ Failed to find sources</div>';
        } finally {
            this.hideLoading();
        }
    }

    createSourceCard(manga, source, parserName) {
        const card = document.createElement('div');
        card.className = 'source-card';

        card.innerHTML = `
            <div class="source-name">${parserName}</div>
            <div class="source-url">${source.url}</div>
            <div class="source-chapters">Chapters: <span class="chapter-count">Checking...</span></div>
            <div class="source-status checking">Checking</div>
        `;

        // Add click handler
        card.addEventListener('click', () => {
            if (!card.classList.contains('loading')) {
                this.selectMangaFromSource(manga, source);
            }
        });

        // Check chapter count asynchronously
        this.checkSourceChapters(card, source, parserName);

        return card;
    }

    async checkSourceChapters(card, source, parserName) {
        try {
            const chapters = await window.mangaAPI.getChapters(source.url, parserName);

            const chapterCountElement = card.querySelector('.chapter-count');
            const statusElement = card.querySelector('.source-status');

            if (chapters.length > 0) {
                chapterCountElement.textContent = chapters.length;
                statusElement.textContent = 'Available';
                statusElement.className = 'source-status available';

                // Update the main chapter count if this is the first successful source
                const mainChapterCount = document.getElementById('mangaChapterCount');
                if (mainChapterCount.textContent === 'Loading...') {
                    mainChapterCount.textContent = chapters.length;
                }
            } else {
                chapterCountElement.textContent = '0';
                statusElement.textContent = 'No Chapters';
                statusElement.className = 'source-status unavailable';
                card.classList.add('loading'); // Disable clicking
            }
        } catch (error) {
            console.error(`Failed to check chapters for ${parserName}:`, error);

            const chapterCountElement = card.querySelector('.chapter-count');
            const statusElement = card.querySelector('.source-status');

            chapterCountElement.textContent = 'Error';
            statusElement.textContent = 'Unavailable';
            statusElement.className = 'source-status unavailable';
            card.classList.add('loading'); // Disable clicking
        }
    }

    hideAllViews() {
        // Clean up reader-specific listeners when leaving reader
        if (!document.getElementById('reader').classList.contains('hidden')) {
            this.cleanupProgressTracking();
            this.closeReaderNavMenu(); // Close navigation menu
        }

        document.getElementById('homePage').classList.add('hidden');
        document.getElementById('searchResults').classList.add('hidden');
        document.getElementById('mangaDetails').classList.add('hidden');
        document.getElementById('sourceSelection').classList.add('hidden');
        document.getElementById('chapterList').classList.add('hidden');
        document.getElementById('reader').classList.add('hidden');
        document.getElementById('followsPage').classList.add('hidden');
        document.getElementById('notificationsPage').classList.add('hidden');
    }

    cleanupProgressTracking() {
        // Remove scroll listener
        if (this.progressTrackingListener) {
            window.removeEventListener('scroll', this.progressTrackingListener);
            this.progressTrackingListener = null;
        }

        // Remove additional progress tracking listeners
        if (this.visibilityChangeListener) {
            document.removeEventListener('visibilitychange', this.visibilityChangeListener);
            this.visibilityChangeListener = null;
        }

        if (this.windowBlurListener) {
            window.removeEventListener('blur', this.windowBlurListener);
            this.windowBlurListener = null;
        }

        if (this.mouseMoveListener) {
            document.removeEventListener('mousemove', this.mouseMoveListener);
            this.mouseMoveListener = null;
        }

        if (this.keyboardListener) {
            document.removeEventListener('keydown', this.keyboardListener);
            this.keyboardListener = null;
        }

        // Clear periodic interval
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }

        // Remove header visibility listener
        if (this.headerVisibilityListener) {
            window.removeEventListener('scroll', this.headerVisibilityListener);
            this.headerVisibilityListener = null;
        }

        // Close any open dropdowns (removed non-existent closeChapterDropdown call)

        this.chapterMarkedComplete = false;
    }

    toggleReaderNavMenu() {
        const menu = document.getElementById('readerNavMenu');
        const isOpen = menu.classList.contains('open');

        if (isOpen) {
            this.closeReaderNavMenu();
        } else {
            this.openReaderNavMenu();
        }
    }

    openReaderNavMenu() {
        const menu = document.getElementById('readerNavMenu');
        menu.classList.add('open');

        // Update button states based on current chapter
        this.updateNavMenuButtonStates();

        // Add overlay to close menu when clicking outside
        this.addNavMenuOverlay();

        // Add escape key listener
        this.navMenuEscapeListener = (e) => {
            if (e.key === 'Escape') {
                this.closeReaderNavMenu();
            }
        };
        document.addEventListener('keydown', this.navMenuEscapeListener);
    }

    closeReaderNavMenu() {
        const menu = document.getElementById('readerNavMenu');
        menu.classList.remove('open');

        // Remove overlay
        this.removeNavMenuOverlay();

        // Remove escape key listener
        if (this.navMenuEscapeListener) {
            document.removeEventListener('keydown', this.navMenuEscapeListener);
            this.navMenuEscapeListener = null;
        }
    }

    addNavMenuOverlay() {
        // Remove existing overlay if any
        this.removeNavMenuOverlay();

        const overlay = document.createElement('div');
        overlay.className = 'reader-nav-overlay active';
        overlay.id = 'readerNavOverlay';

        overlay.addEventListener('click', () => {
            this.closeReaderNavMenu();
        });

        document.body.appendChild(overlay);
    }

    removeNavMenuOverlay() {
        const overlay = document.getElementById('readerNavOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, 300);
        }
    }

    updateNavMenuButtonStates() {
        if (!this.allChapters || !this.currentChapter) return;

        const currentIndex = this.currentChapter.index || 0;
        const isFirstChapter = currentIndex === 0;
        const isLastChapter = currentIndex >= (this.allChapters.length - 1);

        // Update button states
        const prevBtn = document.getElementById('navPrevChapterBtn');
        const nextBtn = document.getElementById('navNextChapterBtn');

        if (prevBtn) {
            prevBtn.disabled = isFirstChapter;
        }

        if (nextBtn) {
            nextBtn.disabled = isLastChapter;
        }
    }

    async navigateFromReaderMenu(action) {
        // Save progress before navigation
        this.updateReadingProgressFromScroll();
        console.log('💾 Progress saved before menu navigation');

        // Close menu first
        this.closeReaderNavMenu();

        // Add small delay for smooth animation
        await new Promise(resolve => setTimeout(resolve, 200));

        switch (action) {
            case 'home':
                this.showHomePage();
                break;

            case 'prevChapter':
                if (this.allChapters && this.currentChapter) {
                    const currentIndex = this.currentChapter.index || 0;
                    if (currentIndex > 0) {
                        await this.previousChapter();
                    }
                }
                break;

            case 'chapterList':
                if (this.currentManga && this.allChapters) {
                    this.showChapterList();
                }
                break;

            case 'nextChapter':
                if (this.allChapters && this.currentChapter) {
                    const currentIndex = this.currentChapter.index || 0;
                    if (currentIndex < (this.allChapters.length - 1)) {
                        await this.nextChapter();
                    }
                }
                break;

            default:
                console.warn('Unknown navigation action:', action);
        }
    }

    goBack() {
        // If we have navigation history, go to the last page
        if (this.navigationHistory.length > 0) {
            const previousPage = this.navigationHistory.pop();

            switch (previousPage) {
                case 'home':
                    this.showHomePage();
                    break;
                case 'search':
                    this.showSearchResults();
                    break;
                case 'follows':
                    this.showFollowsPage();
                    break;
                case 'notifications':
                    this.showNotificationsPage();
                    break;
                default:
                    // Fallback to home if unknown page
                    this.showHomePage();
                    break;
            }
        } else {
            // No history, default to home page
            this.showHomePage();
        }
    }

    goBackFromReader() {
        // Save progress before leaving reader
        this.updateReadingProgressFromScroll();
        console.log('💾 Progress saved before leaving reader');

        // Go back from reader - should go to chapter list or manga details
        if (this.navigationHistory.length > 0) {
            const previousPage = this.navigationHistory.pop();

            switch (previousPage) {
                case 'chapterList':
                    this.showChapterList();
                    break;
                case 'mangaDetails':
                    this.showMangaDetails(this.currentManga, this.currentContinueInfo);
                    break;
                case 'home':
                    this.showHomePage();
                    break;
                case 'search':
                    this.showSearchResults();
                    break;
                case 'follows':
                    this.showFollowsPage();
                    break;
                case 'notifications':
                    this.showNotificationsPage();
                    break;
                default:
                    // Fallback to chapter list if we have current manga, otherwise home
                    if (this.currentManga && this.allChapters) {
                        this.showChapterList();
                    } else {
                        this.showHomePage();
                    }
                    break;
            }
        } else {
            // No history, try to go to chapter list if we have current manga, otherwise home
            if (this.currentManga && this.allChapters) {
                this.showChapterList();
            } else {
                this.showHomePage();
            }
        }
    }

    showSourceSelection() {
        this.hideAllViews();
        document.getElementById('sourceSelection').classList.remove('hidden');
    }

    async displaySourceSelection(manga, sources) {
        document.getElementById('sourceSelectionTitle').textContent = manga.title;

        const sourcesGrid = document.getElementById('sourcesGrid');
        sourcesGrid.innerHTML = '';

        // Check for reading progress across all sources
        let continueInfo = null;
        for (const source of sources) {
            try {
                const progress = await window.mangaAPI.getReadingProgress(manga.id, source.parserName || source.source);
                if (progress && progress.chapterNumber) {
                    continueInfo = {
                        source: source,
                        progress: progress,
                        parserName: source.parserName || source.source
                    };
                    break; // Use the first source with progress
                }
            } catch (error) {
                // Continue checking other sources
            }
        }

        // Add continue button if user has reading progress
        if (continueInfo) {
            const continueBtn = document.createElement('div');
            continueBtn.className = 'continue-reading-btn';
            continueBtn.innerHTML = `
                <div class="continue-icon">📖</div>
                <div class="continue-text">
                    <div class="continue-title">Continue Reading</div>
                    <div class="continue-details">Chapter ${continueInfo.progress.chapterNumber} • ${continueInfo.parserName}</div>
                </div>
            `;

            continueBtn.addEventListener('click', () => this.continueReading(manga, continueInfo));
            sourcesGrid.appendChild(continueBtn);
        }

        if (sources.length === 0) {
            sourcesGrid.innerHTML += '<p>No sources found for this manga. Try searching manually.</p>';
        } else {
            // Group sources by parser name
            const groupedSources = {};
            sources.forEach(source => {
                const parserName = source.parserName || source.source;
                if (!groupedSources[parserName]) {
                    groupedSources[parserName] = [];
                }
                groupedSources[parserName].push(source);
            });

            // Create cards for each source group
            Object.entries(groupedSources).forEach(([parserName, sourceList]) => {
                const bestMatch = sourceList[0]; // Take the first/best match
                const card = this.createSourceCard(manga, bestMatch, parserName);
                sourcesGrid.appendChild(card);
            });
        }

        this.showSourceSelection();
    }

    createSourceCard(originalManga, source, parserName) {
        const card = document.createElement('div');
        card.className = 'source-card';

        card.innerHTML = `
            <div class="source-card-header">
                <div class="source-name">${parserName}</div>
                <div class="source-chapters">Available</div>
            </div>
            <div class="source-manga-title">${source.title}</div>
            <div class="source-manga-description">${source.description || 'No description available'}</div>
        `;

        card.addEventListener('click', () => this.selectMangaFromSource(originalManga, source));
        return card;
    }

    async continueReading(manga, continueInfo) {
        try {
            this.showLoading('Loading chapter...');

            // Set current manga and source
            this.currentManga = manga;
            this.currentSource = continueInfo.source;

            // Get chapters for this source
            const chapters = await window.mangaAPI.getChapters(continueInfo.source.url, continueInfo.parserName);

            // Sort chapters by number (ascending - Chapter 1 first) and add indexes
            const sortedChapters = [...chapters].sort((a, b) => {
                const numA = parseFloat(a.number) || 0;
                const numB = parseFloat(b.number) || 0;
                return numA - numB;
            });

            // Add index to all chapters for navigation
            sortedChapters.forEach((chapter, index) => {
                chapter.index = index;
            });

            // IMPORTANT: Set allChapters for navigation
            this.allChapters = sortedChapters;

            // Find the chapter to continue from using improved matching
            const targetChapterNumber = parseFloat(continueInfo.progress.chapterNumber);
            let targetChapter = null;

            // Try multiple matching strategies
            // 1. Exact number match
            targetChapter = sortedChapters.find(ch => parseFloat(ch.number) === targetChapterNumber);

            // 2. If not found, try title matching
            if (!targetChapter) {
                const searchTerms = [
                    `Chapter ${targetChapterNumber}`,
                    `Ch. ${targetChapterNumber}`,
                    `Ch ${targetChapterNumber}`,
                    targetChapterNumber.toString()
                ];

                for (const term of searchTerms) {
                    targetChapter = sortedChapters.find(ch =>
                        ch.title && ch.title.toLowerCase().includes(term.toLowerCase())
                    );
                    if (targetChapter) break;
                }
            }

            // 3. If still not found, try finding chapters that contain the number
            if (!targetChapter) {
                targetChapter = sortedChapters.find(ch => {
                    const chapterNum = parseFloat(ch.number);
                    return Math.abs(chapterNum - targetChapterNumber) < 0.1; // Allow small differences
                });
            }

            // 4. If still not found, find the closest available chapter
            if (!targetChapter && sortedChapters.length > 0) {
                targetChapter = sortedChapters.reduce((closest, current) => {
                    const closestDiff = Math.abs(parseFloat(closest.number) - targetChapterNumber);
                    const currentDiff = Math.abs(parseFloat(current.number) - targetChapterNumber);
                    return currentDiff < closestDiff ? current : closest;
                });
            }

            if (targetChapter) {
                // Load the chapter directly
                this.currentChapter = targetChapter;
                const pages = await window.mangaAPI.getPages(targetChapter.url, continueInfo.parserName);
                this.currentPages = pages;
                this.currentPageIndex = continueInfo.progress.pageNumber || 0;

                await this.displayReader();

                // Show appropriate message
                if (parseFloat(targetChapter.number) === targetChapterNumber) {
                    this.showSuccess(`Continuing from Chapter ${continueInfo.progress.chapterNumber}`);
                } else {
                    this.showSuccess(`Chapter ${continueInfo.progress.chapterNumber} not available. Starting from Chapter ${targetChapter.number} instead.`);
                }
            } else {
                // Fallback to chapter list if no chapters found
                this.displayChapterList(sortedChapters);
                this.showError(`No suitable chapter found. Please select a chapter manually.`);
            }
        } catch (error) {
            this.showError('Failed to continue reading: ' + error.message);
        }
    }

    // Override selectManga to show manga details page
    async selectManga(manga) {
        this.showLoading('Loading manga details...');
        this.currentManga = manga;

        // Safety timeout to ensure loading is always hidden (15 seconds max)
        const safetyTimeout = setTimeout(() => {
            console.warn('selectManga took too long, hiding loading indicator');
            this.hideLoading();
        }, 15000);

        // Detect which page we're coming from
        let fromPage = 'home'; // default
        if (!document.getElementById('homePage').classList.contains('hidden')) {
            fromPage = 'home';
        } else if (!document.getElementById('searchResults').classList.contains('hidden')) {
            fromPage = 'search';
        } else if (!document.getElementById('followsPage').classList.contains('hidden')) {
            fromPage = 'follows';
        } else if (!document.getElementById('notificationsPage').classList.contains('hidden')) {
            fromPage = 'notifications';
        }

        // Check for reading progress first, then pass it to showMangaDetails
        let continueInfo = null;

        try {
            // If this is an imported manga without cover, try to fetch it
            if (!manga.coverUrl && manga.source === 'Comick' && manga.id) {
                try {
                    console.log('Fetching cover for imported manga:', manga.title);
                    const searchResults = await window.mangaAPI.searchBySource(manga.title, 'Comick');

                    if (searchResults.length > 0) {
                        const bestMatch = searchResults.find(result =>
                            result.id === manga.id ||
                            result.title.toLowerCase() === manga.title.toLowerCase()
                        ) || searchResults[0];

                        if (bestMatch && bestMatch.coverUrl) {
                            // Update the manga with cover URL
                            manga.coverUrl = bestMatch.coverUrl;

                            // Update in storage
                            await window.mangaAPI.updateFollowCoverUrl(manga.id, manga.source, bestMatch.coverUrl);

                            // Update the current manga object
                            this.currentManga.coverUrl = bestMatch.coverUrl;

                            console.log('Cover fetched and updated for:', manga.title);
                        }
                    }
                } catch (error) {
                    console.error('Failed to fetch cover for imported manga:', error);
                }
            }

            // Find sources for this manga
            const sources = await window.mangaAPI.findMangaSources(manga.title, manga.url);

            console.log('DEBUG: Checking progress for manga:', manga);
            console.log('DEBUG: Found sources:', sources);

            // Check for reading progress across all sources
            // First, try with the current manga ID
            for (const source of sources) {
                const sourceName = source.parserName || source.source;
                console.log(`DEBUG: Checking progress for manga ID "${manga.id}" with source "${sourceName}"`);

                try {
                    const progress = await window.mangaAPI.getReadingProgress(manga.id, sourceName);
                    console.log(`DEBUG: Progress for ${sourceName}:`, progress);

                    if (progress && progress.chapterNumber) {
                        continueInfo = {
                            source: source,
                            progress: progress,
                            parserName: sourceName
                        };
                        console.log('DEBUG: Found continue info:', continueInfo);
                        break;
                    }
                } catch (error) {
                    console.log(`DEBUG: Error checking progress for ${sourceName}:`, error);
                }
            }

            // If no progress found with current ID, try with each source's manga ID
            if (!continueInfo) {
                console.log('DEBUG: No progress with current ID, trying source-specific IDs...');
                for (const source of sources) {
                    const sourceName = source.parserName || source.source;
                    const sourceId = source.id || source.slug;

                    if (sourceId && sourceId !== manga.id) {
                        console.log(`DEBUG: Checking progress for source ID "${sourceId}" with source "${sourceName}"`);

                        try {
                            const progress = await window.mangaAPI.getReadingProgress(sourceId, sourceName);
                            console.log(`DEBUG: Progress for ${sourceName} with source ID:`, progress);

                            if (progress && progress.chapterNumber) {
                                continueInfo = {
                                    source: source,
                                    progress: progress,
                                    parserName: sourceName
                                };
                                console.log('DEBUG: Found continue info with source ID:', continueInfo);
                                break;
                            }
                        } catch (error) {
                            console.log(`DEBUG: Error checking progress for source ID ${sourceId}:`, error);
                        }
                    }
                }
            }

            // Fallback: Check if manga has lastChapter info (from Last Read)
            if (!continueInfo && manga.lastChapter && manga.lastChapter.source) {
                console.log('DEBUG: Using lastChapter as fallback:', manga.lastChapter);

                // Find the source that matches the lastChapter source
                const matchingSource = sources.find(s =>
                    (s.parserName || s.source) === manga.lastChapter.source
                );

                if (matchingSource) {
                    continueInfo = {
                        source: matchingSource,
                        progress: {
                            chapterNumber: manga.lastChapter.number,
                            pageNumber: 1 // Default to first page
                        },
                        parserName: manga.lastChapter.source
                    };
                    console.log('DEBUG: Created continue info from lastChapter:', continueInfo);
                }
            }

        } catch (error) {
            console.error('Failed to check reading progress:', error);
        }

        try {
            // Show manga details page with continue info (if any)
            await this.showMangaDetails(manga, continueInfo, fromPage);
        } catch (error) {
            console.error('Error in selectManga:', error);
            this.showError('Failed to load manga details: ' + error.message);
        } finally {
            // Always clear safety timeout
            clearTimeout(safetyTimeout);
        }
    }

    showContinueDialog(manga, continueInfo, sources) {
        // Remove any existing dialogs
        const existingDialog = document.querySelector('.continue-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }

        const dialog = document.createElement('div');
        dialog.className = 'continue-dialog';
        dialog.innerHTML = `
            <div class="continue-dialog-content">
                <div class="continue-dialog-header">
                    <h3>${manga.title}</h3>
                    <button class="continue-dialog-close">×</button>
                </div>
                <div class="continue-dialog-body">
                    <div class="continue-option">
                        <div class="continue-icon">📖</div>
                        <div class="continue-text">
                            <div class="continue-title">Continue Reading</div>
                            <div class="continue-details">Chapter ${continueInfo.progress.chapterNumber} • ${continueInfo.parserName}</div>
                        </div>
                    </div>
                    <div class="continue-actions">
                        <button class="continue-btn" data-action="continue">Continue Reading</button>
                        <button class="browse-btn" data-action="browse">Browse Chapters</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Handle dialog actions
        dialog.addEventListener('click', async (e) => {
            const action = e.target.dataset.action;

            if (action === 'continue') {
                dialog.remove();
                await this.continueReading(manga, continueInfo);
            } else if (action === 'browse') {
                dialog.remove();
                this.displaySourceSelection(manga, sources);
            }
        });

        // Close dialog
        const closeBtn = dialog.querySelector('.continue-dialog-close');
        closeBtn.addEventListener('click', () => {
            dialog.remove();
            this.showHomePage(); // Go back to home
        });

        // Close on outside click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
                this.showHomePage();
            }
        });
    }

    showImportedContinueDialog(manga, sources) {
        // Remove any existing dialogs
        const existingDialog = document.querySelector('.continue-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }

        const dialog = document.createElement('div');
        dialog.className = 'continue-dialog';
        dialog.innerHTML = `
            <div class="continue-dialog-content">
                <div class="continue-dialog-header">
                    <h3>${manga.title}</h3>
                    <button class="continue-dialog-close">×</button>
                </div>
                <div class="continue-dialog-body">
                    <div class="continue-option">
                        <div class="continue-icon">📚</div>
                        <div class="continue-text">
                            <div class="continue-title">Continue from Chapter ${manga.importedReadingProgress.chapterNumber}</div>
                            <div class="continue-details">No source selected yet • Choose a source to continue reading</div>
                        </div>
                    </div>
                    <div class="source-selection-container">
                        <h4>Available Sources:</h4>
                        <div class="source-list">
                            ${sources.map(source => `
                                <div class="source-item" data-source-index="${sources.indexOf(source)}">
                                    <div class="source-info">
                                        <div class="source-name">${source.source}</div>
                                        <div class="source-chapters">${source.chapterCount || 'Unknown'} chapters</div>
                                    </div>
                                    <button class="source-select-btn" data-action="select-source" data-source-index="${sources.indexOf(source)}">
                                        Select & Continue
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="continue-actions">
                        <button class="browse-btn" data-action="browse">Browse All Chapters</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Handle dialog actions
        dialog.addEventListener('click', async (e) => {
            const action = e.target.dataset.action;

            if (action === 'select-source') {
                const sourceIndex = parseInt(e.target.dataset.sourceIndex);
                const selectedSource = sources[sourceIndex];

                dialog.remove();
                await this.continueFromImportedProgress(manga, selectedSource);
            } else if (action === 'browse') {
                dialog.remove();
                this.displaySourceSelection(manga, sources);
            }
        });

        // Close dialog
        const closeBtn = dialog.querySelector('.continue-dialog-close');
        closeBtn.addEventListener('click', () => {
            dialog.remove();
            this.showHomePage(); // Go back to home
        });

        // Close on outside click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
                this.showHomePage();
            }
        });
    }

    async continueFromImportedProgress(manga, source) {
        try {
            this.showLoading('Loading chapters...');

            // Get chapters from the selected source
            const chapters = await window.mangaAPI.getChapters(source.url, source.source);

            if (!chapters || chapters.length === 0) {
                this.showError('No chapters found for this source');
                return;
            }

            // Find the chapter to continue from with flexible matching
            const targetChapter = manga.importedReadingProgress.chapterNumber;
            let chapterToRead = null;

            // Try multiple matching strategies
            // 1. Exact number match
            chapterToRead = chapters.find(ch => parseInt(ch.number) === parseInt(targetChapter));

            // 2. If not found, try title match
            if (!chapterToRead) {
                chapterToRead = chapters.find(ch => parseInt(ch.title) === parseInt(targetChapter));
            }

            // 3. If not found, try string contains match
            if (!chapterToRead) {
                chapterToRead = chapters.find(ch =>
                    ch.number && ch.number.toString().includes(targetChapter.toString())
                );
            }

            // 4. If not found, try closest chapter (within 5 chapters)
            if (!chapterToRead) {
                const targetNum = parseInt(targetChapter);
                chapterToRead = chapters.find(ch => {
                    const chNum = parseInt(ch.number);
                    return Math.abs(chNum - targetNum) <= 5;
                });
            }

            // 5. If still not found, get the closest available chapter
            if (!chapterToRead && chapters.length > 0) {
                const targetNum = parseInt(targetChapter);
                let closestChapter = chapters[0];
                let closestDiff = Math.abs(parseInt(closestChapter.number) - targetNum);

                for (const ch of chapters) {
                    const diff = Math.abs(parseInt(ch.number) - targetNum);
                    if (diff < closestDiff) {
                        closestDiff = diff;
                        closestChapter = ch;
                    }
                }
                chapterToRead = closestChapter;

                // Show a warning that we're using the closest chapter
                if (closestDiff > 0) {
                    this.showSuccess(`Chapter ${targetChapter} not found. Starting from closest chapter ${closestChapter.number}.`);
                }
            }

            // Set up the chapter list first (important for navigation)
            this.allChapters = chapters.map((chapter, index) => ({
                ...chapter,
                index: index
            }));

            if (chapterToRead) {
                // Update the manga with the selected source
                this.currentManga = manga;
                this.currentSource = source;

                // Store reading progress in the new format (starting position)
                await window.mangaAPI.updateReadingProgress(
                    source.id || source.slug,
                    source.source,
                    targetChapter,
                    1, // page number
                    0, // scroll position (start)
                    1  // total pages (will be updated when chapter loads)
                );

                // Add to last read
                await window.mangaAPI.addToLastRead(manga, {
                    number: targetChapter,
                    source: source.source
                });

                // Find the chapter index for proper navigation
                const chapterIndex = this.allChapters.findIndex(ch => ch.url === chapterToRead.url);
                if (chapterIndex !== -1) {
                    chapterToRead.index = chapterIndex;
                }

                // Read the chapter (coming from follows page)
                await this.readChapter(chapterToRead, 'follows');
            } else {
                // Chapter not found, show chapter list instead
                this.showError(`Chapter ${targetChapter} not found. Showing all chapters.`);
                this.displayChapterList(chapters);
            }
        } catch (error) {
            this.showError('Failed to continue reading: ' + error.message);
            this.hideLoading();
        }
    }

    async continueFromLastRead(manga) {
        try {
            if (!manga.lastChapter || !manga.lastChapter.source) {
                this.showError('No reading progress found for this manga');
                return;
            }

            this.showLoading('Finding sources...');

            // Find sources for this manga
            const sources = await window.mangaAPI.findMangaSources(manga.title, manga.url);

            if (!sources || sources.length === 0) {
                this.showError('No sources found for this manga');
                return;
            }

            // Find the source that matches the lastChapter source
            const matchingSource = sources.find(s =>
                (s.parserName || s.source) === manga.lastChapter.source
            );

            if (matchingSource) {
                // Continue directly with the known source
                // Note: continueFromKnownSource will handle its own loading state
                await this.continueFromKnownSource(manga, matchingSource);
            } else {
                // Source not found, show source selection
                this.hideLoading(); // Hide loading before showing dialog
                this.showSourceSelectionForLastRead(manga, sources);
            }
        } catch (error) {
            this.showError('Failed to continue reading: ' + error.message);
        }
    }

    async continueFromKnownSource(manga, source) {
        try {
            this.showLoading('Loading chapters...');

            // Get chapters from the source
            const chapters = await window.mangaAPI.getChapters(source.url, source.source);

            if (!chapters || chapters.length === 0) {
                this.showError('No chapters found for this source');
                return;
            }

            // Set up the chapter list first (important for navigation)
            this.allChapters = chapters.map((chapter, index) => ({
                ...chapter,
                index: index
            }));

            // Find the chapter to continue from with flexible matching
            const targetChapter = manga.lastChapter.number;
            let chapterToRead = null;

            // Try multiple matching strategies
            // 1. Exact number match
            chapterToRead = chapters.find(ch => parseInt(ch.number) === parseInt(targetChapter));

            // 2. If not found, try title match
            if (!chapterToRead) {
                chapterToRead = chapters.find(ch => parseInt(ch.title) === parseInt(targetChapter));
            }

            // 3. If not found, try string contains match
            if (!chapterToRead) {
                chapterToRead = chapters.find(ch =>
                    ch.number && ch.number.toString().includes(targetChapter.toString())
                );
            }

            // 4. If not found, try closest chapter (within 5 chapters)
            if (!chapterToRead) {
                const targetNum = parseInt(targetChapter);
                chapterToRead = chapters.find(ch => {
                    const chNum = parseInt(ch.number);
                    return Math.abs(chNum - targetNum) <= 5;
                });
            }

            // 5. If still not found, get the closest available chapter
            if (!chapterToRead && chapters.length > 0) {
                const targetNum = parseInt(targetChapter);
                let closestChapter = chapters[0];
                let closestDiff = Math.abs(parseInt(closestChapter.number) - targetNum);

                for (const ch of chapters) {
                    const diff = Math.abs(parseInt(ch.number) - targetNum);
                    if (diff < closestDiff) {
                        closestDiff = diff;
                        closestChapter = ch;
                    }
                }
                chapterToRead = closestChapter;

                // Show a warning that we're using the closest chapter
                if (closestDiff > 0) {
                    this.showSuccess(`Chapter ${targetChapter} not found. Starting from closest chapter ${closestChapter.number}.`);
                }
            }

            if (chapterToRead) {
                // Update the manga with the selected source
                this.currentManga = manga;
                this.currentSource = source;

                // Find the chapter index for proper navigation
                const chapterIndex = this.allChapters.findIndex(ch => ch.url === chapterToRead.url);
                if (chapterIndex !== -1) {
                    chapterToRead.index = chapterIndex;
                }

                // Read the chapter (coming from home page last read)
                await this.readChapter(chapterToRead, 'home');
            } else {
                // This should rarely happen now, but just in case
                this.showError(`No suitable chapter found. Showing all chapters.`);
                this.displayChapterList(chapters);
            }
        } catch (error) {
            this.showError('Failed to continue reading: ' + error.message);
            this.hideLoading();
        }
    }

    showSourceSelectionForLastRead(manga, sources) {
        // Remove any existing dialogs
        const existingDialog = document.querySelector('.continue-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }

        const dialog = document.createElement('div');
        dialog.className = 'continue-dialog';
        dialog.innerHTML = `
            <div class="continue-dialog-content">
                <div class="continue-dialog-header">
                    <h3>${manga.title}</h3>
                    <button class="continue-dialog-close">×</button>
                </div>
                <div class="continue-dialog-body">
                    <div class="continue-option">
                        <div class="continue-icon">📚</div>
                        <div class="continue-text">
                            <div class="continue-title">Continue from Chapter ${manga.lastChapter.number}</div>
                            <div class="continue-details">Original source not available • Choose a new source</div>
                        </div>
                    </div>
                    <div class="source-selection-container">
                        <h4>Available Sources:</h4>
                        <div class="source-list">
                            ${sources.map((source, index) => `
                                <div class="source-item" data-source-index="${index}">
                                    <div class="source-info">
                                        <div class="source-name">${source.source}</div>
                                        <div class="source-chapters">Available for reading</div>
                                    </div>
                                    <button class="source-select-btn" data-action="select-source" data-source-index="${index}">
                                        Continue Here
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Handle dialog actions
        dialog.addEventListener('click', async (e) => {
            const action = e.target.dataset.action;

            if (action === 'select-source') {
                const sourceIndex = parseInt(e.target.dataset.sourceIndex);
                const selectedSource = sources[sourceIndex];

                dialog.remove();
                await this.continueFromKnownSource(manga, selectedSource);
            }
        });

        // Close dialog
        const closeBtn = dialog.querySelector('.continue-dialog-close');
        closeBtn.addEventListener('click', () => {
            dialog.remove();
        });

        // Close on outside click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
    }

    showContinueOrBrowseDialog(followedManga, progress) {
        // Remove any existing dialogs
        const existingDialog = document.querySelector('.continue-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }

        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'continue-dialog';

        const isImported = progress && progress.isImported;
        const hasNoSource = !followedManga.source || followedManga.source === 'Unknown';

        let progressText, lastReadInfo, continueButtonText;

        if (isImported || hasNoSource) {
            // Imported manga or manga without source - need source selection first
            progressText = progress
                ? `Continue from Chapter ${progress.chapterNumber}`
                : 'Start Reading';
            lastReadInfo = progress
                ? `<p class="continue-info">Last read: Chapter ${progress.chapterNumber} (Source needed)</p>`
                : `<p class="continue-info">No source selected yet</p>`;
            continueButtonText = 'Select Source to Continue';
        } else {
            // Regular manga with source
            progressText = progress
                ? `Continue from Chapter ${progress.chapterNumber}`
                : 'Start Reading';
            lastReadInfo = progress
                ? `<p class="continue-info">Last read: Chapter ${progress.chapterNumber}</p>`
                : `<p class="continue-info">Not started yet</p>`;
            continueButtonText = progressText;
        }

        dialog.innerHTML = `
            <div class="continue-content">
                <h3>Found in Following</h3>
                <div class="continue-manga-info">
                    ${followedManga.coverUrl ? `<img src="${followedManga.coverUrl}" alt="${followedManga.title}" class="continue-cover">` : ''}
                    <div class="continue-details">
                        <h4>${followedManga.title}</h4>
                        <p class="continue-source">Source: ${followedManga.source}</p>
                        ${lastReadInfo}
                    </div>
                </div>
                <div class="continue-buttons">
                    <button class="continue-btn primary" id="continueReading">${continueButtonText}</button>
                    <button class="continue-btn secondary" id="browseSources">Browse Sources</button>
                    <button class="continue-btn cancel" id="cancelContinue">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Add event listeners
        document.getElementById('continueReading').addEventListener('click', async () => {
            dialog.remove();

            if (isImported || hasNoSource) {
                // For imported manga or manga without source, show source selection first
                await this.showSourceSelectionForImported(followedManga, progress);
            } else if (progress && !progress.isImported) {
                // Continue reading from last chapter (regular manga with source)
                const continueInfo = {
                    source: { url: followedManga.url },
                    parserName: followedManga.source,
                    progress: { chapterNumber: progress.chapterNumber }
                };

                await this.continueReading(followedManga, continueInfo);
            } else {
                // Start reading from beginning (regular manga with source)
                this.currentManga = followedManga;
                this.currentSource = followedManga.source;

                try {
                    const chapters = await window.mangaAPI.getChapters(followedManga.url, followedManga.source);
                    if (chapters.length > 0) {
                        await this.readChapter(chapters[0], 'follows'); // Start from first chapter
                    } else {
                        this.showError('No chapters found for this manga');
                    }
                } catch (error) {
                    this.showError('Failed to load chapters: ' + error.message);
                }
            }
        });

        document.getElementById('browseSources').addEventListener('click', () => {
            dialog.remove();
            // Continue with normal source selection process
            this.continueWithSourceSelection(this.currentManga);
        });

        document.getElementById('cancelContinue').addEventListener('click', () => {
            dialog.remove();
        });

        // Close on background click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
    }

    async showSourceSelectionForImported(followedManga, progress) {
        // Show source selection specifically for imported manga
        this.showLoading('Finding sources...');

        try {
            const sources = await window.mangaAPI.findMangaSources(followedManga.title, followedManga.url);

            if (sources.length === 0) {
                this.showError('No sources found for this manga');
                return;
            }

            // Create source selection dialog for imported manga
            this.hideLoading(); // Hide loading before showing dialog
            this.showImportedSourceDialog(followedManga, sources, progress);
        } catch (error) {
            this.showError('Failed to find sources: ' + error.message);
        }
    }

    showImportedSourceDialog(manga, sources, progress) {
        // Remove any existing dialogs
        const existingDialog = document.querySelector('.continue-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }

        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'continue-dialog';

        const progressInfo = progress
            ? `Continue from Chapter ${progress.chapterNumber}`
            : 'Start Reading';

        dialog.innerHTML = `
            <div class="continue-content">
                <h3>Select Source for ${manga.title}</h3>
                <p class="continue-info">${progressInfo}</p>
                <div class="source-list">
                    ${sources.map(source => `
                        <button class="source-btn" data-source="${source.parserName || source.source}">
                            <strong>${source.parserName || source.source}</strong>
                            <span>Click to continue reading</span>
                        </button>
                    `).join('')}
                </div>
                <div class="continue-buttons">
                    <button class="continue-btn cancel" id="cancelSourceSelection">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Add event listeners for source buttons
        dialog.querySelectorAll('.source-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const sourceName = btn.dataset.source;
                dialog.remove();

                if (progress) {
                    await this.continueFromImportedProgress(manga, sourceName, progress.chapterNumber);
                } else {
                    // Start from beginning
                    this.currentManga = manga;
                    this.currentSource = sourceName;

                    try {
                        const chapters = await window.mangaAPI.getChapters(manga.url, sourceName);
                        if (chapters.length > 0) {
                            await this.readChapter(chapters[0], 'mangaDetails');
                        } else {
                            this.showError('No chapters found for this manga');
                        }
                    } catch (error) {
                        this.showError('Failed to load chapters: ' + error.message);
                    }
                }
            });
        });

        // Cancel button
        document.getElementById('cancelSourceSelection').addEventListener('click', () => {
            dialog.remove();
        });

        // Close on background click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
    }

    async continueWithSourceSelection(manga) {
        // This continues the normal selectManga flow for source selection
        this.showLoading('Finding sources...');

        try {
            const sources = await window.mangaAPI.findMangaSources(manga.title, manga.url);

            if (sources.length === 0) {
                this.showError('No sources found for this manga');
                return;
            }

            this.hideLoading(); // Hide loading before showing source selection
            this.showSourceSelection();
            this.displaySources(sources, manga);
        } catch (error) {
            this.showError('Failed to find sources: ' + error.message);
        }
    }

    async selectMangaFromSource(manga, source) {
        this.currentManga = manga;
        this.currentSource = source.parserName;
        this.showLoading('Loading chapters...');

        try {
            const chapters = await window.mangaAPI.getChapters(source.url, source.parserName);

            // Add to last read
            await window.mangaAPI.addToLastRead(manga);

            this.displayChapterList(chapters);
        } catch (error) {
            this.showError('Failed to load chapters: ' + error.message);
            this.hideLoading();
        }
    }

    // 3-dot menu functionality
    showMangaMenu(event, manga, cardElement, isLastRead = false) {
        // Remove any existing dropdown
        document.querySelectorAll('.manga-dropdown').forEach(d => d.remove());

        const dropdown = document.createElement('div');
        dropdown.className = 'manga-dropdown';

        const followOption = document.createElement('div');
        followOption.className = 'manga-dropdown-item';
        followOption.textContent = '📚 Follow';
        followOption.addEventListener('click', () => {
            dropdown.remove();
            this.followManga(manga);
        });

        const removeOption = document.createElement('div');
        removeOption.className = 'manga-dropdown-item';
        removeOption.textContent = '🗑️ Remove from History';
        removeOption.addEventListener('click', () => {
            dropdown.remove();
            this.removeFromHistory(manga, cardElement);
        });

        dropdown.appendChild(followOption);
        if (isLastRead) {
            dropdown.appendChild(removeOption);
        }

        // Position dropdown
        const rect = event.target.getBoundingClientRect();
        dropdown.style.position = 'fixed';
        dropdown.style.top = rect.bottom + 'px';
        dropdown.style.left = (rect.left - 100) + 'px';

        document.body.appendChild(dropdown);

        // Close dropdown when clicking outside
        const closeDropdown = (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.remove();
                document.removeEventListener('click', closeDropdown);
            }
        };
        setTimeout(() => document.addEventListener('click', closeDropdown), 0);
    }

    async followManga(manga) {
        try {
            await window.mangaAPI.addToFollows(manga);
            this.showSuccess('Added to following list!');
            this.updateNotificationBadge();
        } catch (error) {
            this.showError('Failed to follow manga: ' + error.message);
        }
    }

    async removeFromHistory(manga, cardElement) {
        try {
            await window.mangaAPI.removeFromHistory(manga.id, manga.source);
            cardElement.remove();
            this.showSuccess('Removed from history!');
        } catch (error) {
            this.showError('Failed to remove from history: ' + error.message);
        }
    }

    // Follows page
    async showFollowsPage() {
        this.hideAllViews();
        document.getElementById('followsPage').classList.remove('hidden');
        await this.loadFollows();
    }

    async loadFollows() {
        try {
            const follows = await window.mangaAPI.getFollows();
            await this.displayFollows(follows);
        } catch (error) {
            this.showError('Failed to load follows: ' + error.message);
        }
    }

    async displayFollows(follows) {
        const grid = document.getElementById('followsGrid');
        grid.innerHTML = '';

        if (follows.length === 0) {
            grid.innerHTML = '<p>No manga being followed yet. Use the 3-dot menu on any manga to follow it!</p>';
            return;
        }

        // First, display all follows (even without cover images)
        // Process cards sequentially to handle async createFollowCard
        for (const manga of follows) {
            const card = await this.createFollowCard(manga);
            grid.appendChild(card);
        }

        // Note: Cover images for imported manga will be fetched when accessed
    }

    async filterFollows() {
        try {
            const searchTerm = document.getElementById('followsSearchInput').value.toLowerCase();
            const statusFilter = document.getElementById('statusFilter').value;

            const follows = await window.mangaAPI.getFollows();

            let filteredFollows = follows;

            // Apply search filter
            if (searchTerm) {
                filteredFollows = filteredFollows.filter(manga =>
                    manga.title.toLowerCase().includes(searchTerm)
                );
            }

            // Apply status filter
            if (statusFilter) {
                filteredFollows = filteredFollows.filter(manga =>
                    (manga.status || 'Reading') === statusFilter
                );
            }

            await this.displayFollows(filteredFollows);
        } catch (error) {
            this.showError('Failed to filter follows: ' + error.message);
        }
    }

    clearFilters() {
        document.getElementById('followsSearchInput').value = '';
        document.getElementById('statusFilter').value = '';
        this.loadFollows(); // Reload all follows
    }

    async createFollowCard(manga) {
        const card = document.createElement('div');
        card.className = 'follow-card';
        card.dataset.mangaId = manga.id; // Add data attribute for tracking

        // Fetch detailed metadata from Comick API if this is a Comick result
        let detailedManga = manga;
        if (manga.source === 'Comick' && manga.id) {
            try {
                const comickDetails = await window.mangaAPI.getMangaDetails(manga.id, 'Comick');
                if (comickDetails) {
                    detailedManga = { ...manga, ...comickDetails };
                }
            } catch (error) {
                console.log('Could not fetch Comick details for', manga.title, ':', error.message);
            }
        }

        const followedDate = new Date(manga.followedAt).toLocaleDateString();
        const lastChecked = new Date(manga.lastCheckedAt).toLocaleDateString();

        // Determine reading progress info from multiple sources
        let progressChapter = null;
        let hasProgress = false;

        // Check imported reading progress first
        if (manga.importedReadingProgress && manga.importedReadingProgress.chapterNumber > 0) {
            progressChapter = manga.importedReadingProgress.chapterNumber;
            hasProgress = true;
        }
        // Check if manga has lastKnownChapter (from CSV or updates)
        else if (manga.lastKnownChapter && manga.lastKnownChapter > 0) {
            progressChapter = manga.lastKnownChapter;
            hasProgress = true;
        }

        // Format metadata for display (same as search results)
        const chapterCount = detailedManga.chapterCount || detailedManga.chapters || manga.lastKnownChapter || 'Unknown';
        const status = detailedManga.status || 'Unknown';
        const year = detailedManga.year || 'Unknown';

        // Format genres (show first 3-4 genres)
        let genresDisplay = '';
        if (detailedManga.genres && detailedManga.genres.length > 0) {
            const displayGenres = detailedManga.genres.slice(0, 4);
            genresDisplay = displayGenres.map(genre => `<span class="genre-tag">${genre}</span>`).join('');
        }

        // Check if content should be filtered (adult content OR unknown metadata)
        const allMetadataUnknown = chapterCount === 'Unknown' && status === 'Unknown' && year === 'Unknown' &&
            (!detailedManga.genres || detailedManga.genres.length === 0);
        const isAdultContent = this.contentFilter.isAdultContent(detailedManga);
        const shouldCensor = (isAdultContent || allMetadataUnknown) && this.contentFilter.isEnabled;

        // Determine the reason for censoring
        let censorReason = 'Adult Content';
        if (allMetadataUnknown && !isAdultContent) {
            censorReason = 'Unknown Content - 18+';
        }

        // Apply content filtering to cover image
        let coverImage = '';
        if (manga.coverUrl) {
            if (shouldCensor) {
                // Create censored image HTML
                coverImage = `
                    <div class="censored-container">
                        <img src="${manga.coverUrl}" alt="${manga.title}" class="follow-cover censored-content">
                        <div class="censor-overlay">
                            <div class="censor-content">
                                <div class="censor-icon">🔞</div>
                                <div class="censor-text">${censorReason}</div>
                                <button class="censor-toggle" onclick="event.stopPropagation(); this.parentElement.parentElement.parentElement.classList.toggle('uncensored'); this.textContent = this.parentElement.parentElement.parentElement.classList.contains('uncensored') ? 'Hide' : 'Click to View'">Click to View</button>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                coverImage = `<img src="${manga.coverUrl}" alt="${manga.title}" class="follow-cover">`;
            }
        } else {
            coverImage = `<div class="follow-cover imported-placeholder" style="background: linear-gradient(135deg, #4CAF50, #45a049); display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; text-align: center; padding: 10px;">
                <div style="font-size: 24px; margin-bottom: 5px;">📚</div>
                <div style="font-size: 10px; font-weight: bold;">IMPORTED</div>
                <div style="font-size: 8px; opacity: 0.8;">Click to load</div>
            </div>`;
        }

        const progressInfo = hasProgress ?
            `<div class="follow-progress">Progress: Chapter ${progressChapter}</div>` :
            `<div class="follow-progress">Progress: Not started</div>`;

        card.innerHTML = `
            ${coverImage}
            <div class="follow-title">${manga.title}</div>
            <div class="follow-info">Source: ${manga.source}</div>
            <div class="manga-metadata">
                <div class="metadata-row">
                    <span class="metadata-label">Chapters:</span>
                    <span class="metadata-value">${chapterCount}</span>
                </div>
                <div class="metadata-row">
                    <span class="metadata-label">Status:</span>
                    <span class="metadata-value">${status}</span>
                </div>
                <div class="metadata-row">
                    <span class="metadata-label">Year:</span>
                    <span class="metadata-value">${year}</span>
                </div>
                ${genresDisplay ? `<div class="manga-genres">${genresDisplay}</div>` : ''}
            </div>
            <div class="follow-status-badge">${manga.status || 'Reading'}</div>
            ${(isAdultContent || allMetadataUnknown) ? '<div class="content-warning">18+</div>' : ''}
            ${progressInfo}
            <div class="follow-status">Followed: ${followedDate}</div>
            <div class="follow-status">Last checked: ${lastChecked}</div>
            ${hasProgress ?
                `<button class="continue-btn" onclick="event.stopPropagation()">📖 Continue Ch. ${progressChapter}</button>` :
                `<button class="start-reading-btn" onclick="event.stopPropagation()">📚 Start Reading</button>`
            }
            <button class="follow-menu" onclick="event.stopPropagation()">⋮</button>
        `;

        card.addEventListener('click', () => this.selectManga(manga));

        // Add button functionality
        const continueBtn = card.querySelector('.continue-btn');
        const startBtn = card.querySelector('.start-reading-btn');

        if (continueBtn) {
            continueBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showContinueFromImported(manga);
            });
        }

        if (startBtn) {
            startBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectManga(manga); // Use regular manga selection for start reading
            });
        }

        // Add menu functionality
        const menuBtn = card.querySelector('.follow-menu');
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showFollowMenu(e, manga, card);
        });

        return card;
    }

    showFollowMenu(event, manga, card) {
        // Remove any existing menus
        const existingMenu = document.querySelector('.follow-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        const menu = document.createElement('div');
        menu.className = 'follow-context-menu';
        menu.innerHTML = `
            <div class="context-menu-header">Change Status</div>
            <div class="context-menu-item" data-action="status" data-status="Reading">
                <span>📖</span> Reading
            </div>
            <div class="context-menu-item" data-action="status" data-status="Completed">
                <span>✅</span> Completed
            </div>
            <div class="context-menu-item" data-action="status" data-status="On-Hold">
                <span>⏸️</span> On-Hold
            </div>
            <div class="context-menu-item" data-action="status" data-status="Dropped">
                <span>❌</span> Dropped
            </div>
            <div class="context-menu-item" data-action="status" data-status="Plan to Read">
                <span>📋</span> Plan to Read
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" data-action="unfollow">
                <span>🚫</span> Remove from Following
            </div>
        `;

        // Position the menu
        const rect = event.target.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = `${rect.bottom + 5}px`;
        menu.style.left = `${rect.left - 150}px`; // Offset to the left
        menu.style.zIndex = '1000';

        document.body.appendChild(menu);

        // Handle menu clicks
        menu.addEventListener('click', async (e) => {
            const menuItem = e.target.closest('.context-menu-item');
            if (!menuItem) return;

            const action = menuItem.dataset.action;

            if (action === 'status') {
                const newStatus = menuItem.dataset.status;
                try {
                    await window.mangaAPI.updateMangaStatus(manga.id, manga.source, newStatus);

                    // Update the card's status display
                    const statusBadge = card.querySelector('.follow-status-badge');
                    if (statusBadge) {
                        statusBadge.textContent = newStatus;
                    }

                    // Show success message
                    this.showSuccess(`Changed "${manga.title}" status to ${newStatus}`);
                } catch (error) {
                    this.showError('Failed to update status: ' + error.message);
                }
            } else if (action === 'unfollow') {
                try {
                    await window.mangaAPI.removeFromFollows(manga.id, manga.source);
                    card.remove();

                    // Show success message
                    this.showSuccess(`Removed "${manga.title}" from following`);

                    // Update notification badge
                    await this.updateNotificationBadge();
                } catch (error) {
                    this.showError('Failed to remove from following: ' + error.message);
                }
            }

            menu.remove();
        });

        // Close menu when clicking outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 10);
    }

    async showContinueFromImported(manga) {
        try {
            this.showLoading('Finding sources...');

            // Find sources for this manga
            const sources = await window.mangaAPI.findMangaSources(manga.title, manga.url);

            if (!sources || sources.length === 0) {
                this.showError('No sources found for this manga');
                return;
            }

            // Show source selection dialog
            this.hideLoading(); // Hide loading before showing dialog
            this.showSourceSelectionForContinue(manga, sources);
        } catch (error) {
            this.showError('Failed to find sources: ' + error.message);
        }
    }

    showSourceSelectionForContinue(manga, sources) {
        // Remove any existing dialogs
        const existingDialog = document.querySelector('.continue-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }

        const dialog = document.createElement('div');
        dialog.className = 'continue-dialog';
        dialog.innerHTML = `
            <div class="continue-dialog-content">
                <div class="continue-dialog-header">
                    <h3>${manga.title}</h3>
                    <button class="continue-dialog-close">×</button>
                </div>
                <div class="continue-dialog-body">
                    <div class="continue-option">
                        <div class="continue-icon">📚</div>
                        <div class="continue-text">
                            <div class="continue-title">Continue from Chapter ${manga.importedReadingProgress.chapterNumber}</div>
                            <div class="continue-details">Choose a source to continue reading</div>
                        </div>
                    </div>
                    <div class="source-selection-container">
                        <h4>Available Sources:</h4>
                        <div class="source-list">
                            ${sources.map((source, index) => `
                                <div class="source-item" data-source-index="${index}">
                                    <div class="source-info">
                                        <div class="source-name">${source.source}</div>
                                        <div class="source-chapters">Available for reading</div>
                                    </div>
                                    <button class="source-select-btn" data-action="select-source" data-source-index="${index}">
                                        Continue Here
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Handle dialog actions
        dialog.addEventListener('click', async (e) => {
            const action = e.target.dataset.action;

            if (action === 'select-source') {
                const sourceIndex = parseInt(e.target.dataset.sourceIndex);
                const selectedSource = sources[sourceIndex];

                dialog.remove();
                await this.continueFromImportedProgress(manga, selectedSource);
            }
        });

        // Close dialog
        const closeBtn = dialog.querySelector('.continue-dialog-close');
        closeBtn.addEventListener('click', () => {
            dialog.remove();
        });

        // Close on outside click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
    }

    // Notifications page
    async showNotificationsPage() {
        this.hideAllViews();
        document.getElementById('notificationsPage').classList.remove('hidden');
        await this.loadNotifications();
    }

    async loadNotifications() {
        try {
            const notifications = await window.mangaAPI.getNotifications();
            this.displayNotifications(notifications);
            this.updateNotificationBadge();
        } catch (error) {
            this.showError('Failed to load notifications: ' + error.message);
        }
    }

    displayNotifications(notifications) {
        const list = document.getElementById('notificationsList');
        list.innerHTML = '';

        if (notifications.length === 0) {
            list.innerHTML = '<p>No notifications yet.</p>';
            return;
        }

        notifications.forEach(notification => {
            const item = this.createNotificationItem(notification);
            list.appendChild(item);
        });
    }

    createNotificationItem(notification) {
        const item = document.createElement('div');
        item.className = `notification-item ${notification.read ? '' : 'unread'}`;

        const createdDate = new Date(notification.createdAt).toLocaleString();

        // Create cover image element
        const coverElement = notification.mangaCover ?
            `<img src="${notification.mangaCover}" alt="${notification.title}" class="notification-cover">` :
            `<div class="notification-cover notification-cover-placeholder">📖</div>`;

        item.innerHTML = `
            <div class="notification-content">
                <button class="notification-close-btn" data-notification-id="${notification.id}">×</button>
                <div class="notification-left">
                    ${coverElement}
                </div>
                <div class="notification-middle">
                    <div class="notification-title clickable-title" data-manga-id="${notification.mangaId}" data-manga-title="${notification.title}">${notification.title}</div>
                    <div class="notification-message">${notification.message}</div>
                    <div class="notification-footer">
                        <span class="notification-time">${createdDate}</span>
                        <span class="notification-source">Source: ${notification.source}</span>
                    </div>
                </div>
                <div class="notification-right">
                    <button class="notification-goto-btn" data-notification-id="${notification.id}">Go To</button>
                </div>
            </div>
        `;

        // Add Go To button functionality
        const gotoBtn = item.querySelector('.notification-goto-btn');
        if (gotoBtn) {
            gotoBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.goToNextChapter(notification);
            });
        }

        // Add close button functionality
        const closeBtn = item.querySelector('.notification-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeNotification(notification.id, item);
            });
        }

        // Add title click functionality to go to manga details
        const titleElement = item.querySelector('.notification-title');
        if (titleElement) {
            titleElement.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.goToMangaDetailsFromNotification(notification);
            });
        }

        // Mark as read when clicked (but not on buttons)
        if (!notification.read) {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('notification-goto-btn') &&
                    !e.target.classList.contains('notification-close-btn')) {
                    this.markNotificationRead(notification.id, item);
                }
            });
        }

        return item;
    }

    async markNotificationRead(notificationId, itemElement) {
        try {
            await window.mangaAPI.markNotificationRead(notificationId);
            itemElement.classList.remove('unread');
            this.updateNotificationBadge();
        } catch (error) {
            this.showError('Failed to mark notification as read: ' + error.message);
        }
    }

    async goToMangaDetailsFromNotification(notification) {
        try {
            this.showLoading('Loading manga details...');

            // Mark notification as read
            await window.mangaAPI.markNotificationRead(notification.id);
            this.updateNotificationBadge();

            // First, try to get the manga from the follows list (which has more complete data)
            let manga = null;
            try {
                const follows = await window.mangaAPI.getFollows();
                const followedManga = follows.find(f =>
                    f.id === notification.mangaId ||
                    f.title.toLowerCase().trim() === notification.title.toLowerCase().trim()
                );

                if (followedManga) {
                    manga = followedManga;
                    console.log('Found manga in follows list with complete data');
                }
            } catch (error) {
                console.log('Could not check follows list:', error.message);
            }

            // If not found in follows, try to search for it to get complete data
            if (!manga) {
                try {
                    console.log('Searching for manga to get complete details...');
                    const searchResults = await window.mangaAPI.searchBySource(notification.title, 'Comick', 1, 20);

                    if (searchResults.length > 0) {
                        // Find best match
                        const bestMatch = searchResults.find(result =>
                            result.id === notification.mangaId ||
                            result.title.toLowerCase().trim() === notification.title.toLowerCase().trim()
                        ) || searchResults[0];

                        manga = bestMatch;
                        console.log('Found manga via search with complete data');
                    }
                } catch (error) {
                    console.log('Could not search for manga:', error.message);
                }
            }

            // Fallback: create basic manga object from notification data
            if (!manga) {
                console.log('Using notification data as fallback');
                manga = {
                    id: notification.mangaId,
                    title: notification.title,
                    source: notification.source,
                    coverUrl: notification.mangaCover,
                    url: notification.sourceUrl
                };
            }

            // If we have a Comick manga, try to get even more details and validate chapter count
            if (manga.source === 'Comick' && manga.id) {
                try {
                    console.log('Fetching Comick details for:', manga.title, 'with ID:', manga.id);
                    const comickDetails = await window.mangaAPI.getMangaDetails(manga.id, 'Comick');
                    if (comickDetails) {
                        console.log('Comick API returned:', {
                            title: comickDetails.title,
                            chapterCount: comickDetails.chapterCount,
                            status: comickDetails.status,
                            year: comickDetails.year
                        });

                        // Validate chapter count using consensus from multiple sources (non-blocking)
                        if (comickDetails.chapterCount > 0) {
                            // Run validation in background without blocking the UI
                            window.mangaAPI.validateChapterCount(
                                comickDetails.chapterCount,
                                manga.title,
                                manga.url
                            ).then(validation => {
                                if (!validation.isReasonable && validation.confidence > 60) {
                                    console.log(`Chapter count corrected by consensus: ${comickDetails.chapterCount} → ${validation.suggestedCount} (confidence: ${validation.confidence}%)`);
                                    // Update the displayed chapter count if the page is still showing this manga
                                    const chapterCountElement = document.getElementById('mangaChapterCount');
                                    if (chapterCountElement && this.currentManga && this.currentManga.id === manga.id) {
                                        chapterCountElement.textContent = validation.suggestedCount;
                                    }
                                } else if (validation.confidence > 0) {
                                    console.log(`Chapter count validated: ${comickDetails.chapterCount} (confidence: ${validation.confidence}%)`);
                                }
                            }).catch(error => {
                                console.log('Could not validate chapter count:', error.message);
                            });
                        }

                        Object.assign(manga, comickDetails);
                        console.log('Enhanced with Comick API details');
                    }
                } catch (error) {
                    console.log('Could not fetch additional Comick details:', error.message);
                }
            }

            // Navigate to manga details page
            await this.showMangaDetails(manga, null, 'notifications');

        } catch (error) {
            console.error('Failed to navigate to manga details:', error);
            this.showError('Failed to load manga details: ' + error.message);
        }
    }

    async goToNextChapter(notification) {
        try {
            console.log('Going to next chapter for:', notification.title);

            // Mark notification as read first
            await window.mangaAPI.markNotificationRead(notification.id);

            let targetChapterNumber = notification.nextChapterToRead;

            // Fallback calculation if nextChapterToRead is missing (for old notifications)
            if (!targetChapterNumber && notification.oldChapter !== undefined) {
                targetChapterNumber = Math.floor(notification.oldChapter) + 1;
                console.log(`Calculated target chapter from oldChapter: ${notification.oldChapter} + 1 = ${targetChapterNumber}`);
            }

            if (!targetChapterNumber || isNaN(targetChapterNumber)) {
                console.error('Invalid chapter number:', targetChapterNumber);
                this.showError('Invalid chapter number. Please try clearing old notifications and checking for updates again.');
                return;
            }

            console.log(`Looking for Chapter ${targetChapterNumber} of "${notification.title}"...`);

            this.showLoading(`Finding Chapter ${targetChapterNumber}...`);

            // Use the EXACT same logic as regular manga selection
            console.log('Using findMangaSources (same as regular search)...');

            // First, we need to get the Comick URL for this manga (same as selectManga does)
            let comickUrl = null;

            // Try to find the manga on Comick first to get the proper URL
            try {
                console.log('Searching Comick to get proper URL...');
                const comickResults = await window.mangaAPI.searchBySource(notification.title, 'Comick');

                if (comickResults.length > 0) {
                    const bestMatch = comickResults.find(result =>
                        result.id === notification.mangaId ||
                        result.title.toLowerCase() === notification.title.toLowerCase()
                    ) || comickResults[0];

                    if (bestMatch && bestMatch.url) {
                        comickUrl = bestMatch.url;
                        console.log('Found Comick URL:', comickUrl);
                    }
                }
            } catch (error) {
                console.log('Failed to get Comick URL:', error.message);
            }

            // Now call findMangaSources with the same parameters as selectManga
            const sources = await window.mangaAPI.findMangaSources(notification.title, comickUrl);

            console.log('Found sources:', sources);

            if (sources.length === 0) {
                this.showError('No sources found for this manga');
                return;
            }

            let bestMatch = null;
            let fallbackMatch = null;

            // Check each source for the target chapter
            for (const source of sources) {
                try {
                    console.log(`\n=== Checking ${source.parserName} ===`);
                    console.log('Source details:', source);

                    // Get chapters for this source
                    const chapters = await window.mangaAPI.getChapters(source.url, source.parserName);

                    if (chapters.length > 0) {
                        console.log(`${source.parserName} has ${chapters.length} chapters`);

                        // Sort chapters by number (ascending)
                        const sortedChapters = [...chapters].sort((a, b) => {
                            const numA = parseFloat(a.number) || 0;
                            const numB = parseFloat(b.number) || 0;
                            return numA - numB;
                        });

                        // Look for exact chapter match
                        const exactChapter = sortedChapters.find(ch => parseFloat(ch.number) === targetChapterNumber);

                        if (exactChapter) {
                            console.log(`✅ Found exact Chapter ${targetChapterNumber} on ${source.parserName}!`);
                            bestMatch = {
                                source: source,
                                chapters: sortedChapters,
                                targetChapter: exactChapter
                            };
                            break; // Found exact match, stop searching
                        }

                        // If no exact match, look for closest available chapter as fallback
                        const closestChapter = sortedChapters.find(ch => parseFloat(ch.number) >= targetChapterNumber);

                        if (closestChapter && !fallbackMatch) {
                            console.log(`📍 Found closest Chapter ${closestChapter.number} on ${source.parserName} (fallback)`);
                            fallbackMatch = {
                                source: source,
                                chapters: sortedChapters,
                                targetChapter: closestChapter
                            };
                        }
                    } else {
                        console.log(`${source.parserName}: No chapters found`);
                    }
                } catch (error) {
                    console.log(`❌ Failed to check ${source.parserName}:`, error.message);
                }
            }

            // Use best match or fallback
            const selectedMatch = bestMatch || fallbackMatch;

            if (!selectedMatch) {
                this.showError(`Chapter ${targetChapterNumber} not found on any source`);
                return;
            }

            const { source: bestSource, chapters: sortedChapters, targetChapter } = selectedMatch;

            // Set current manga and source
            const manga = {
                id: notification.mangaId,
                title: notification.title,
                url: notification.sourceUrl,
                source: notification.source,
                coverUrl: notification.mangaCover
            };

            this.currentManga = manga;
            this.currentSource = bestSource.parserName;

            // Add index to all chapters for navigation
            sortedChapters.forEach((chapter, index) => {
                chapter.index = index;
            });

            // Set allChapters for navigation
            this.allChapters = sortedChapters;

            // Load the chapter directly
            this.currentChapter = targetChapter;
            const pages = await window.mangaAPI.getPages(targetChapter.url, bestSource.parserName);
            this.currentPages = pages;
            this.currentPageIndex = 0;

            await this.displayReader();

            // Update notification badge
            await this.updateNotificationBadge();

            // Show success message
            if (parseFloat(targetChapter.number) === targetChapterNumber) {
                this.showSuccess(`Starting Chapter ${targetChapterNumber} of ${notification.title} (${bestSource.parserName})`);
            } else {
                this.showSuccess(`Chapter ${targetChapterNumber} not available. Starting Chapter ${targetChapter.number} on ${bestSource.parserName} instead.`);
            }

        } catch (error) {
            console.error('Failed to go to next chapter:', error);
            this.showError('Failed to load chapter: ' + error.message);
        }
    }

    // Remove the old findBestTitleMatch method since we're not using it anymore
    async goToNextChapterOLD(notification) {
        try {
            console.log('Going to next chapter for:', notification.title);

            // Mark notification as read first
            await window.mangaAPI.markNotificationRead(notification.id);

            console.log('Full notification object:', notification);

            let targetChapterNumber = notification.nextChapterToRead;

            // Fallback calculation if nextChapterToRead is missing (for old notifications)
            if (!targetChapterNumber && notification.oldChapter !== undefined) {
                targetChapterNumber = Math.floor(notification.oldChapter) + 1;
                console.log(`Calculated target chapter from oldChapter: ${notification.oldChapter} + 1 = ${targetChapterNumber}`);
            }

            if (!targetChapterNumber || isNaN(targetChapterNumber)) {
                console.error('Invalid chapter number:', targetChapterNumber);
                this.showError('Invalid chapter number. Please try clearing old notifications and checking for updates again.');
                return;
            }

            console.log(`Looking for Chapter ${targetChapterNumber} of "${notification.title}"...`);

            // Create manga object for navigation
            const manga = {
                id: notification.mangaId,
                title: notification.title,
                url: notification.sourceUrl,
                source: notification.source,
                coverUrl: notification.mangaCover
            };

            this.showLoading(`Finding Chapter ${targetChapterNumber}...`);

            // Step 1: Get manga details from Comick to get alternative titles (same as regular search)
            let alternativeTitles = [notification.title];

            try {
                console.log('Fetching alternative titles from Comick...');
                console.log('Searching Comick with title:', notification.title);

                const comickResults = await window.mangaAPI.searchBySource(notification.title, 'Comick');
                console.log('Comick search results:', comickResults.length);

                if (comickResults.length > 0) {
                    const bestMatch = comickResults.find(result =>
                        result.id === notification.mangaId ||
                        result.title.toLowerCase() === notification.title.toLowerCase()
                    ) || comickResults[0];

                    console.log('Best match from Comick:', bestMatch);

                    if (bestMatch && bestMatch.url) {
                        console.log('Getting manga details for URL:', bestMatch.url);
                        const mangaDetails = await window.mangaAPI.getMangaDetails(bestMatch.url, 'Comick');
                        console.log('Manga details:', mangaDetails);

                        if (mangaDetails && mangaDetails.alternativeTitles) {
                            alternativeTitles = [notification.title, ...mangaDetails.alternativeTitles];
                            console.log(`Found ${alternativeTitles.length} alternative titles:`, alternativeTitles.slice(0, 10));
                        } else {
                            console.log('No alternative titles found in manga details');
                        }
                    } else {
                        console.log('No valid manga ID found');
                    }
                } else {
                    console.log('No results from Comick search');
                }
            } catch (error) {
                console.log('Failed to get alternative titles, using original title only:', error.message);
            }

            // Step 2: Use the same source finding logic as regular manga selection
            console.log('Searching across all sources using alternative titles...');

            // Use top 5 titles for searching (same as regular search)
            const searchTitles = alternativeTitles.slice(0, 5);
            console.log('Search titles to use:', searchTitles);

            const sources = ['MangaDex', 'TrueManga', 'MangaBuddy', 'MangaTown', 'Bato.To', 'Mangakakalot', 'AsuraScans', 'FlameComics'];

            let bestMatch = null;
            let fallbackMatch = null;

            // Search each source using the same parallel search logic
            for (const sourceName of sources) {
                try {
                    console.log(`\n=== Searching ${sourceName} ===`);

                    // Try each alternative title
                    for (const title of searchTitles) {
                        try {
                            console.log(`Trying title: "${title}" on ${sourceName}`);
                            const searchResults = await window.mangaAPI.searchBySource(title, sourceName);

                            if (searchResults.length > 0) {
                                // Find best match using title similarity (same logic as regular search)
                                const bestResult = this.findBestTitleMatch(searchResults, notification.title, alternativeTitles);

                                if (bestResult) {
                                    console.log(`Found manga on ${sourceName}: ${bestResult.title}`);

                                    // Get chapters for this source
                                    const chapters = await window.mangaAPI.getChapters(bestResult.url, sourceName);

                                    if (chapters.length > 0) {
                                        // Sort chapters by number (ascending)
                                        const sortedChapters = [...chapters].sort((a, b) => {
                                            const numA = parseFloat(a.number) || 0;
                                            const numB = parseFloat(b.number) || 0;
                                            return numA - numB;
                                        });

                                        // Look for exact chapter match
                                        const exactChapter = sortedChapters.find(ch => parseFloat(ch.number) === targetChapterNumber);

                                        if (exactChapter) {
                                            console.log(`✅ Found exact Chapter ${targetChapterNumber} on ${sourceName}!`);
                                            bestMatch = {
                                                source: { ...bestResult, parserName: sourceName },
                                                chapters: sortedChapters,
                                                targetChapter: exactChapter
                                            };
                                            break; // Found exact match, stop searching this source
                                        }

                                        // If no exact match, look for closest available chapter as fallback
                                        const closestChapter = sortedChapters.find(ch => parseFloat(ch.number) >= targetChapterNumber);

                                        if (closestChapter && !fallbackMatch) {
                                            console.log(`📍 Found closest Chapter ${closestChapter.number} on ${sourceName} (fallback)`);
                                            fallbackMatch = {
                                                source: { ...bestResult, parserName: sourceName },
                                                chapters: sortedChapters,
                                                targetChapter: closestChapter
                                            };
                                        }
                                    }

                                    break; // Found manga on this source, no need to try other titles
                                }
                            }
                        } catch (error) {
                            console.log(`Failed to search ${sourceName} with title "${title}":`, error.message);
                        }
                    }

                    // If we found an exact match, stop searching other sources
                    if (bestMatch) {
                        break;
                    }

                } catch (error) {
                    console.log(`Failed to search ${sourceName}:`, error.message);
                }
            }

            // Use best match or fallback
            const selectedMatch = bestMatch || fallbackMatch;

            if (!selectedMatch) {
                this.showError(`Chapter ${targetChapterNumber} not found on any source`);
                return;
            }

            const { source: bestSource, chapters: sortedChapters, targetChapter } = selectedMatch;

            // Set current manga and source
            this.currentManga = manga;
            this.currentSource = bestSource.parserName;

            // Add index to all chapters for navigation
            sortedChapters.forEach((chapter, index) => {
                chapter.index = index;
            });

            // Set allChapters for navigation
            this.allChapters = sortedChapters;

            // Load the chapter directly
            this.currentChapter = targetChapter;
            const pages = await window.mangaAPI.getPages(targetChapter.url, bestSource.parserName);
            this.currentPages = pages;
            this.currentPageIndex = 0;

            await this.displayReader();

            // Update notification badge
            await this.updateNotificationBadge();

            // Show success message
            if (parseFloat(targetChapter.number) === targetChapterNumber) {
                this.showSuccess(`Starting Chapter ${targetChapterNumber} of ${notification.title} (${bestSource.parserName})`);
            } else {
                this.showSuccess(`Chapter ${targetChapterNumber} not available. Starting Chapter ${targetChapter.number} on ${bestSource.parserName} instead.`);
            }

        } catch (error) {
            console.error('Failed to go to next chapter:', error);
            this.showError('Failed to load chapter: ' + error.message);
        }
    }

    findBestTitleMatch(searchResults, originalTitle, alternativeTitles) {
        // Use the same title matching logic as regular search
        const query = originalTitle.toLowerCase().trim();

        // Calculate relevance scores for each result
        const scoredResults = searchResults.map(manga => {
            let score = 0;
            const title = manga.title.toLowerCase();

            // Check against original title
            if (title === query) {
                score += 100;
            } else if (title.startsWith(query)) {
                score += 80;
            } else if (this.containsAllWords(title, query)) {
                score += 60;
            } else if (this.containsSomeWords(title, query)) {
                score += 40;
            }

            // Check against alternative titles
            for (const altTitle of alternativeTitles) {
                const altQuery = altTitle.toLowerCase().trim();
                if (title === altQuery) {
                    score += 90;
                    break;
                } else if (title.includes(altQuery) || altQuery.includes(title)) {
                    score += 50;
                }
            }

            return { ...manga, relevanceScore: score };
        });

        // Filter and sort by relevance
        const filteredResults = scoredResults.filter(manga => manga.relevanceScore >= 40);
        filteredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

        return filteredResults.length > 0 ? filteredResults[0] : null;
    }

    async markAllNotificationsRead() {
        try {
            await window.mangaAPI.markAllNotificationsRead();
            document.querySelectorAll('.notification-item').forEach(item => {
                item.classList.remove('unread');
            });
            this.updateNotificationBadge();
            this.showSuccess('All notifications marked as read!');
        } catch (error) {
            this.showError('Failed to mark all notifications as read: ' + error.message);
        }
    }

    async clearAllNotifications() {
        try {
            // Show confirmation dialog
            const confirmed = confirm('Are you sure you want to clear all notifications? This action cannot be undone.');

            if (!confirmed) {
                return;
            }

            await window.mangaAPI.clearAllNotifications();

            // Clear the UI
            const notificationsList = document.getElementById('notificationsList');
            notificationsList.innerHTML = '<p>No notifications yet.</p>';

            this.updateNotificationBadge();
            this.showSuccess('All notifications cleared!');
        } catch (error) {
            this.showError('Failed to clear all notifications: ' + error.message);
        }
    }

    async removeNotification(notificationId, itemElement) {
        try {
            await window.mangaAPI.removeNotification(notificationId);

            // Remove from UI with animation
            itemElement.style.transition = 'opacity 0.3s, transform 0.3s';
            itemElement.style.opacity = '0';
            itemElement.style.transform = 'translateX(100%)';

            setTimeout(() => {
                if (itemElement.parentNode) {
                    itemElement.parentNode.removeChild(itemElement);

                    // Check if no notifications left
                    const notificationsList = document.getElementById('notificationsList');
                    if (notificationsList.children.length === 0) {
                        notificationsList.innerHTML = '<p>No notifications yet.</p>';
                    }
                }
            }, 300);

            this.updateNotificationBadge();
        } catch (error) {
            this.showError('Failed to remove notification: ' + error.message);
        }
    }

    async updateNotificationBadge() {
        try {
            const count = await window.mangaAPI.getUnreadNotificationCount();
            const badge = document.getElementById('notificationBadge');
            const bottomBadge = document.getElementById('bottomNotificationBadge');

            if (count > 0) {
                const displayCount = count > 99 ? '99+' : count;

                // Update top badge
                if (badge) {
                    badge.textContent = displayCount;
                    badge.classList.remove('hidden');
                }

                // Update bottom badge
                if (bottomBadge) {
                    bottomBadge.textContent = displayCount;
                    bottomBadge.classList.remove('hidden');
                }
            } else {
                // Hide both badges
                if (badge) {
                    badge.classList.add('hidden');
                }
                if (bottomBadge) {
                    bottomBadge.classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('Failed to update notification badge:', error);
        }
    }

    // Content Filter Methods
    toggleContentFilter() {
        const newState = this.contentFilter.toggleFilter();
        this.updateFilterToggle();

        // Re-apply filtering to all visible manga cards
        this.refreshContentFiltering();

        const status = newState ? 'enabled' : 'disabled';
        this.showSuccess(`Content filter ${status}`);
    }

    updateFilterToggle() {
        const button = document.getElementById('filterToggleBtn');
        if (button) {
            const status = this.contentFilter.getFilterStatus();
            button.classList.toggle('enabled', status.enabled);
            button.textContent = status.enabled ? '🔞 Filter ON' : '🔞 Filter OFF';
            button.title = status.description;
        }
    }

    refreshContentFiltering() {
        // Apply filtering to all manga cards currently visible
        const mangaCards = document.querySelectorAll('.manga-card');
        mangaCards.forEach(card => {
            const titleElement = card.querySelector('.manga-title');
            if (titleElement) {
                // Extract manga data from card
                const manga = {
                    title: titleElement.textContent,
                    description: card.querySelector('.manga-description')?.textContent || '',
                    source: card.querySelector('.manga-source')?.textContent || ''
                };

                // Remove existing censoring
                const existingContainer = card.querySelector('.censored-container');
                if (existingContainer) {
                    const img = existingContainer.querySelector('.manga-cover');
                    if (img) {
                        existingContainer.parentNode.insertBefore(img, existingContainer);
                        existingContainer.remove();
                    }
                }

                // Remove existing warning
                const existingWarning = card.querySelector('.content-warning');
                if (existingWarning) {
                    existingWarning.remove();
                }

                // Apply new filtering
                this.contentFilter.applyCensorToCard(card, manga);
                this.contentFilter.addContentWarning(card, manga);
            }
        });
    }

    // Fetch all cover images functionality
    async fetchAllCovers() {
        try {
            const fetchBtn = document.getElementById('fetchCoversBtn');
            const originalText = fetchBtn.innerHTML;

            // Disable button and show progress
            fetchBtn.disabled = true;
            fetchBtn.innerHTML = '⏳ Fetching...';

            // Get all follows
            const follows = await window.mangaAPI.getFollows();
            const mangaWithoutCovers = follows.filter(manga =>
                !manga.coverUrl && manga.source === 'Comick' && manga.id
            );

            if (mangaWithoutCovers.length === 0) {
                this.showSuccess('All manga already have cover images!');
                fetchBtn.disabled = false;
                fetchBtn.innerHTML = originalText;
                return;
            }

            console.log(`Fetching cover images for ${mangaWithoutCovers.length} imported manga...`);

            let successCount = 0;
            let failCount = 0;
            const total = mangaWithoutCovers.length;

            // Fetch covers in batches to avoid overwhelming the API
            const batchSize = 3;
            for (let i = 0; i < mangaWithoutCovers.length; i += batchSize) {
                const batch = mangaWithoutCovers.slice(i, i + batchSize);

                // Update progress
                const progress = Math.round((i / total) * 100);
                fetchBtn.innerHTML = `⏳ ${progress}% (${i}/${total})`;

                await Promise.all(batch.map(async (manga) => {
                    try {
                        // Search for the manga on Comick to get cover image
                        const searchResults = await window.mangaAPI.searchBySource(manga.title, 'Comick');

                        if (searchResults.length > 0) {
                            // Find the best match
                            const bestMatch = searchResults.find(result =>
                                result.id === manga.id ||
                                result.title.toLowerCase() === manga.title.toLowerCase()
                            ) || searchResults[0];

                            if (bestMatch && bestMatch.coverUrl) {
                                // Update in storage
                                await window.mangaAPI.updateFollowCoverUrl(manga.id, manga.source, bestMatch.coverUrl);

                                // Update the UI card
                                this.updateFollowCardImage(manga.id, bestMatch.coverUrl);

                                successCount++;
                                console.log(`✅ Fetched cover for: ${manga.title}`);
                            } else {
                                failCount++;
                                console.log(`❌ No cover found for: ${manga.title}`);
                            }
                        } else {
                            failCount++;
                            console.log(`❌ No search results for: ${manga.title}`);
                        }
                    } catch (error) {
                        failCount++;
                        console.error(`❌ Failed to fetch cover for ${manga.title}:`, error);
                    }
                }));

                // Small delay between batches to be respectful to the API
                if (i + batchSize < mangaWithoutCovers.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            // Show completion message
            const message = `Cover fetch complete! ✅ ${successCount} successful, ❌ ${failCount} failed`;
            this.showSuccess(message);

            // Re-enable button
            fetchBtn.disabled = false;
            fetchBtn.innerHTML = originalText;

        } catch (error) {
            console.error('Fetch all covers error:', error);
            this.showError('Failed to fetch covers: ' + error.message);

            // Re-enable button
            const fetchBtn = document.getElementById('fetchCoversBtn');
            fetchBtn.disabled = false;
            fetchBtn.innerHTML = '🖼️ Fetch All Covers';
        }
    }

    async updateReadingProgress() {
        try {
            const updateBtn = document.getElementById('updateReadingProgressBtn');
            const originalText = updateBtn.innerHTML;

            updateBtn.disabled = true;
            updateBtn.innerHTML = '⏳ Updating...';

            const result = await window.mangaAPI.updateFollowsReadingProgress();

            if (result.success) {
                this.showSuccess(`Updated ${result.updated} manga with continue buttons`);

                // Reload the follows page to show the new buttons
                await this.loadFollows();
            } else {
                this.showError('Failed to update reading progress: ' + result.error);
            }

            updateBtn.disabled = false;
            updateBtn.innerHTML = originalText;
        } catch (error) {
            console.error('Update reading progress error:', error);
            this.showError('Failed to update reading progress: ' + error.message);

            const updateBtn = document.getElementById('updateReadingProgressBtn');
            updateBtn.disabled = false;
            updateBtn.innerHTML = '📖 Add Continue Buttons';
        }
    }

    updateFollowCardImage(mangaId, coverUrl) {
        // Find the follow card and update its image
        const cards = document.querySelectorAll('.follow-card');
        cards.forEach(card => {
            const cardMangaId = card.dataset.mangaId;
            if (cardMangaId === mangaId) {
                const imageContainer = card.querySelector('.follow-cover');
                if (imageContainer && (imageContainer.classList.contains('imported-placeholder') || imageContainer.style.background)) {
                    // Replace the placeholder with actual image
                    imageContainer.outerHTML = `<img src="${coverUrl}" alt="Cover" class="follow-cover">`;
                }
            }
        });
    }

    // Import/Export functionality
    async exportFollows() {
        try {
            const result = await window.mangaAPI.exportFollowsCSV();

            if (result.success) {
                // Create and download CSV file
                const blob = new Blob([result.csvContent], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `vash-reader-follows-${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);

                this.showSuccess('Follows exported successfully!');
            } else {
                this.showError('Failed to export follows: ' + result.error);
            }
        } catch (error) {
            this.showError('Export failed: ' + error.message);
        }
    }

    importFollows() {
        // Trigger file input
        const fileInput = document.getElementById('csvFileInput');
        fileInput.click();
    }

    async handleCSVFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.csv')) {
            this.showError('Please select a CSV file');
            return;
        }

        try {
            const csvContent = await this.readFileAsText(file);
            const result = await window.mangaAPI.importFollowsCSV(csvContent);

            if (result.success) {
                this.showSuccess(result.message);
                // Refresh the follows page
                await this.loadFollows();
            } else {
                this.showError(result.message || 'Import failed');
            }
        } catch (error) {
            this.showError('Failed to read CSV file: ' + error.message);
        }

        // Clear the file input
        event.target.value = '';
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    showSuccess(message) {
        // Simple success notification - you can enhance this
        console.log('Success:', message);

        // Show a temporary success message
        const successDiv = document.createElement('div');
        successDiv.className = 'success-notification';
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 40px 12px 20px;
            border-radius: 4px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 10px;
            max-width: 300px;
        `;

        // Create message text
        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;
        messageSpan.style.flex = '1';

        // Create close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            padding: 0;
            margin: 0;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 2px;
        `;

        closeBtn.addEventListener('click', () => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        });

        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.2)';
        });

        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'none';
        });

        successDiv.appendChild(messageSpan);
        successDiv.appendChild(closeBtn);

        document.body.appendChild(successDiv);

        // Remove after 5 seconds (increased time since user can now close manually)
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 5000);
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new MangaReader();
});