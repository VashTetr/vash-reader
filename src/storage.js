const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Storage {
    constructor() {
        this.userDataPath = app.getPath('userData');
        this.dataFile = path.join(this.userDataPath, 'vash-reader-data.json');
        this.data = this.loadData();
    }

    loadData() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const rawData = fs.readFileSync(this.dataFile, 'utf8');
                return JSON.parse(rawData);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }

        return {
            lastRead: [],
            readingProgress: {},
            favorites: [],
            follows: [],
            notifications: [],
            settings: {}
        };
    }

    saveData() {
        try {
            fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }

    addToLastRead(manga, chapter = null) {
        // Remove if already exists
        this.data.lastRead = this.data.lastRead.filter(item =>
            !(item.id === manga.id && item.source === manga.source)
        );

        // Add to beginning
        this.data.lastRead.unshift({
            ...manga,
            lastChapter: chapter,
            lastReadAt: new Date().toISOString()
        });

        // Keep only last 50 items
        this.data.lastRead = this.data.lastRead.slice(0, 50);

        this.saveData();
    }

    getLastRead(limit = 20) {
        return this.data.lastRead.slice(0, limit);
    }

    updateReadingProgress(mangaId, source, chapterNumber, pageNumber = 1, scrollPosition = 0, totalPages = 1) {
        const key = `${source}:${mangaId}`;

        // Determine if chapter is completed (on last page and scrolled to bottom)
        const isChapterCompleted = pageNumber >= totalPages && scrollPosition >= 0.9; // 90% scrolled on last page

        this.data.readingProgress[key] = {
            chapterNumber,
            pageNumber,
            scrollPosition, // 0.0 to 1.0 representing scroll percentage
            totalPages,
            isChapterCompleted,
            updatedAt: new Date().toISOString()
        };
        this.saveData();
    }

    getReadingProgress(mangaId, source) {
        const key = `${source}:${mangaId}`;
        return this.data.readingProgress[key] || null;
    }

    addToFavorites(manga) {
        // Check if already in favorites
        const exists = this.data.favorites.some(fav =>
            fav.id === manga.id && fav.source === manga.source
        );

        if (!exists) {
            this.data.favorites.push({
                ...manga,
                addedAt: new Date().toISOString()
            });
            this.saveData();
        }
    }

    removeFromFavorites(mangaId, source) {
        this.data.favorites = this.data.favorites.filter(fav =>
            !(fav.id === mangaId && fav.source === source)
        );
        this.saveData();
    }

    getFavorites() {
        return this.data.favorites;
    }

    isFavorite(mangaId, source) {
        return this.data.favorites.some(fav =>
            fav.id === mangaId && fav.source === source
        );
    }

    // Follow functionality
    addToFollows(manga) {
        // Ensure follows array exists
        if (!this.data.follows) {
            this.data.follows = [];
        }

        const exists = this.data.follows.some(follow =>
            follow.id === manga.id && follow.source === manga.source
        );

        if (!exists) {
            this.data.follows.push({
                ...manga,
                followedAt: new Date().toISOString(),
                lastKnownChapter: manga.lastKnownChapter || 0,
                lastCheckedAt: new Date().toISOString()
            });
            this.saveData();
        }
    }

    removeFromFollows(mangaId, source) {
        if (!this.data.follows) {
            this.data.follows = [];
        }

        this.data.follows = this.data.follows.filter(follow =>
            !(follow.id === mangaId && follow.source === source)
        );
        this.saveData();
    }

    updateFollowCoverUrl(mangaId, source, coverUrl) {
        if (!this.data.follows) {
            this.data.follows = [];
        }

        const follow = this.data.follows.find(f =>
            f.id === mangaId && f.source === source
        );

        if (follow) {
            follow.coverUrl = coverUrl;
            this.saveData();
        }
    }

    // Update existing follows with imported reading progress
    updateFollowsWithReadingProgress() {
        if (!this.data.follows) {
            this.data.follows = [];
        }

        let updated = 0;
        this.data.follows.forEach(follow => {
            // If follow doesn't have importedReadingProgress but has lastKnownChapter > 0
            if (!follow.importedReadingProgress && follow.lastKnownChapter > 0) {
                follow.importedReadingProgress = {
                    chapterNumber: follow.lastKnownChapter,
                    isImported: true,
                    sourceSelected: false
                };
                updated++;
            }
        });

        if (updated > 0) {
            this.saveData();
            console.log(`Updated ${updated} follows with reading progress`);
        }

        return updated;
    }

    // Status management
    updateMangaStatus(mangaId, source, newStatus) {
        if (!this.data.follows) {
            this.data.follows = [];
        }

        const follow = this.data.follows.find(f =>
            f.id === mangaId && f.source === source
        );

        if (follow) {
            follow.status = newStatus;
            this.saveData();
            return true;
        }
        return false;
    }

    getMangasByStatus(status) {
        if (!this.data.follows) {
            this.data.follows = [];
        }

        return this.data.follows.filter(follow =>
            follow.status === status || (!follow.status && status === 'Reading')
        );
    }

    getAllStatuses() {
        if (!this.data.follows) {
            this.data.follows = [];
        }

        const statuses = new Set();
        this.data.follows.forEach(follow => {
            statuses.add(follow.status || 'Reading');
        });

        return Array.from(statuses).sort();
    }

    getFollows() {
        if (!this.data.follows) {
            this.data.follows = [];
        }
        return this.data.follows;
    }

    isFollowing(mangaId, source) {
        if (!this.data.follows) {
            this.data.follows = [];
        }
        return this.data.follows.some(follow =>
            follow.id === mangaId && follow.source === source
        );
    }

    updateFollowChapterCount(mangaId, source, chapterCount) {
        if (!this.data.follows) {
            this.data.follows = [];
        }

        const follow = this.data.follows.find(f =>
            f.id === mangaId && f.source === source
        );

        if (follow) {
            const oldCount = follow.lastKnownChapter || 0;
            follow.lastKnownChapter = chapterCount;
            follow.lastCheckedAt = new Date().toISOString();

            // Create notification if new chapters available
            if (chapterCount > oldCount && oldCount > 0) {
                const nextChapterToRead = Math.floor(oldCount) + 1;

                this.addNotification({
                    type: 'new_chapter',
                    mangaId: mangaId,
                    source: source,
                    title: follow.title,
                    message: `New chapters available! (${oldCount} → ${chapterCount})`,
                    mangaCover: follow.coverUrl,
                    oldChapter: oldCount,
                    newChapter: chapterCount,
                    nextChapterToRead: nextChapterToRead,
                    sourceUrl: follow.url,
                    createdAt: new Date().toISOString(),
                    read: false
                });
            }

            this.saveData();
        }
    }

    updateMangaChapterCount(mangaId, source, chapterCount) {
        if (!this.data.follows) {
            this.data.follows = [];
        }

        const follow = this.data.follows.find(f =>
            f.id === mangaId && f.source === source
        );

        if (follow) {
            follow.lastKnownChapter = chapterCount;
            follow.lastCheckedAt = new Date().toISOString();
            this.saveData();
        }
    }

    // History management
    removeFromHistory(mangaId, source) {
        this.data.lastRead = this.data.lastRead.filter(item =>
            !(item.id === mangaId && item.source === source)
        );
        this.saveData();
    }

    // Notification system
    addNotification(notification) {
        if (!this.data.notifications) {
            this.data.notifications = [];
        }

        // Check for duplicate notifications (exact same chapter)
        const isDuplicate = this.data.notifications.some(existingNotification => {
            return existingNotification.type === notification.type &&
                existingNotification.mangaId === notification.mangaId &&
                existingNotification.source === notification.source &&
                existingNotification.newChapter === notification.newChapter;
        });

        if (isDuplicate) {
            console.log(`Duplicate notification skipped for ${notification.title} (Ch. ${notification.newChapter})`);
            return false; // Return false to indicate no notification was added
        }

        // Remove older notifications for the same manga to prevent accumulation
        this.data.notifications = this.data.notifications.filter(existingNotification => {
            const isSameManga = existingNotification.type === notification.type &&
                existingNotification.mangaId === notification.mangaId &&
                existingNotification.source === notification.source;

            if (isSameManga) {
                // Keep the notification if it's for a newer chapter than what we're adding
                // or if it's read (user might want to keep read notifications)
                return existingNotification.newChapter > notification.newChapter || existingNotification.read;
            }

            return true; // Keep notifications for other manga
        });

        this.data.notifications.unshift({
            id: Date.now() + Math.random(),
            ...notification
        });

        // Keep only last 100 notifications
        this.data.notifications = this.data.notifications.slice(0, 100);
        this.saveData();

        console.log(`New notification added for ${notification.title} (Ch. ${notification.newChapter})`);
        return true; // Return true to indicate notification was added
    }

    getNotifications(unreadOnly = false) {
        if (!this.data.notifications) {
            this.data.notifications = [];
        }

        if (unreadOnly) {
            return this.data.notifications.filter(n => !n.read);
        }
        return this.data.notifications;
    }

    markNotificationAsRead(notificationId) {
        if (!this.data.notifications) {
            this.data.notifications = [];
        }

        const notification = this.data.notifications.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
            this.saveData();
        }
    }

    markAllNotificationsAsRead() {
        if (!this.data.notifications) {
            this.data.notifications = [];
        }

        this.data.notifications.forEach(n => n.read = true);
        this.saveData();
    }

    getUnreadNotificationCount() {
        if (!this.data.notifications) {
            this.data.notifications = [];
        }

        return this.data.notifications.filter(n => !n.read).length;
    }

    clearAllNotifications() {
        if (!this.data.notifications) {
            this.data.notifications = [];
        }

        this.data.notifications = [];
        this.saveData();
    }

    removeNotification(notificationId) {
        if (!this.data.notifications) {
            this.data.notifications = [];
        }

        this.data.notifications = this.data.notifications.filter(n => n.id !== notificationId);
        this.saveData();
    }

    // Notification check timing methods
    shouldCheckForNotifications() {
        const nextAllowedCheck = this.data.settings?.nextNotificationCheck || 0;
        const now = Date.now(); // Unix timestamp in milliseconds

        return now >= nextAllowedCheck;
    }

    setNextNotificationCheck() {
        if (!this.data.settings) {
            this.data.settings = {};
        }

        const threeHoursInMs = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
        this.data.settings.nextNotificationCheck = Date.now() + threeHoursInMs;
        this.saveData();
    }

    // Source settings methods
    getEnabledSources() {
        if (!this.data.settings) {
            this.data.settings = {};
        }

        // Default to only Comick enabled if no settings exist
        if (!this.data.settings.enabledSources) {
            this.data.settings.enabledSources = ['Comick'];
            this.saveData();
        }

        return this.data.settings.enabledSources;
    }

    setEnabledSources(sources) {
        if (!this.data.settings) {
            this.data.settings = {};
        }

        this.data.settings.enabledSources = sources;
        this.saveData();
    }

    isSourceEnabled(sourceName) {
        const enabledSources = this.getEnabledSources();
        return enabledSources.includes(sourceName);
    }

    enableSource(sourceName) {
        const enabledSources = this.getEnabledSources();
        if (!enabledSources.includes(sourceName)) {
            enabledSources.push(sourceName);
            this.setEnabledSources(enabledSources);
        }
    }

    disableSource(sourceName) {
        const enabledSources = this.getEnabledSources();
        const filtered = enabledSources.filter(source => source !== sourceName);
        this.setEnabledSources(filtered);
    }

    resetSourcesToDefault() {
        this.setEnabledSources(['Comick']);
    }

    // Notification source settings methods
    getEnabledNotificationSources() {
        if (!this.data.settings) {
            this.data.settings = {};
        }

        // Default to all sources enabled for notifications if no settings exist
        if (!this.data.settings.enabledNotificationSources) {
            // Get all available sources as default
            const allSources = ['Comick', 'MangaFire', 'MangaTown', 'ToonTube'];
            this.data.settings.enabledNotificationSources = allSources;
            this.saveData();
        }

        return this.data.settings.enabledNotificationSources;
    }

    setEnabledNotificationSources(sources) {
        if (!this.data.settings) {
            this.data.settings = {};
        }

        this.data.settings.enabledNotificationSources = sources;
        this.saveData();
    }

    isNotificationSourceEnabled(sourceName) {
        const enabledSources = this.getEnabledNotificationSources();
        return enabledSources.includes(sourceName);
    }

    enableNotificationSource(sourceName) {
        const enabledSources = this.getEnabledNotificationSources();
        if (!enabledSources.includes(sourceName)) {
            enabledSources.push(sourceName);
            this.setEnabledNotificationSources(enabledSources);
        }
    }

    disableNotificationSource(sourceName) {
        const enabledSources = this.getEnabledNotificationSources();
        const filtered = enabledSources.filter(source => source !== sourceName);
        this.setEnabledNotificationSources(filtered);
    }

    resetNotificationSourcesToDefault() {
        // Reset to all sources enabled
        const allSources = ['Comick', 'MangaFire', 'MangaTown', 'ToonTube'];
        this.setEnabledNotificationSources(allSources);
    }

    // Check only source manga setting
    getCheckOnlySourceManga() {
        if (!this.data.settings) {
            this.data.settings = {};
        }

        // Default to false (check all enabled sources)
        if (this.data.settings.checkOnlySourceManga === undefined) {
            this.data.settings.checkOnlySourceManga = false;
            this.saveData();
        }

        return this.data.settings.checkOnlySourceManga;
    }

    setCheckOnlySourceManga(enabled) {
        if (!this.data.settings) {
            this.data.settings = {};
        }

        this.data.settings.checkOnlySourceManga = enabled;
        this.saveData();
    }

    // Import/Export functionality
    exportFollowsToCSV() {
        if (!this.data.follows) {
            this.data.follows = [];
        }

        // Create CSV header matching Comick format
        const headers = [
            'hid', 'title', 'type', 'rating', 'origination', 'read', 'last_read',
            'synonyms', 'mal', 'anilist', 'mangaupdates'
        ];

        // Convert follows to CSV rows
        const rows = this.data.follows.map(follow => {
            return [
                follow.id || '',
                `"${(follow.title || '').replace(/"/g, '""')}"`, // Escape quotes
                follow.type || 'Manhwa',
                follow.rating || '0',
                follow.origination || 'Manhwa',
                follow.lastKnownChapter || '0',
                follow.lastReadAt ? follow.lastReadAt.split('T')[0] : '0000-00-00',
                `"${(follow.synonyms || '').replace(/"/g, '""')}"`, // Escape quotes
                follow.mal || '',
                follow.anilist || '',
                follow.mangaupdates || ''
            ].join(',');
        });

        // Combine header and rows
        const csvContent = [headers.join(','), ...rows].join('\n');

        return csvContent;
    }

    importFollowsFromCSV(csvContent) {
        try {
            const lines = csvContent.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                throw new Error('CSV file appears to be empty or invalid');
            }

            // Parse header
            const headers = lines[0].split(',').map(h => h.trim());

            // Validate required columns
            const requiredColumns = ['title'];
            const missingColumns = requiredColumns.filter(col => !headers.includes(col));
            if (missingColumns.length > 0) {
                throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
            }

            const importedFollows = [];
            let importCount = 0;
            let skipCount = 0;

            // Parse data rows
            for (let i = 1; i < lines.length; i++) {
                try {
                    const row = this.parseCSVRow(lines[i]);
                    if (row.length < headers.length) continue; // Skip incomplete rows

                    const followData = {};
                    headers.forEach((header, index) => {
                        followData[header] = row[index] || '';
                    });

                    // Convert to our follow format
                    const follow = {
                        id: followData.hid || followData.title.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                        title: followData.title,
                        url: followData.hid ? `https://comick.io/comic/${followData.hid}` : `https://comick.io/comic/${followData.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
                        coverUrl: null, // Will be filled when manga is accessed
                        source: 'Comick', // Default to Comick for imported items
                        followedAt: new Date().toISOString(),
                        lastCheckedAt: new Date().toISOString(),
                        lastKnownChapter: parseInt(followData.read) || 0,
                        type: followData.type || 'Manhwa',
                        rating: parseFloat(followData.rating) || 0,
                        origination: followData.origination || 'Manhwa',
                        synonyms: followData.synonyms || '',
                        mal: followData.mal || '',
                        anilist: followData.anilist || '',
                        mangaupdates: followData.mangaupdates || '',
                        lastReadAt: followData.last_read && followData.last_read !== '0000-00-00' ?
                            followData.last_read + 'T00:00:00.000Z' : null,
                        // Store reading progress from CSV
                        importedReadingProgress: parseInt(followData.read) > 0 ? {
                            chapterNumber: parseInt(followData.read),
                            isImported: true,
                            sourceSelected: false
                        } : null,
                        // Store status from CSV (type column)
                        status: followData.type || 'Reading'
                    };

                    // Check if already following
                    const existingFollow = this.data.follows.find(f =>
                        f.id === follow.id && f.source === follow.source
                    );

                    if (existingFollow) {
                        // Update existing follow with new data
                        Object.assign(existingFollow, follow);
                        skipCount++;
                    } else {
                        // Add new follow
                        this.data.follows.push(follow);
                        importCount++;
                    }

                    importedFollows.push(follow);
                } catch (rowError) {
                    console.error(`Error parsing row ${i + 1}:`, rowError);
                    skipCount++;
                }
            }

            this.saveData();

            return {
                success: true,
                imported: importCount,
                updated: skipCount,
                total: importedFollows.length,
                message: `Successfully imported ${importCount} new follows and updated ${skipCount} existing ones.`
            };

        } catch (error) {
            console.error('CSV import error:', error);
            return {
                success: false,
                error: error.message,
                message: `Import failed: ${error.message}`
            };
        }
    }

    parseCSVRow(row) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < row.length; i++) {
            const char = row[i];

            if (char === '"') {
                if (inQuotes && row[i + 1] === '"') {
                    // Escaped quote
                    current += '"';
                    i++; // Skip next quote
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // End of field
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        // Add last field
        result.push(current.trim());

        return result;
    }
}

module.exports = Storage;