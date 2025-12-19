const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mangaAPI', {
    // Search and reading
    searchManga: (query, enabledSources) => ipcRenderer.invoke('search-manga', query, enabledSources),
    searchBySource: (query, source, page, limit) => ipcRenderer.invoke('search-by-source', query, source, page, limit),
    advancedSearch: (filters) => ipcRenderer.invoke('advanced-search', filters),
    getGenres: () => ipcRenderer.invoke('get-genres'),
    getCategories: () => ipcRenderer.invoke('get-categories'),
    getChapters: (mangaUrl, source) => ipcRenderer.invoke('get-chapters', mangaUrl, source),
    getPages: (chapterUrl, source) => ipcRenderer.invoke('get-pages', chapterUrl, source),
    resolvePageUrl: (pageUrl, source) => ipcRenderer.invoke('resolve-page-url', pageUrl, source),
    loadImageWithReferrer: (imageUrl, referrer) => ipcRenderer.invoke('load-image-with-referrer', imageUrl, referrer),
    getSources: () => ipcRenderer.invoke('get-sources'),

    // Home page data
    getPopular: (page) => ipcRenderer.invoke('get-popular', page),
    getRecent: (page) => ipcRenderer.invoke('get-recent', page),
    getTrending: (page) => ipcRenderer.invoke('get-trending', page),
    getNewFollow: (page) => ipcRenderer.invoke('get-newfollow', page),

    // Storage
    getLastRead: () => ipcRenderer.invoke('get-last-read'),
    addToLastRead: (manga, chapter) => ipcRenderer.invoke('add-to-last-read', manga, chapter),
    updateReadingProgress: (mangaId, source, chapterNumber, pageNumber, scrollPosition, totalPages) =>
        ipcRenderer.invoke('update-reading-progress', mangaId, source, chapterNumber, pageNumber, scrollPosition, totalPages),
    getReadingProgress: (mangaId, source) => ipcRenderer.invoke('get-reading-progress', mangaId, source),
    findMangaSources: (mangaTitle, mangaUrl) => ipcRenderer.invoke('find-manga-sources', mangaTitle, mangaUrl),
    getMangaDetails: (mangaUrl) => ipcRenderer.invoke('get-manga-details', mangaUrl),
    getConsensusChapterCount: (mangaTitle, mangaUrl) => ipcRenderer.invoke('get-consensus-chapter-count', mangaTitle, mangaUrl),
    validateChapterCount: (reportedCount, mangaTitle, mangaUrl) => ipcRenderer.invoke('validate-chapter-count', reportedCount, mangaTitle, mangaUrl),

    // Follow system
    addToFollows: (manga) => ipcRenderer.invoke('add-to-follows', manga),
    removeFromFollows: (mangaId, source) => ipcRenderer.invoke('remove-from-follows', mangaId, source),
    getFollows: () => ipcRenderer.invoke('get-follows'),
    isFollowing: (mangaId, source) => ipcRenderer.invoke('is-following', mangaId, source),
    updateFollowCoverUrl: (mangaId, source, coverUrl) => ipcRenderer.invoke('update-follow-cover-url', mangaId, source, coverUrl),

    // History management
    removeFromHistory: (mangaId, source) => ipcRenderer.invoke('remove-from-history', mangaId, source),

    // Notifications
    getNotifications: (unreadOnly) => ipcRenderer.invoke('get-notifications', unreadOnly),
    getUnreadNotificationCount: () => ipcRenderer.invoke('get-unread-notification-count'),
    markNotificationRead: (notificationId) => ipcRenderer.invoke('mark-notification-read', notificationId),
    markAllNotificationsRead: () => ipcRenderer.invoke('mark-all-notifications-read'),
    clearAllNotifications: () => ipcRenderer.invoke('clear-all-notifications'),
    removeNotification: (notificationId) => ipcRenderer.invoke('remove-notification', notificationId),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    shouldCheckForNotifications: () => ipcRenderer.invoke('should-check-for-notifications'),

    // Import/Export
    exportFollowsCSV: () => ipcRenderer.invoke('export-follows-csv'),
    importFollowsCSV: (csvContent) => ipcRenderer.invoke('import-follows-csv', csvContent),
    updateFollowsReadingProgress: () => ipcRenderer.invoke('update-follows-reading-progress'),

    // Status management
    updateMangaStatus: (mangaId, source, newStatus) => ipcRenderer.invoke('update-manga-status', mangaId, source, newStatus),
    getMangasByStatus: (status) => ipcRenderer.invoke('get-mangas-by-status', status),
    getAllStatuses: () => ipcRenderer.invoke('get-all-statuses'),

    // Source settings
    getEnabledSources: () => ipcRenderer.invoke('get-enabled-sources'),
    setEnabledSources: (sources) => ipcRenderer.invoke('set-enabled-sources', sources),
    isSourceEnabled: (sourceName) => ipcRenderer.invoke('is-source-enabled', sourceName),
    enableSource: (sourceName) => ipcRenderer.invoke('enable-source', sourceName),
    disableSource: (sourceName) => ipcRenderer.invoke('disable-source', sourceName),
    resetSourcesToDefault: () => ipcRenderer.invoke('reset-sources-to-default')
});