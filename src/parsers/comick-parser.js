const BaseParser = require('./base-parser');

class ComickParser extends BaseParser {
    constructor() {
        super('Comick', 'https://api.comick.dev');
    }

    async fetchJsonWithHeaders(url, extraHeaders = {}) {
        return this.fetchJson(url, extraHeaders);
    }

    async fetchJson(url, extraHeaders = {}) {
        try {
            // Check if we're in Electron context
            let isElectron = false;
            let net = null;

            try {
                net = require('electron').net;
                isElectron = true;
            } catch (e) {
                isElectron = false;
            }

            if (isElectron && net) {
                // Electron context
                return new Promise((resolve, reject) => {
                    const request = net.request({
                        method: 'GET',
                        url: url,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                            ...extraHeaders
                        }
                    });

                    let data = '';

                    request.on('response', (response) => {
                        if (response.statusCode >= 400) {
                            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                            return;
                        }

                        response.on('data', (chunk) => {
                            data += chunk.toString();
                        });

                        response.on('end', () => {
                            try {
                                resolve(JSON.parse(data));
                            } catch (error) {
                                reject(new Error('Invalid JSON response'));
                            }
                        });
                    });

                    request.on('error', (error) => {
                        reject(error);
                    });

                    request.end();
                });
            } else {
                // Node.js context - fallback to https
                const https = require('https');
                const urlParsed = new URL(url);

                return new Promise((resolve, reject) => {
                    const options = {
                        hostname: urlParsed.hostname,
                        port: urlParsed.port || 443,
                        path: urlParsed.pathname + urlParsed.search,
                        method: 'GET',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                            ...extraHeaders
                        }
                    };

                    const req = https.request(options, (res) => {
                        let data = '';

                        res.on('data', (chunk) => {
                            data += chunk.toString();
                        });

                        res.on('end', () => {
                            try {
                                resolve(JSON.parse(data));
                            } catch (error) {
                                console.error('Comick JSON parse error. Response data:', data.substring(0, 500));
                                reject(new Error('Invalid JSON response'));
                            }
                        });
                    });

                    req.on('error', (error) => {
                        reject(error);
                    });

                    req.end();
                });
            }
        } catch (error) {
            console.error(`Fetch JSON error for ${url}:`, error);
            throw error;
        }
    }

    async getPopular(page = 1, limit = 20) {
        try {
            // Use the real Comick API /top endpoint for popular ongoing
            const url = `${this.baseUrl}/top?page=${page}&limit=${limit}`;
            const data = await this.fetchJson(url);

            const results = [];

            // The API returns {rank: [...]} structure
            if (data && data.rank && Array.isArray(data.rank)) {
                for (const comic of data.rank.slice(0, limit)) {
                    // Get cover image from md_covers array
                    let coverUrl = null;
                    if (comic.md_covers && comic.md_covers.length > 0) {
                        const cover = comic.md_covers[0];
                        coverUrl = `https://meo.comick.pictures/${cover.b2key}`;
                    }

                    // Get English title from md_titles
                    let title = comic.title;
                    if (comic.md_titles && comic.md_titles.length > 0) {
                        const englishTitle = comic.md_titles.find(t => t.lang === 'en');
                        if (englishTitle) {
                            title = englishTitle.title;
                        }
                    }

                    results.push({
                        id: comic.slug || comic.id,
                        title: title,
                        url: `https://comick.io/comic/${comic.slug}`,
                        coverUrl: coverUrl,
                        description: comic.desc || comic.description || '',
                        source: this.name,
                        rating: comic.rating,
                        follows: comic.follow_count || comic.user_follow_count,
                        lastChapter: comic.last_chapter
                    });
                }
            }

            return results;
        } catch (error) {
            console.error('Comick popular error:', error);
            return [];
        }
    }

    async getTrending(page = 1, limit = 20) {
        try {
            // Get trending from the main /top endpoint (Most Recent Popular)
            const mainUrl = `${this.baseUrl}/top?page=1&limit=50`;
            const mainData = await this.fetchJson(mainUrl);

            let results = [];

            // Use the 'trending' object from the main endpoint with time periods
            if (mainData && mainData.trending && typeof mainData.trending === 'object') {
                console.log('DEBUG: Using trending object from main endpoint');

                // Try different time periods (7, 30, 90 days) - prefer shorter periods for more recent trending
                const timePeriods = ['7', '30', '90'];
                for (const period of timePeriods) {
                    if (mainData.trending[period] && Array.isArray(mainData.trending[period])) {
                        const comics = mainData.trending[period].slice(0, limit);

                        for (const comic of comics) {
                            // Get cover image from md_covers array
                            let coverUrl = null;
                            if (comic.md_covers && comic.md_covers.length > 0) {
                                const cover = comic.md_covers[0];
                                coverUrl = `https://meo.comick.pictures/${cover.b2key}`;
                            }

                            // Get English title from md_titles
                            let title = comic.title;
                            if (comic.md_titles && comic.md_titles.length > 0) {
                                const englishTitle = comic.md_titles.find(t => t.lang === 'en');
                                if (englishTitle) {
                                    title = englishTitle.title;
                                }
                            }

                            results.push({
                                id: comic.slug || comic.id,
                                title: title,
                                url: `https://comick.io/comic/${comic.slug}`,
                                coverUrl: coverUrl,
                                description: comic.desc || comic.description || '',
                                source: this.name,
                                rating: comic.rating,
                                follows: comic.follow_count || comic.user_follow_count,
                                lastChapter: comic.last_chapter
                            });
                        }
                        break; // Use first available time period
                    }
                }
            }

            // If no results from main endpoint, try the separate trending endpoint
            if (results.length === 0) {
                console.log('DEBUG: Fallback to separate trending endpoint');
                const trendingUrl = `${this.baseUrl}/top?type=trending&day=180`;
                const trendingData = await this.fetchJson(trendingUrl);

                // Try different time periods (7, 30, 90, 180 days)
                const timePeriods = ['7', '30', '90', '180'];
                for (const period of timePeriods) {
                    if (trendingData && trendingData[period] && Array.isArray(trendingData[period])) {
                        const comics = trendingData[period].slice(0, limit);

                        for (const comic of comics) {
                            let coverUrl = null;
                            if (comic.md_covers && comic.md_covers.length > 0) {
                                coverUrl = `https://meo.comick.pictures/${comic.md_covers[0].b2key}`;
                            }

                            let title = comic.title;
                            if (comic.md_titles && comic.md_titles.length > 0) {
                                const englishTitle = comic.md_titles.find(t => t.lang === 'en');
                                if (englishTitle) title = englishTitle.title;
                            }

                            results.push({
                                id: comic.slug || comic.id,
                                title: title,
                                url: `https://comick.io/comic/${comic.slug}`,
                                coverUrl: coverUrl,
                                description: comic.desc || comic.description || '',
                                source: this.name,
                                rating: comic.rating,
                                follows: comic.follow_count || comic.user_follow_count,
                                lastChapter: comic.last_chapter
                            });
                        }
                        break; // Use first available time period
                    }
                }
            }

            return results;
        } catch (error) {
            console.error('Comick trending error:', error);
            return [];
        }
    }

    async getNewFollow(page = 1, limit = 20) {
        try {
            // Get new follow comics from the main /top endpoint (Most Followed New Comics)
            const mainUrl = `${this.baseUrl}/top?page=1&limit=50`;
            const mainData = await this.fetchJson(mainUrl);

            let results = [];

            // Use the 'topFollowNewComics' object from the main endpoint with time periods
            if (mainData && mainData.topFollowNewComics && typeof mainData.topFollowNewComics === 'object') {
                console.log('DEBUG: Using topFollowNewComics object from main endpoint');

                // Try different time periods (7, 30, 90 days) - prefer shorter periods for newer comics
                const timePeriods = ['7', '30', '90'];
                for (const period of timePeriods) {
                    if (mainData.topFollowNewComics[period] && Array.isArray(mainData.topFollowNewComics[period])) {
                        const comics = mainData.topFollowNewComics[period].slice(0, limit);

                        for (const comic of comics) {
                            // Get cover image from md_covers array
                            let coverUrl = null;
                            if (comic.md_covers && comic.md_covers.length > 0) {
                                const cover = comic.md_covers[0];
                                coverUrl = `https://meo.comick.pictures/${cover.b2key}`;
                            }

                            // Get English title from md_titles
                            let title = comic.title;
                            if (comic.md_titles && comic.md_titles.length > 0) {
                                const englishTitle = comic.md_titles.find(t => t.lang === 'en');
                                if (englishTitle) {
                                    title = englishTitle.title;
                                }
                            }

                            results.push({
                                id: comic.slug || comic.id,
                                title: title,
                                url: `https://comick.io/comic/${comic.slug}`,
                                coverUrl: coverUrl,
                                description: comic.desc || comic.description || '',
                                source: this.name,
                                rating: comic.rating,
                                follows: comic.follow_count || comic.user_follow_count,
                                lastChapter: comic.last_chapter
                            });
                        }
                        break; // Use first available time period
                    }
                }
            }

            // If no results from main endpoint, try the separate newfollow endpoint
            if (results.length === 0) {
                console.log('DEBUG: Fallback to separate newfollow endpoint');
                const newFollowUrl = `${this.baseUrl}/top?type=newfollow&day=180`;
                const newFollowData = await this.fetchJson(newFollowUrl);

                // Try different time periods (7, 30, 90, 180 days)
                const timePeriods = ['7', '30', '90', '180'];
                for (const period of timePeriods) {
                    if (newFollowData && newFollowData[period] && Array.isArray(newFollowData[period])) {
                        const comics = newFollowData[period].slice(0, limit);

                        for (const comic of comics) {
                            let coverUrl = null;
                            if (comic.md_covers && comic.md_covers.length > 0) {
                                coverUrl = `https://meo.comick.pictures/${comic.md_covers[0].b2key}`;
                            }

                            let title = comic.title;
                            if (comic.md_titles && comic.md_titles.length > 0) {
                                const englishTitle = comic.md_titles.find(t => t.lang === 'en');
                                if (englishTitle) title = englishTitle.title;
                            }

                            results.push({
                                id: comic.slug || comic.id,
                                title: title,
                                url: `https://comick.io/comic/${comic.slug}`,
                                coverUrl: coverUrl,
                                description: comic.desc || comic.description || '',
                                source: this.name,
                                rating: comic.rating,
                                follows: comic.follow_count || comic.user_follow_count,
                                lastChapter: comic.last_chapter
                            });
                        }
                        break; // Use first available time period
                    }
                }
            }

            return results;
        } catch (error) {
            console.error('Comick newfollow error:', error);
            return [];
        }
    }

    async getRecent(page = 1, limit = 50) {
        try {
            // Use the proper /chapter/ endpoint with order=new for latest chapters
            const url = `${this.baseUrl}/chapter/?page=${page}&limit=${limit}&order=new&lang=en`;
            const data = await this.fetchJson(url);

            const results = [];

            if (data && Array.isArray(data)) {
                for (const chapter of data) {
                    const comic = chapter.md_comics;
                    if (comic && comic.title) {
                        // Get cover image from md_covers array
                        let coverUrl = null;
                        if (comic.md_covers && comic.md_covers.length > 0) {
                            const cover = comic.md_covers[0];
                            coverUrl = `https://meo.comick.pictures/${cover.b2key}`;
                        }

                        // Get English title from md_titles
                        let title = comic.title;
                        if (comic.md_titles && comic.md_titles.length > 0) {
                            const englishTitle = comic.md_titles.find(t => t.lang === 'en');
                            if (englishTitle) {
                                title = englishTitle.title;
                            }
                        }

                        results.push({
                            id: comic.slug || comic.id,
                            title: title,
                            url: `https://comick.io/comic/${comic.slug}`,
                            coverUrl: coverUrl,
                            chapterTitle: chapter.title || `Chapter ${chapter.chap}`,
                            chapterNumber: chapter.chap,
                            source: this.name,
                            updatedAt: chapter.created_at || chapter.updated_at
                        });
                    }
                }
            }

            return results;
        } catch (error) {
            console.error('Comick recent error:', error);
            // Fallback to recentRank from /top if /chapter fails
            try {
                const topData = await this.fetchJson(`${this.baseUrl}/top?page=1&limit=20`);
                if (topData && topData.recentRank && Array.isArray(topData.recentRank)) {
                    return topData.recentRank.slice(0, limit).map(comic => {
                        let coverUrl = null;
                        if (comic.md_covers && comic.md_covers.length > 0) {
                            coverUrl = `https://meo.comick.pictures/${comic.md_covers[0].b2key}`;
                        }

                        let title = comic.title;
                        if (comic.md_titles && comic.md_titles.length > 0) {
                            const englishTitle = comic.md_titles.find(t => t.lang === 'en');
                            if (englishTitle) title = englishTitle.title;
                        }

                        return {
                            id: comic.slug || comic.id,
                            title: title,
                            url: `https://comick.io/comic/${comic.slug}`,
                            coverUrl: coverUrl,
                            chapterTitle: 'New Release',
                            chapterNumber: 'Latest',
                            source: this.name,
                            updatedAt: new Date().toISOString()
                        };
                    });
                }
            } catch (fallbackError) {
                console.error('Comick fallback error:', fallbackError);
            }
            return [];
        }
    }

    // Search method using real Comick API
    async search(query, page = 1, limit = 100) {
        try {
            // API limits: page max 50, limit max 300
            // Note: When using 'q' parameter, other filters may be ignored
            const safePage = Math.min(page, 50);
            const safeLimit = Math.min(limit, 300);
            const url = `${this.baseUrl}/v1.0/search/?q=${encodeURIComponent(query)}&page=${safePage}&limit=${safeLimit}`;
            const data = await this.fetchJson(url);

            const results = [];

            if (data && Array.isArray(data)) {
                for (const comic of data) {
                    // Get cover image from md_covers array
                    let coverUrl = null;
                    if (comic.md_covers && comic.md_covers.length > 0) {
                        const cover = comic.md_covers[0];
                        coverUrl = `https://meo.comick.pictures/${cover.b2key}`;
                    }

                    // Get English title from md_titles
                    let title = comic.title;
                    if (comic.md_titles && comic.md_titles.length > 0) {
                        const englishTitle = comic.md_titles.find(t => t.lang === 'en');
                        if (englishTitle) {
                            title = englishTitle.title;
                        }
                    }

                    // Hard filter: Skip any manga with loli content
                    const hasInappropriateContent = [
                        title.toLowerCase(),
                        (comic.desc || comic.description || '').toLowerCase()
                    ].some(text => text.includes('loli'));

                    if (hasInappropriateContent) {
                        continue; // Skip this manga entirely
                    }

                    results.push({
                        id: comic.slug || comic.hid,
                        title: title,
                        url: `https://comick.io/comic/${comic.slug}`,
                        coverUrl: coverUrl,
                        description: comic.desc || comic.description || '',
                        source: this.name
                    });
                }
            }

            // Deduplicate results by slug/id and title
            return this.deduplicateResults(results);
        } catch (error) {
            console.error('Comick search error:', error);
            return [];
        }
    }

    // Advanced search with filters
    async advancedSearch(filters = {}) {
        try {
            const params = new URLSearchParams();

            // Basic search query
            if (filters.query) {
                params.append('q', filters.query);
            }

            // Pagination (API limits: page max 50, limit max 300)
            const page = Math.min(filters.page || 1, 50);
            const limit = Math.min(filters.limit || 100, 300);
            params.append('page', page);
            params.append('limit', limit);

            // Genres (include)
            if (filters.genres && filters.genres.length > 0) {
                filters.genres.forEach(genre => params.append('genres', genre));
            }

            // Excluded genres
            if (filters.excludedGenres && filters.excludedGenres.length > 0) {
                filters.excludedGenres.forEach(genre => params.append('excludes', genre));
            }

            // Tags (include)
            if (filters.tags && filters.tags.length > 0) {
                filters.tags.forEach(tag => params.append('tags', tag));
            }

            // Excluded tags
            if (filters.excludedTags && filters.excludedTags.length > 0) {
                filters.excludedTags.forEach(tag => params.append('excluded-tags', tag));
            }

            // Demographics (1=shounen, 2=shoujo, 3=seinen, 4=josei, 5=none)
            if (filters.demographics && filters.demographics.length > 0) {
                filters.demographics.forEach(demo => params.append('demographic', demo));
            }

            // Country (kr, jp, cn, etc.)
            if (filters.countries && filters.countries.length > 0) {
                filters.countries.forEach(country => params.append('country', country));
            }

            // Status (1=Ongoing, 2=Completed, 3=Cancelled, 4=Hiatus)
            if (filters.status) {
                params.append('status', filters.status);
            }

            // Content rating (safe, suggestive, erotica, pornographic)
            if (filters.contentRating && filters.contentRating.length > 0) {
                filters.contentRating.forEach(rating => params.append('content_rating', rating));
            }

            // Year range
            if (filters.fromYear) {
                params.append('from', filters.fromYear);
            }
            if (filters.toYear) {
                params.append('to', filters.toYear);
            }

            // Minimum chapters
            if (filters.minChapters) {
                params.append('minimum', filters.minChapters);
            }

            // Sort options (view, created_at, uploaded, rating, follow, user_follow_count)
            if (filters.sort) {
                params.append('sort', filters.sort);
            }

            // Completed translation
            if (filters.completedTranslation !== undefined) {
                params.append('completed', filters.completedTranslation);
            }

            // Show all (include comics without chapters)
            if (filters.showAll !== undefined) {
                params.append('showall', filters.showAll);
            }

            const url = `${this.baseUrl}/v1.0/search/?${params.toString()}`;
            console.log('Advanced search URL:', url);

            const data = await this.fetchJson(url);
            const results = [];

            if (data && Array.isArray(data)) {
                for (const comic of data) {
                    // Get cover image from md_covers array
                    let coverUrl = null;
                    if (comic.md_covers && comic.md_covers.length > 0) {
                        const cover = comic.md_covers[0];
                        coverUrl = `https://meo.comick.pictures/${cover.b2key}`;
                    }

                    // Get English title from md_titles
                    let title = comic.title;
                    if (comic.md_titles && comic.md_titles.length > 0) {
                        const englishTitle = comic.md_titles.find(t => t.lang === 'en');
                        if (englishTitle) {
                            title = englishTitle.title;
                        }
                    }

                    // Get additional metadata
                    const genres = comic.md_comic_md_genres ?
                        comic.md_comic_md_genres.map(g => g.md_genres?.name || g.name).filter(Boolean) : [];

                    const tags = comic.md_comic_md_tags ?
                        comic.md_comic_md_tags.map(t => t.md_tags?.name || t.name).filter(Boolean) : [];

                    // Hard filter: Skip any manga with loli content
                    const hasInappropriateContent = [
                        title.toLowerCase(),
                        (comic.desc || comic.description || '').toLowerCase(),
                        ...genres.map(g => g.toLowerCase()),
                        ...tags.map(t => t.toLowerCase())
                    ].some(text => text.includes('loli'));

                    if (hasInappropriateContent) {
                        continue; // Skip this manga entirely
                    }

                    results.push({
                        id: comic.slug || comic.hid,
                        title: title,
                        url: `https://comick.io/comic/${comic.slug}`,
                        coverUrl: coverUrl,
                        description: comic.desc || comic.description || '',
                        source: this.name,
                        rating: comic.rating,
                        follows: comic.follow_count || comic.user_follow_count,
                        status: comic.status,
                        year: comic.year,
                        country: comic.country,
                        genres: genres,
                        tags: tags,
                        demographic: comic.demographic,
                        contentRating: comic.content_rating,
                        chapterCount: comic.chapter_count || comic.last_chapter
                    });
                }
            }

            // Deduplicate results by slug/id and title
            return this.deduplicateResults(results);
        } catch (error) {
            console.error('Comick advanced search error:', error);
            return [];
        }
    }

    // Get available genres
    async getGenres() {
        try {
            const url = `${this.baseUrl}/genre/`;
            const data = await this.fetchJson(url);

            if (data && Array.isArray(data)) {
                return data
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
                    .map(genre => ({
                        id: genre.slug || genre.id,
                        name: genre.name.trim(),
                        slug: genre.slug
                    }));
            }

            return [];
        } catch (error) {
            console.error('Comick getGenres error:', error);
            return [];
        }
    }

    // Get available categories/tags
    async getCategories() {
        try {
            const url = `${this.baseUrl}/category/`;
            const data = await this.fetchJson(url);

            if (data && Array.isArray(data)) {
                return data
                    .filter(category =>
                        category &&
                        category.name &&
                        category.name !== 'undefined' &&
                        category.name.trim() !== '' &&
                        (category.slug || category.id) &&
                        // Hard filter: Never include loli content
                        !category.name.toLowerCase().includes('loli') &&
                        !category.slug?.toLowerCase().includes('loli')
                    )
                    .map(category => ({
                        id: category.slug || category.id,
                        name: category.name.trim(),
                        slug: category.slug
                    }));
            }

            return [];
        } catch (error) {
            console.error('Comick getCategories error:', error);
            return [];
        }
    }

    async getChapters(mangaUrl) {
        try {
            // Extract slug from URL (e.g., https://comick.io/comic/one-piece -> one-piece)
            const slug = mangaUrl.split('/').pop();

            // Try different API endpoints based on the documentation
            let chaptersData = null;

            // First try with slug directly using v1.0 endpoint
            try {
                const chaptersUrl = `${this.baseUrl}/v1.0/comic/${slug}/chapters?lang=en`;
                chaptersData = await this.fetchJson(chaptersUrl);
            } catch (error) {
                console.log('v1.0 attempt failed, trying without v1.0...');

                // Try without v1.0
                try {
                    const chaptersUrl = `${this.baseUrl}/comic/${slug}/chapters?lang=en`;
                    chaptersData = await this.fetchJson(chaptersUrl);
                } catch (error2) {
                    console.log('Direct slug failed, trying to get comic info first...');

                    // Get comic info first to get the hid
                    const comicUrl = `${this.baseUrl}/comic/${slug}`;
                    const comicData = await this.fetchJson(comicUrl);

                    if (comicData && comicData.comic && comicData.comic.hid) {
                        const hid = comicData.comic.hid;
                        const chaptersUrl = `${this.baseUrl}/comic/${hid}/chapters?lang=en`;
                        chaptersData = await this.fetchJson(chaptersUrl);
                    }
                }
            }

            const chapters = [];

            if (chaptersData && Array.isArray(chaptersData)) {
                // Direct array response
                for (const chapter of chaptersData) {
                    chapters.push({
                        id: chapter.hid || chapter.id,
                        number: chapter.chap || chapter.chapter || '0',
                        title: chapter.title || '',
                        url: `${this.baseUrl}/chapter/${chapter.hid || chapter.id}`,
                        source: this.name,
                        uploadDate: chapter.created_at || chapter.updated_at
                    });
                }
            } else if (chaptersData && chaptersData.chapters && Array.isArray(chaptersData.chapters)) {
                // Wrapped in chapters object
                for (const chapter of chaptersData.chapters) {
                    chapters.push({
                        id: chapter.hid || chapter.id,
                        number: chapter.chap || chapter.chapter || '0',
                        title: chapter.title || '',
                        url: `${this.baseUrl}/chapter/${chapter.hid || chapter.id}`,
                        source: this.name,
                        uploadDate: chapter.created_at || chapter.updated_at
                    });
                }
            }

            return chapters;
        } catch (error) {
            console.error('Comick getChapters error:', error);
            return [];
        }
    }

    async getPages(chapterUrl) {
        try {
            // Extract hid from URL (e.g., https://comick.io/comic/one-piece/12345 -> 12345)
            const hid = chapterUrl.split('/').pop();

            // Get chapter images
            const imagesUrl = `${this.baseUrl}/chapter/${hid}`;
            const chapterData = await this.fetchJson(imagesUrl);

            const pages = [];

            if (chapterData && chapterData.chapter && chapterData.chapter.md_images) {
                const images = chapterData.chapter.md_images;

                for (let i = 0; i < images.length; i++) {
                    const image = images[i];
                    pages.push({
                        pageNumber: i + 1,
                        imageUrl: `https://meo.comick.pictures/${image.b2key}?width=800`
                    });
                }
            }

            return pages;
        } catch (error) {
            console.error('Comick getPages error:', error);
            return [];
        }
    }

    // Get manga details including all alternative titles from description
    async getMangaDetails(mangaUrl) {
        try {
            // Extract slug from URL (e.g., https://comick.io/comic/one-piece -> one-piece)
            const slug = mangaUrl.split('/').pop();

            // Get comic details using the API endpoint
            const comicUrl = `${this.baseUrl}/comic/${slug}`;
            const comicData = await this.fetchJson(comicUrl);

            if (comicData && comicData.comic) {
                const comic = comicData.comic;

                // Extract all titles from md_titles array
                const allTitles = [];

                // Add main title
                if (comic.title) {
                    allTitles.push(comic.title);
                }

                // Add all alternative titles from md_titles
                if (comic.md_titles && Array.isArray(comic.md_titles)) {
                    for (const titleObj of comic.md_titles) {
                        if (titleObj.title && !allTitles.includes(titleObj.title)) {
                            allTitles.push(titleObj.title);
                        }
                    }
                }

                // Extract titles from description if it contains alternative names
                if (comic.desc || comic.description) {
                    const description = comic.desc || comic.description;
                    const extractedTitles = this.extractTitlesFromDescription(description);
                    for (const title of extractedTitles) {
                        if (!allTitles.includes(title)) {
                            allTitles.push(title);
                        }
                    }
                }

                // Extract genres from md_comic_md_genres
                const genres = [];
                if (comic.md_comic_md_genres && Array.isArray(comic.md_comic_md_genres)) {
                    for (const genreObj of comic.md_comic_md_genres) {
                        if (genreObj.md_genres && genreObj.md_genres.name) {
                            genres.push(genreObj.md_genres.name);
                        }
                    }
                }

                // Extract tags from md_comic_md_tags
                const tags = [];
                if (comic.md_comic_md_tags && Array.isArray(comic.md_comic_md_tags)) {
                    for (const tagObj of comic.md_comic_md_tags) {
                        if (tagObj.md_tags && tagObj.md_tags.name) {
                            tags.push(tagObj.md_tags.name);
                        }
                    }
                }

                return {
                    title: comic.title,
                    allTitles: allTitles,
                    description: comic.desc || comic.description || '',
                    slug: comic.slug,
                    status: comic.status,
                    year: comic.year,
                    country: comic.country,
                    rating: comic.rating,
                    follows: comic.follow_count || comic.user_follow_count,
                    genres: genres,
                    tags: tags,
                    demographic: comic.demographic,
                    contentRating: comic.content_rating,
                    chapterCount: comic.chapter_count || comic.last_chapter,
                    coverUrl: comic.md_covers && comic.md_covers.length > 0 ?
                        `https://meo.comick.pictures/${comic.md_covers[0].b2key}` : null
                };
            }

            return null;
        } catch (error) {
            console.error('Comick getMangaDetails error:', error);
            return null;
        }
    }

    // Extract alternative titles from description text
    extractTitlesFromDescription(description) {
        const titles = [];

        // Look for patterns like "Alternative names: Title1 • Title2 • Title3"
        // or "Also known as: Title1, Title2, Title3"
        const patterns = [
            /(?:Alternative\s+(?:names?|titles?)|Also\s+known\s+as|Other\s+names?)[:\s]+([^.]+)/gi,
            /([^•]+)(?:\s*•\s*)/g  // Split by bullet points
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(description)) !== null) {
                const titleText = match[1];
                if (titleText) {
                    // Split by common separators and clean up
                    const splitTitles = titleText.split(/[•,;|]/).map(t => t.trim());
                    for (const title of splitTitles) {
                        // Only include titles with Latin characters (English, etc.)
                        if (title.length > 2 && /[a-zA-Z]/.test(title)) {
                            // Clean up the title
                            const cleanTitle = title
                                .replace(/^\s*[•\-,;|]\s*/, '') // Remove leading separators
                                .replace(/\s*[•\-,;|]\s*$/, '') // Remove trailing separators
                                .trim();

                            if (cleanTitle.length > 2 && !titles.includes(cleanTitle)) {
                                titles.push(cleanTitle);
                            }
                        }
                    }
                }
            }
        }

        return titles;
    }

    // Deduplicate results to prevent duplicate manga entries
    deduplicateResults(results) {
        const seen = new Map();
        const deduplicated = [];

        for (const manga of results) {
            // Use slug as primary key, fallback to normalized title
            const primaryKey = manga.id || manga.slug;
            const normalizedTitle = manga.title.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');

            // Check both slug and title for duplicates
            const slugKey = `slug:${primaryKey}`;
            const titleKey = `title:${normalizedTitle}`;

            if (!seen.has(slugKey) && !seen.has(titleKey)) {
                seen.set(slugKey, manga);
                seen.set(titleKey, manga);
                deduplicated.push(manga);
            }
        }

        return deduplicated;
    }


}

module.exports = ComickParser;