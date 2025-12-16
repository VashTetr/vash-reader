class ContentFilter {
    constructor() {
        // Blocked content that should never be shown
        this.blockedContent = [
            'loli', 'shota', 'lolicon', 'shotacon'
        ];

        // 18+ content keywords (nudity/sexual content only)
        this.adultKeywords = [
            // Explicit sexual terms
            'hentai', 'ecchi', 'smut', 'xxx', 'porn', 'nsfw',
            'erotic', 'sexual', 'nude', 'nudity', 'naked',
            'breast', 'boobs', 'panties', 'underwear', 'lingerie',

            // Sexual relationship terms
            'affair', 'cheating', 'ntr', 'milf', 'harem',
            'yaoi', 'yuri', 'bl', 'gl', 'doujinshi',

            // Explicit sexual themes
            'sexual themes', 'sexual violence', 'partial nudity',
            'adult only', 'mature content', 'suggestive themes'
        ];

        // 16+ content keywords (violence/gore/mature themes without nudity)
        this.matureKeywords = [
            // Violence and gore
            'gore', 'blood', 'violence', 'violent', 'brutal', 'murder',
            'death', 'killing', 'torture', 'war', 'battle', 'fight',
            'assassination', 'revenge', 'dark', 'psychological',

            // Mature themes (non-sexual)
            'seinen', 'josei', 'tragedy', 'drama',
            'crime', 'thriller', 'horror', 'supernatural',
            'dystopian', 'post-apocalyptic', 'survival'
        ];

        // Explicit terms that definitely indicate 18+ content (nudity/sexual)
        this.explicitKeywords = [
            'hentai', 'ecchi', 'smut', 'xxx', 'porn', 'nsfw',
            'erotic', 'sexual', 'nude', 'nudity', 'naked',
            'doujinshi', 'yaoi', 'yuri', 'bl', 'gl'
        ];

        // Load user preferences
        this.isEnabled = this.loadFilterPreference();
    }

    loadFilterPreference() {
        try {
            const saved = localStorage.getItem('contentFilterEnabled');
            return saved !== null ? JSON.parse(saved) : true; // Default enabled
        } catch (error) {
            return true; // Default enabled
        }
    }

    saveFilterPreference(enabled) {
        this.isEnabled = enabled;
        localStorage.setItem('contentFilterEnabled', JSON.stringify(enabled));
    }

    toggleFilter() {
        this.saveFilterPreference(!this.isEnabled);
        return this.isEnabled;
    }

    // Check for content that should NEVER be shown regardless of filter settings
    isBlockedContent(manga) {
        if (!manga) return false;

        const textToCheck = [
            manga.title || '',
            manga.description || '',
            ...(Array.isArray(manga.tags) ? manga.tags : []),
            ...(Array.isArray(manga.genres) ? manga.genres : []),
            manga.author || '',
            manga.status || ''
        ].join(' ').toLowerCase();

        // Hard block: Never allow loli content
        return this.blockedContent.some(blocked => {
            const regex = new RegExp(`\\b${blocked.toLowerCase()}\\b`);
            return regex.test(textToCheck);
        });
    }

    // Check for 18+ content (nudity/sexual content only)
    isAdultContent(manga) {
        if (!manga) return false;

        // First check if it's blocked content (always return true for blocked)
        if (this.isBlockedContent(manga)) {
            return true;
        }

        // Check MangaDex content rating first (most reliable)
        if (manga.contentRating) {
            return manga.contentRating === 'erotica' || manga.contentRating === 'pornographic';
        }

        const textToCheck = [
            manga.title || '',
            manga.description || '',
            ...(Array.isArray(manga.tags) ? manga.tags : []),
            ...(Array.isArray(manga.genres) ? manga.genres : []),
            manga.author || '',
            manga.status || ''
        ].join(' ').toLowerCase();

        // Check for explicit sexual keywords (high confidence) - use word boundaries
        const hasExplicitContent = this.explicitKeywords.some(keyword => {
            const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`);
            return regex.test(textToCheck);
        });

        if (hasExplicitContent) {
            return true;
        }

        // Check for multiple sexual keywords (medium confidence) - use word boundaries
        const sexualMatches = this.adultKeywords.filter(keyword => {
            const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`);
            return regex.test(textToCheck);
        }).length;

        // If 2 or more sexual keywords match, likely 18+ content
        return sexualMatches >= 2;
    }

    // Check for 16+ content (violence/gore/mature themes without nudity)
    isMatureContent(manga) {
        if (!manga) return false;

        // Check MangaDex content rating first
        if (manga.contentRating) {
            return manga.contentRating === 'suggestive';
        }

        const textToCheck = [
            manga.title || '',
            manga.description || '',
            ...(Array.isArray(manga.tags) ? manga.tags : []),
            ...(Array.isArray(manga.genres) ? manga.genres : []),
            manga.author || '',
            manga.status || ''
        ].join(' ').toLowerCase();

        // Check for mature theme keywords - use word boundaries
        const matureMatches = this.matureKeywords.filter(keyword => {
            const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`);
            return regex.test(textToCheck);
        }).length;

        // If 2 or more mature keywords match, likely 16+ content
        return matureMatches >= 2;
    }

    shouldCensorImage(manga) {
        // Only censor 18+ content (nudity/sexual), not 16+ content (gore/violence)
        return this.isEnabled && this.isAdultContent(manga);
    }

    applyCensorToImage(imgElement, manga) {
        if (!this.shouldCensorImage(manga)) {
            return;
        }

        // Add censored class and overlay
        imgElement.classList.add('censored-content');

        // Create overlay container if it doesn't exist
        let container = imgElement.parentElement;
        if (!container.classList.contains('censored-container')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'censored-container';
            imgElement.parentNode.insertBefore(wrapper, imgElement);
            wrapper.appendChild(imgElement);
            container = wrapper;
        }

        // Add overlay
        if (!container.querySelector('.censor-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'censor-overlay';
            overlay.innerHTML = `
                <div class="censor-content">
                    <div class="censor-icon">🔞</div>
                    <div class="censor-text">Adult Content</div>
                    <button class="censor-toggle" onclick="event.stopPropagation()">Click to View</button>
                </div>
            `;
            container.appendChild(overlay);

            // Add click handler to toggle censoring
            const toggleBtn = overlay.querySelector('.censor-toggle');
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                container.classList.toggle('uncensored');
                toggleBtn.textContent = container.classList.contains('uncensored') ? 'Hide' : 'Click to View';
            });
        }
    }

    applyCensorToCard(cardElement, manga) {
        const img = cardElement.querySelector('.manga-cover');
        if (img && img.tagName === 'IMG') {
            this.applyCensorToImage(img, manga);
        }
    }

    // Method to add content warning to manga cards
    addContentWarning(cardElement, manga) {
        // Remove any existing warnings first
        const existingWarnings = cardElement.querySelectorAll('.content-warning');
        existingWarnings.forEach(warning => warning.remove());

        const isAdult = this.isAdultContent(manga);
        const isMature = this.isMatureContent(manga);

        if (isAdult) {
            const warning = document.createElement('div');
            warning.className = 'content-warning adult';
            warning.textContent = '18+';
            warning.title = 'Adult Content (Nudity/Sexual)';
            cardElement.appendChild(warning);
        } else if (isMature) {
            const warning = document.createElement('div');
            warning.className = 'content-warning mature';
            warning.textContent = '16+';
            warning.title = 'Mature Content (Violence/Gore)';
            cardElement.appendChild(warning);
        }
    }

    // Get filter status for UI
    getFilterStatus() {
        return {
            enabled: this.isEnabled,
            description: this.isEnabled ? 'Content filter is ON' : 'Content filter is OFF'
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContentFilter;
} else {
    window.ContentFilter = ContentFilter;
}