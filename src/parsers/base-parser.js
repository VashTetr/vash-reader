const cheerio = require('cheerio');

class BaseParser {
    constructor(name, baseUrl, lang = 'en') {
        this.name = name;
        this.baseUrl = baseUrl;
        this.lang = lang;
    }

    async fetchHtml(url, options = {}) {
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
                // Electron context with proper headers for manga sites
                return new Promise((resolve, reject) => {
                    const request = net.request({
                        method: 'GET',
                        url: url,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                            'Referer': this.baseUrl,
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.5',
                            'Accept-Encoding': 'gzip, deflate',
                            'DNT': '1',
                            'Connection': 'keep-alive',
                            'Upgrade-Insecure-Requests': '1',
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
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
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
        } catch (error) {
            console.error(`Fetch error for ${url}:`, error);
            throw error;
        }
    }

    loadHtml(html) {
        return cheerio.load(html);
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
        if (url.startsWith('http')) return url;
        if (url.startsWith('//')) return 'https:' + url;
        if (url.startsWith('/')) return this.baseUrl + url;
        return this.baseUrl + '/' + url;
    }

    cleanText(text) {
        return text ? text.trim().replace(/\s+/g, ' ') : '';
    }
}

module.exports = BaseParser;