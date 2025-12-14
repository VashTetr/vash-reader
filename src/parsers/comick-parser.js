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
    async search(query) {
        try {
            const url = `${this.baseUrl}/v1.0/search/?q=${encodeURIComponent(query)}&page=1&limit=20`;
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

            return results;
        } catch (error) {
            console.error('Comick search error:', error);
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

            // Get comic details
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

                return {
                    title: comic.title,
                    allTitles: allTitles,
                    description: comic.desc || comic.description || '',
                    slug: comic.slug
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


}

module.exports = ComickParser;