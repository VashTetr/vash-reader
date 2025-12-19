/**
 * Advanced parsing utilities inspired by Tachiyomi/Kotatsu parsers
 */

class ParserUtils {
    /**
     * Detect if a page is protected by anti-bot measures
     */
    static detectProtection(html, $) {
        const protectionIndicators = [
            'Just a moment...',
            'Checking your browser',
            'DDoS protection by Cloudflare',
            'Please wait while we verify',
            'Security check',
            'Ray ID:',
            'cf-browser-verification',
            'cf-challenge-running',
            'challenge-platform',
            'Redirecting...',
            'Please enable JavaScript',
            'Access denied',
            'Blocked by administrator',
            'This site is protected',
            'Anti-bot verification'
        ];

        const textContent = $.text ? $.text().toLowerCase() : html.toLowerCase();

        for (const indicator of protectionIndicators) {
            if (textContent.includes(indicator.toLowerCase())) {
                return {
                    isProtected: true,
                    type: this.getProtectionType(indicator),
                    indicator
                };
            }
        }

        // Check for specific protection elements
        if ($ && typeof $ === 'function') {
            const protectionSelectors = [
                '.cf-browser-verification',
                '.cf-challenge-running',
                '#challenge-form',
                '.challenge-platform',
                '.ddos-protection',
                '.security-check',
                '.access-denied',
                '.blocked-message'
            ];

            for (const selector of protectionSelectors) {
                if ($(selector).length > 0) {
                    return {
                        isProtected: true,
                        type: 'element_detection',
                        selector
                    };
                }
            }
        }

        // Check for very short responses (likely redirects or errors)
        if (html.length < 500 && (html.includes('<script>') || html.includes('location.href'))) {
            return {
                isProtected: true,
                type: 'redirect_detection',
                reason: 'Short response with redirect script'
            };
        }

        return { isProtected: false };
    }

    static getProtectionType(indicator) {
        if (indicator.includes('Cloudflare')) return 'cloudflare';
        if (indicator.includes('DDoS')) return 'ddos';
        if (indicator.includes('JavaScript')) return 'javascript_required';
        if (indicator.includes('Access denied')) return 'access_denied';
        if (indicator.includes('Redirecting')) return 'redirect';
        return 'unknown';
    }

    /**
     * Enhanced image source extraction with lazy loading support
     */
    static extractImageSrc($img) {
        if (!$img || $img.length === 0) return null;

        // Priority order for image sources
        const srcAttributes = [
            'data-src',        // Most common lazy loading
            'data-original',   // Grouple/ReadManga style
            'data-lazy-src',   // Alternative lazy loading
            'data-cfsrc',      // Cloudflare lazy loading
            'data-srcset',     // Responsive images
            'src'              // Standard src (last resort)
        ];

        for (const attr of srcAttributes) {
            const value = $img.attr(attr);
            if (value && !this.isPlaceholderImage(value)) {
                return value;
            }
        }

        return null;
    }

    /**
     * Check if an image URL is a placeholder
     */
    static isPlaceholderImage(url) {
        if (!url) return true;

        const placeholderPatterns = [
            'x.gif',
            'loading.gif',
            'placeholder',
            'blank.png',
            'empty.jpg',
            'default.jpg',
            'no-image',
            'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
        ];

        const lowerUrl = url.toLowerCase();
        return placeholderPatterns.some(pattern => lowerUrl.includes(pattern));
    }

    /**
     * Advanced date parsing supporting multiple formats and relative dates
     */
    static parseDate(dateString, locale = 'en') {
        if (!dateString) return 0;

        const cleanDate = dateString.trim().toLowerCase();

        // Handle relative dates
        const relativeDate = this.parseRelativeDate(cleanDate);
        if (relativeDate > 0) return relativeDate;

        // Handle specific keywords
        if (cleanDate.includes('yesterday')) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0, 0, 0, 0);
            return yesterday.getTime();
        }

        if (cleanDate.includes('today')) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return today.getTime();
        }

        // Try various date formats
        const dateFormats = [
            /(\d{4})-(\d{2})-(\d{2})/,                    // YYYY-MM-DD
            /(\d{2})\/(\d{2})\/(\d{4})/,                  // MM/DD/YYYY
            /(\d{2})-(\d{2})-(\d{4})/,                    // MM-DD-YYYY
            /(\w+)\s+(\d{1,2}),\s+(\d{4})/,              // Month DD, YYYY
            /(\d{1,2})\s+(\w+)\s+(\d{4})/,               // DD Month YYYY
            /(\d{4})年(\d{1,2})月(\d{1,2})日/,            // Chinese format
            /(\d{1,2})\.(\d{1,2})\.(\d{4})/,             // DD.MM.YYYY
        ];

        for (const format of dateFormats) {
            const match = dateString.match(format);
            if (match) {
                try {
                    const date = new Date(dateString);
                    if (!isNaN(date.getTime())) {
                        return date.getTime();
                    }
                } catch (e) {
                    // Continue to next format
                }
            }
        }

        // Fallback to Date constructor
        try {
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? 0 : date.getTime();
        } catch (e) {
            return 0;
        }
    }

    /**
     * Parse relative dates (e.g., "2 hours ago", "3 days ago")
     */
    static parseRelativeDate(dateString) {
        const now = new Date();
        const numberMatch = dateString.match(/(\d+)/);
        if (!numberMatch) return 0;

        const number = parseInt(numberMatch[1]);

        if (dateString.includes('second') || dateString.includes('sec')) {
            return now.getTime() - (number * 1000);
        }
        if (dateString.includes('minute') || dateString.includes('min')) {
            return now.getTime() - (number * 60 * 1000);
        }
        if (dateString.includes('hour') || dateString.includes('hr')) {
            return now.getTime() - (number * 60 * 60 * 1000);
        }
        if (dateString.includes('day') || dateString.includes('día')) {
            return now.getTime() - (number * 24 * 60 * 60 * 1000);
        }
        if (dateString.includes('week')) {
            return now.getTime() - (number * 7 * 24 * 60 * 60 * 1000);
        }
        if (dateString.includes('month') || dateString.includes('mes')) {
            return now.getTime() - (number * 30 * 24 * 60 * 60 * 1000);
        }
        if (dateString.includes('year') || dateString.includes('año')) {
            return now.getTime() - (number * 365 * 24 * 60 * 60 * 1000);
        }

        return 0;
    }

    /**
     * Normalize manga state from various text representations
     */
    static normalizeMangaState(stateText) {
        if (!stateText) return null;

        const state = stateText.toLowerCase().trim();

        // Ongoing states
        const ongoingStates = [
            'ongoing', 'on going', 'on-going', 'publishing', 'updating',
            'en curso', 'en cours', 'ativo', 'em lançamento', 'devam ediyor',
            'em andamento', 'in corso', 'güncel', 'berjalan', 'продолжается',
            'lançando', 'publicando', 'مستمر', 'مستمرة', '连载中'
        ];

        // Finished states
        const finishedStates = [
            'completed', 'complete', 'completo', 'finished', 'finalizado',
            'terminé', 'terminado', 'tamamlandı', 'hoàn thành', 'مكتملة',
            'завершено', 'completata', 'bitti', 'tamat', 'concluído',
            '已完结', 'bitmiş', 'end'
        ];

        // Abandoned states
        const abandonedStates = [
            'canceled', 'cancelled', 'cancelado', 'dropped', 'discontinued',
            'abandonné', 'cancellato'
        ];

        // Paused states
        const pausedStates = [
            'hiatus', 'on hold', 'pausado', 'en pause', 'en espera'
        ];

        if (ongoingStates.some(s => state.includes(s))) return 'ongoing';
        if (finishedStates.some(s => state.includes(s))) return 'finished';
        if (abandonedStates.some(s => state.includes(s))) return 'abandoned';
        if (pausedStates.some(s => state.includes(s))) return 'paused';

        return null;
    }

    /**
     * Extract chapter number from various text formats
     */
    static extractChapterNumber(text) {
        if (!text) return 0;

        // Try various patterns
        const patterns = [
            /chapter\s*(\d+(?:\.\d+)?)/i,
            /ch\.?\s*(\d+(?:\.\d+)?)/i,
            /cap\.?\s*(\d+(?:\.\d+)?)/i,
            /第(\d+(?:\.\d+)?)话/,
            /第(\d+(?:\.\d+)?)章/,
            /(\d+(?:\.\d+)?)/
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const number = parseFloat(match[1]);
                if (!isNaN(number)) return number;
            }
        }

        return 0;
    }

    /**
     * Clean and normalize text content
     */
    static cleanText(text) {
        if (!text) return '';

        return text
            .replace(/\s+/g, ' ')           // Multiple spaces to single
            .replace(/\n+/g, ' ')           // Newlines to spaces
            .replace(/\t+/g, ' ')           // Tabs to spaces
            .trim();
    }

    /**
     * Extract domain from URL
     */
    static extractDomain(url) {
        try {
            return new URL(url).hostname;
        } catch (e) {
            return null;
        }
    }

    /**
     * Check if URL is absolute
     */
    static isAbsoluteUrl(url) {
        return /^https?:\/\//.test(url);
    }

    /**
     * Convert relative URL to absolute
     */
    static toAbsoluteUrl(url, baseUrl) {
        if (this.isAbsoluteUrl(url)) return url;
        if (url.startsWith('//')) return 'https:' + url;
        if (url.startsWith('/')) return baseUrl + url;
        return baseUrl + '/' + url;
    }

    /**
     * Throttle function calls
     */
    static throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;

        return function (...args) {
            const currentTime = Date.now();

            if (currentTime - lastExecTime > delay) {
                func.apply(this, args);
                lastExecTime = currentTime;
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(this, args);
                    lastExecTime = Date.now();
                }, delay - (currentTime - lastExecTime));
            }
        };
    }

    /**
     * Retry function with exponential backoff
     */
    static async retry(fn, maxRetries = 3, baseDelay = 1000) {
        let lastError;

        for (let i = 0; i <= maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;

                if (i === maxRetries) break;

                const delay = baseDelay * Math.pow(2, i);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError;
    }

    /**
     * Generate a simple hash for URLs/IDs
     */
    static generateHash(str) {
        let hash = 0;
        if (str.length === 0) return hash;

        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }

        return Math.abs(hash).toString(36);
    }
}

module.exports = ParserUtils;