class ContentFilter {
    constructor() {
        // HARD BLOCKED CONTENT - Never allow these under any circumstances
        this.blockedContent = [
            'loli', 'lolicon', 'shotacon', 'shota'
        ];

        // Adult content keywords and patterns
        this.adultKeywords = [
            // Explicit terms
            'hentai', 'ecchi', 'smut', 'adult', 'mature', 'nsfw',
            'erotic', 'sexual', 'xxx', 'porn', 'harem', 'yaoi', 'yuri',

            // Common adult manga terms
            'doujinshi', 'oneshot', 'anthology',

            // Suggestive terms
            'romance', 'love', 'kiss', 'bed', 'night', 'secret',
            'forbidden', 'temptation', 'desire', 'passion',

            // Adult genres/tags
            'seinen', 'josei', 'mature themes', 'suggestive themes',
            'partial nudity', 'sexual themes', 'sexual violence',

            // Common patterns in adult titles
            'wife', 'husband', 'affair', 'cheating', 'ntr',
            'milf', 'teacher', 'student', 'office', 'workplace'
        ];

        // More explicit terms that definitely indicate adult content
        this.explicitKeywords = [
            'hentai', 'ecchi', 'smut', 'xxx', 'porn', 'nsfw',
            'erotic', 'sexual', 'adult only', 'mature content',
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
            ...(manga.tags || []),
            ...(manga.genres || []),
            manga.author || '',
            manga.status || ''
        ].join(' ').toLowerCase();

        // Hard block: Never allow loli content
        return this.blockedContent.some(blocked =>
            textToCheck.includes(blocked.toLowerCase())
        );
    }

    isAdultContent(manga) {
        if (!manga) return false;

        // First check if it's blocked content (always return true for blocked)
        if (this.isBlockedContent(manga)) {
            return true;
        }

        const textToCheck = [
            manga.title || '',
            manga.description || '',
            ...(manga.tags || []),
            ...(manga.genres || []),
            manga.author || '',
            manga.status || ''
        ].join(' ').toLowerCase();

        // Check for explicit keywords (high confidence)
        const hasExplicitContent = this.explicitKeywords.some(keyword =>
            textToCheck.includes(keyword.toLowerCase())
        );

        if (hasExplicitContent) {
            return true;
        }

        // Check for multiple suggestive keywords (medium confidence)
        const suggestiveMatches = this.adultKeywords.filter(keyword =>
            textToCheck.includes(keyword.toLowerCase())
        ).length;

        // If 2 or more suggestive keywords match, likely adult content
        return suggestiveMatches >= 2;
    }

    shouldCensorImage(manga) {
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
        if (!this.shouldCensorImage(manga)) {
            return;
        }

        // Add warning badge
        if (!cardElement.querySelector('.content-warning')) {
            const warning = document.createElement('div');
            warning.className = 'content-warning';
            warning.textContent = '18+';
            warning.title = 'Adult Content';
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