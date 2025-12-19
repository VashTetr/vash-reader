const cheerio = require('cheerio');
const ParserUtils = require('../utils/parser-utils');

class BaseParser {
    constructor(name, baseUrl, lang = 'en') {
        this.name = name;
        this.baseUrl = baseUrl;
        this.lang = lang;
        this.requestCount = 0;
        this.lastRequestTime = 0;
        this.minRequestInterval = 100; // Minimum 100ms between requests
    }

    async fetchHtml(url, options = {}) {
        // Rate limiting
        await this.throttleRequest();

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

            const html = await this.performRequest(url, options, isElectron, net);

            // Check for protection/blocking
            const $ = cheerio.load(html);
            const protection = ParserUtils.detectProtection(html, $);

            if (protection.isProtected) {
                console.warn(`${this.name}: Site protection detected - ${protection.type}:`, protection.indicator || protection.reason);

                // For some protection types, we can still return empty results gracefully
                if (protection.type === 'cloudflare' || protection.type === 'ddos') {
                    throw new Error(`Site protected by ${protection.type}`);
                }
            }

            return html;
        } catch (error) {
            console.error(`Fetch error for ${url}:`, error);
            throw error;
        }
    }

    async throttleRequest() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.minRequestInterval) {
            const delay = this.minRequestInterval - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        this.lastRequestTime = Date.now();
        this.requestCount++;
    }

    async performRequest(url, options, isElectron, net) {
        if (isElectron && net) {
            // Electron context with proper headers for manga sites
            return new Promise((resolve, reject) => {
                const request = net.request({
                    method: 'GET',
                    url: url,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': this.baseUrl,
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Accept-Encoding': 'gzip, deflate',
                        'DNT': '1',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'none',
                        ...options.headers
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
                        resolve(data);
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
                const requestOptions = {
                    hostname: urlParsed.hostname,
                    port: urlParsed.port || 443,
                    path: urlParsed.pathname + urlParsed.search,
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        ...(options.headers || {})
                    }
                };

                const req = https.request(requestOptions, (res) => {
                    let data = '';

                    res.on('data', (chunk) => {
                        data += chunk.toString();
                    });

                    res.on('end', () => {
                        resolve(data);
                    });
                });

                req.on('error', (error) => {
                    reject(error);
                });

                req.end();
            });
        }
    }

    loadHtml(html) {
        return cheerio.load(html);
    }

    // Timeout wrapper for search operations with retry logic
    async searchWithTimeout(query, timeoutMs = 10000) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`${this.name} search timeout after ${timeoutMs}ms`)), timeoutMs);
        });

        try {
            return await Promise.race([
                ParserUtils.retry(() => this.search(query), 2, 1000),
                timeoutPromise
            ]);
        } catch (error) {
            console.warn(`${this.name} search failed:`, error.message);
            return [];
        }
    }

    // Enhanced browse functionality
    async browseWithTimeout(timeoutMs = 10000) {
        if (!this.browse) {
            console.warn(`${this.name} does not support browse functionality`);
            return [];
        }

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`${this.name} browse timeout after ${timeoutMs}ms`)), timeoutMs);
        });

        try {
            return await Promise.race([
                ParserUtils.retry(() => this.browse(), 2, 1000),
                timeoutPromise
            ]);
        } catch (error) {
            console.warn(`${this.name} browse failed:`, error.message);
            return [];
        }
    }

    // Abstract methods to be implemented by subclasses
    async search(query) {
        throw new Error('search() method must be implemented');
    }

    async getChapters(mangaUrl) {
        throw new Error('getChapters() method must be implemented');
    }

    async getPages(chapterUrl) {
        throw new Error('getPages() method must be implemented');
    }

    // Utility methods
    absoluteUrl(url) {
        return ParserUtils.toAbsoluteUrl(url, this.baseUrl);
    }

    cleanText(text) {
        return ParserUtils.cleanText(text);
    }

    // Enhanced image extraction
    extractImageSrc($img) {
        return ParserUtils.extractImageSrc($img);
    }

    // Date parsing
    parseDate(dateString) {
        return ParserUtils.parseDate(dateString, this.lang);
    }

    // State normalization
    normalizeState(stateText) {
        return ParserUtils.normalizeMangaState(stateText);
    }

    // Chapter number extraction
    extractChapterNumber(text) {
        return ParserUtils.extractChapterNumber(text);
    }

    // Generate unique ID
    generateId(url) {
        return ParserUtils.generateHash(url);
    }
}

module.exports = BaseParser;