const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const MangaScraper = require('./scraper');
const Storage = require('./storage');
const ComickParser = require('./parsers/comick-parser');
const ChapterConsensus = require('./utils/chapter-consensus');

let mainWindow;
let mangaScraper;
let storage;
let comickParser;
let chapterConsensus;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile('src/renderer/index.html');

    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }
}

app.whenReady().then(() => {
    // Set up request interceptor for MangaTown images
    const { session } = require('electron');

    session.defaultSession.webRequest.onBeforeSendHeaders(
        { urls: ['*://zjcdn.mangahere.org/*', '*://mangahere.org/*', '*://fmcdn.mangahere.com/*', '*://data.tnlycdn.com/*', '*://mangapark.net/*', '*://manhwaclub.net/*', '*://img01.manga18fx.com/*', '*://img01.manga18.me/*', '*://*.toonilycdnv2.xyz/*', '*://res.mbbcdn.com/*', '*://res.mgcdn.xyz/*', '*://cutiecomics.com/uploads/*', '*://reaper-scans.com/*', '*://*.reaper-scans.com/*', '*://mangahub.io/*', '*://*.mangahub.io/*', '*://readmanga.live/*', '*://*.readmanga.live/*', '*://a.zazaza.me/*', '*://3.readmanga.ru/*', '*://*.grouple.co/*', '*://mangafoxfull.com/*', '*://*.mangafoxfull.com/*', '*://lectortmo.com/*', '*://*.lectortmo.com/*'] },
        (details, callback) => {
            if (details.url.includes('tnlycdn.com')) {
                // Toonily images
                details.requestHeaders['Referer'] = 'https://toonily.com/';
            } else if (details.url.includes('mangapark.net')) {
                // MangaPark images
                details.requestHeaders['Referer'] = 'https://mangapark.net/';
            } else if (details.url.includes('manhwaclub.net') || details.url.includes('manga18fx.com') || details.url.includes('manga18.me')) {
                // ManhwaX images (multiple domains)
                details.requestHeaders['Referer'] = 'https://manhwax.me/';
            } else if (details.url.includes('toonilycdnv2.xyz')) {
                // TooniTube images
                details.requestHeaders['Referer'] = 'https://toonitube.com/';
            } else if (details.url.includes('mbbcdn.com') || details.url.includes('mgcdn.xyz')) {
                // TrueManga images
                details.requestHeaders['Referer'] = 'https://truemanga.com/';
            } else if (details.url.includes('cutiecomics.com')) {
                // CutieComics images
                details.requestHeaders['Referer'] = 'https://cutiecomics.com/';
            } else if (details.url.includes('reaper-scans.com')) {
                // ReaperScans images
                details.requestHeaders['Referer'] = 'https://reaper-scans.com/';
            } else if (details.url.includes('mangahub.io')) {
                // MangaHub images
                details.requestHeaders['Referer'] = 'https://mangahub.io/';
            } else if (details.url.includes('readmanga.live') || details.url.includes('zazaza.me') || details.url.includes('readmanga.ru') || details.url.includes('grouple.co')) {
                // ReadManga/Grouple images
                details.requestHeaders['Referer'] = 'https://readmanga.live/';
            } else if (details.url.includes('mangafoxfull.com')) {
                // MangaFox images
                details.requestHeaders['Referer'] = 'https://mangafoxfull.com/';
            } else if (details.url.includes('lectortmo.com')) {
                // TMOManga images
                details.requestHeaders['Referer'] = 'https://lectortmo.com/';
            } else if (details.url.includes('mangahere.com') || details.url.includes('mangahere.org')) {
                // MangaTown/MangaHere images (including CDN)
                details.requestHeaders['Referer'] = 'https://www.mangatown.com/';
            } else {
                // Default fallback
                details.requestHeaders['Referer'] = 'https://www.mangatown.com/';
            }
            details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
            callback({ requestHeaders: details.requestHeaders });
        }
    );
    mangaScraper = new MangaScraper();
    storage = new Storage();
    comickParser = new ComickParser();
    chapterConsensus = new ChapterConsensus(mangaScraper);
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC handlers for manga operations
ipcMain.handle('search-manga', async (event, query, enabledSources) => {
    try {
        return await mangaScraper.searchManga(query, enabledSources);
    } catch (error) {
        console.error('Search error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('search-by-source', async (event, query, source, page = 1, limit = 50) => {
    try {
        return await mangaScraper.searchBySource(query, source, page, limit);
    } catch (error) {
        console.error('Search by source error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('advanced-search', async (event, filters) => {
    try {
        return await mangaScraper.advancedSearch(filters);
    } catch (error) {
        console.error('Advanced search error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('browse-manga', async (event, enabledSources, limit = 100) => {
    try {
        return await mangaScraper.browseManga(enabledSources, limit);
    } catch (error) {
        console.error('Browse manga error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('get-genres', async (event) => {
    try {
        return await mangaScraper.getGenres();
    } catch (error) {
        console.error('Get genres error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('get-categories', async (event) => {
    try {
        return await mangaScraper.getCategories();
    } catch (error) {
        console.error('Get categories error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('get-chapters', async (event, mangaUrl, source) => {
    try {
        return await mangaScraper.getChapters(mangaUrl, source);
    } catch (error) {
        console.error('Chapters error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('get-pages', async (event, chapterUrl, source, options = {}) => {
    try {
        return await mangaScraper.getPages(chapterUrl, source, options);
    } catch (error) {
        console.error('Pages error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('resolve-page-url', async (event, pageUrl, source) => {
    try {
        return await mangaScraper.resolvePageUrl(pageUrl, source);
    } catch (error) {
        console.error('Resolve page URL error:', error);
        return pageUrl; // Return original URL as fallback
    }
});

ipcMain.handle('load-image-with-referrer', async (event, imageUrl, referrer) => {
    // With the global request interceptor, we can just return the original URL
    // The interceptor will handle adding proper headers for MangaTown images
    return imageUrl;
});

ipcMain.handle('get-sources', async (event) => {
    try {
        return mangaScraper.getAvailableSources();
    } catch (error) {
        console.error('Sources error:', error);
        return { error: error.message };
    }
});

// Home page data handlers
ipcMain.handle('get-popular', async (event, page = 1) => {
    try {
        return await comickParser.getPopular(page, 20);
    } catch (error) {
        console.error('Popular error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('get-recent', async (event, page = 1) => {
    try {
        return await comickParser.getRecent(page, 50);
    } catch (error) {
        console.error('Recent error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('get-trending', async (event, page = 1) => {
    try {
        return await comickParser.getTrending(page, 20);
    } catch (error) {
        console.error('Trending error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('get-newfollow', async (event, page = 1) => {
    try {
        return await comickParser.getNewFollow(page, 20);
    } catch (error) {
        console.error('New follow error:', error);
        return { error: error.message };
    }
});

// Storage handlers
ipcMain.handle('get-last-read', async (event) => {
    try {
        return storage.getLastRead();
    } catch (error) {
        console.error('Last read error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('add-to-last-read', async (event, manga, chapter) => {
    try {
        storage.addToLastRead(manga, chapter);
        return { success: true };
    } catch (error) {
        console.error('Add to last read error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('update-reading-progress', async (event, mangaId, source, chapterNumber, pageNumber, scrollPosition, totalPages) => {
    try {
        storage.updateReadingProgress(mangaId, source, chapterNumber, pageNumber, scrollPosition, totalPages);
        return { success: true };
    } catch (error) {
        console.error('Update progress error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('get-reading-progress', async (event, mangaId, source) => {
    try {
        return storage.getReadingProgress(mangaId, source);
    } catch (error) {
        console.error('Get progress error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('find-manga-sources', async (event, mangaTitle, mangaUrl = null) => {
    try {
        return await mangaScraper.findMangaInAllSources(mangaTitle, mangaUrl);
    } catch (error) {
        console.error('Find manga sources error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('get-manga-details', async (event, mangaUrl) => {
    try {
        return await comickParser.getMangaDetails(mangaUrl);
    } catch (error) {
        console.error('Get manga details error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('get-consensus-chapter-count', async (event, mangaTitle, mangaUrl = null) => {
    try {
        return await chapterConsensus.getQuickChapterCount(mangaTitle, mangaUrl);
    } catch (error) {
        console.error('Error getting consensus chapter count:', error);
        return 0;
    }
});

ipcMain.handle('validate-chapter-count', async (event, reportedCount, mangaTitle, mangaUrl = null) => {
    try {
        return await chapterConsensus.validateChapterCount(reportedCount, mangaTitle, mangaUrl);
    } catch (error) {
        console.error('Error validating chapter count:', error);
        return { isReasonable: true, suggestedCount: reportedCount, confidence: 0 };
    }
});

// Follow system handlers
ipcMain.handle('add-to-follows', async (event, manga) => {
    try {
        storage.addToFollows(manga);
        return { success: true };
    } catch (error) {
        console.error('Add to follows error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('remove-from-follows', async (event, mangaId, source) => {
    try {
        storage.removeFromFollows(mangaId, source);
        return { success: true };
    } catch (error) {
        console.error('Remove from follows error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('get-follows', async (event) => {
    try {
        return storage.getFollows();
    } catch (error) {
        console.error('Get follows error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('is-following', async (event, mangaId, source) => {
    try {
        return storage.isFollowing(mangaId, source);
    } catch (error) {
        console.error('Is following error:', error);
        return false;
    }
});

ipcMain.handle('update-follow-cover-url', async (event, mangaId, source, coverUrl) => {
    try {
        storage.updateFollowCoverUrl(mangaId, source, coverUrl);
        return { success: true };
    } catch (error) {
        console.error('Update follow cover URL error:', error);
        return { error: error.message };
    }
});

// History management
ipcMain.handle('remove-from-history', async (event, mangaId, source) => {
    try {
        storage.removeFromHistory(mangaId, source);
        return { success: true };
    } catch (error) {
        console.error('Remove from history error:', error);
        return { error: error.message };
    }
});

// Notification handlers
ipcMain.handle('get-notifications', async (event, unreadOnly = false) => {
    try {
        return storage.getNotifications(unreadOnly);
    } catch (error) {
        console.error('Get notifications error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('get-unread-notification-count', async (event) => {
    try {
        return storage.getUnreadNotificationCount();
    } catch (error) {
        console.error('Get unread count error:', error);
        return 0;
    }
});

ipcMain.handle('mark-notification-read', async (event, notificationId) => {
    try {
        storage.markNotificationAsRead(notificationId);
        return { success: true };
    } catch (error) {
        console.error('Mark notification read error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('mark-all-notifications-read', async (event) => {
    try {
        storage.markAllNotificationsAsRead();
        return { success: true };
    } catch (error) {
        console.error('Mark all notifications read error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('clear-all-notifications', async (event) => {
    try {
        storage.clearAllNotifications();
        return { success: true };
    } catch (error) {
        console.error('Clear all notifications error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('remove-notification', async (event, notificationId) => {
    try {
        storage.removeNotification(notificationId);
        return { success: true };
    } catch (error) {
        console.error('Remove notification error:', error);
        return { error: error.message };
    }
});

// Check if should run notification check (3-hour cooldown)
ipcMain.handle('should-check-for-notifications', async (event) => {
    try {
        return storage.shouldCheckForNotifications();
    } catch (error) {
        console.error('Should check notifications error:', error);
        return true; // Default to checking if there's an error
    }
});

// Check for new chapters on followed manga
ipcMain.handle('check-for-updates', async (event) => {
    try {
        console.log('Starting manual chapter update check...');

        // Set next allowed check time (current time + 3 hours)
        storage.setNextNotificationCheck();

        const results = await checkForNewChapters();
        console.log('Manual chapter update check completed:', results);
        return results;
    } catch (error) {
        console.error('Check for updates error:', error);
        return { error: error.message };
    }
});

// Smart chapter validation function
function getValidatedLatestChapter(chapters) {
    if (!chapters || chapters.length === 0) {
        return 0;
    }

    // Convert chapter numbers to floats and sort in descending order
    const chapterNumbers = chapters
        .map(ch => parseFloat(ch.number) || 0)
        .filter(num => num > 0)
        .sort((a, b) => b - a);

    if (chapterNumbers.length === 0) {
        return 0;
    }

    // If we have 5 or fewer chapters, just return the highest
    if (chapterNumbers.length <= 5) {
        return chapterNumbers[0];
    }

    // Check the last 5 chapters for logical incrementation
    const last5Chapters = chapterNumbers.slice(0, 5);

    console.log(`🔍 Validating last 5 chapters: [${last5Chapters.join(', ')}]`);

    // Calculate the differences between consecutive chapters
    const differences = [];
    for (let i = 0; i < last5Chapters.length - 1; i++) {
        const diff = last5Chapters[i] - last5Chapters[i + 1];
        differences.push(diff);
    }

    console.log(`📊 Chapter differences: [${differences.join(', ')}]`);

    // Check if the differences are consistent (logical incrementation)
    // Find the most common difference pattern (ignoring outliers)
    const reasonableDifferences = differences.filter(diff => diff <= 10); // Reasonable chapter gaps

    if (reasonableDifferences.length >= 2) {
        const avgReasonableDiff = reasonableDifferences.reduce((sum, diff) => sum + diff, 0) / reasonableDifferences.length;
        const maxReasonableDiff = Math.max(3, avgReasonableDiff * 2); // More conservative threshold

        console.log(`📈 Average reasonable difference: ${avgReasonableDiff.toFixed(2)}, Max reasonable: ${maxReasonableDiff.toFixed(2)}`);

        // Check each chapter from highest to lowest, return first valid one
        for (let i = 0; i < last5Chapters.length - 1; i++) {
            const currentDiff = differences[i];
            if (currentDiff <= maxReasonableDiff) {
                console.log(`✅ Using validated latest chapter: ${last5Chapters[i]}`);
                return last5Chapters[i];
            } else {
                console.log(`⚠️ Skipping outlier chapter: ${last5Chapters[i]} (diff: ${currentDiff.toFixed(2)} > ${maxReasonableDiff.toFixed(2)})`);
            }
        }

        // If all differences are outliers, return the last chapter (most conservative)
        console.log(`⚠️ All chapters seem to be outliers, using most conservative: ${last5Chapters[last5Chapters.length - 1]}`);
        return last5Chapters[last5Chapters.length - 1];
    }

    // If we can't determine a pattern, return the highest (fallback)
    console.log(`✅ Cannot determine pattern, using highest: ${last5Chapters[0]}`);
    return last5Chapters[0];
}

// Chapter update checking function
async function checkForNewChapters() {
    try {
        const follows = storage.getFollows();
        const enabledNotificationSources = storage.getEnabledNotificationSources();

        const results = {
            checked: 0,
            newChapters: 0,
            errors: 0,
            notifications: []
        };

        console.log(`Starting update check for ${follows.length} followed manga...`);
        console.log(`Notification sources enabled: ${enabledNotificationSources.join(', ')} (${enabledNotificationSources.length} total)`);
        console.log(`Check only source manga: ${storage.getCheckOnlySourceManga() ? 'ENABLED' : 'DISABLED'}`);

        // Send initial progress
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-progress', {
                current: 0,
                total: follows.length,
                status: 'Starting update check...'
            });
        }

        // Process manga in batches to avoid overwhelming the servers
        const batchSize = 3;
        for (let i = 0; i < follows.length; i += batchSize) {
            const batch = follows.slice(i, i + batchSize);

            // Process batch in parallel
            const batchPromises = batch.map(async (manga) => {
                try {
                    results.checked++;
                    console.log(`Checking updates for: ${manga.title}`);

                    // Send progress update
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('update-progress', {
                            current: results.checked,
                            total: follows.length,
                            status: `Checking ${manga.title}...`,
                            mangaTitle: manga.title
                        });
                    }

                    // Find sources for this manga
                    const enabledNotificationSources = storage.getEnabledNotificationSources();
                    const checkOnlySourceManga = storage.getCheckOnlySourceManga();

                    let allSources = [];

                    if (checkOnlySourceManga) {
                        // Only check the specific source where the user is reading this manga
                        if (manga.source && manga.source !== 'Unknown') {
                            console.log(`Check only source mode: Using source ${manga.source} for ${manga.title}`);
                            // Create a mock source object for the specific source
                            allSources = [{
                                parserName: manga.source,
                                url: manga.url,
                                title: manga.title
                            }];
                        } else {
                            console.log(`Check only source mode: Skipping ${manga.title} (no specific source)`);
                            return; // Skip manga without a specific source
                        }
                    } else {
                        // Use the normal multi-source search
                        allSources = await mangaScraper.findMangaInAllSources(manga.title, manga.url, enabledNotificationSources);
                    }

                    if (allSources.length === 0) {
                        console.log(`No sources found for ${manga.title}. Check only source: ${checkOnlySourceManga}, Enabled sources: ${enabledNotificationSources.join(', ')}`);
                        return;
                    }

                    console.log(`Checking ${allSources.length} sources for ${manga.title}: ${allSources.map(s => s.parserName).join(', ')}`);

                    // Check each source for new chapters
                    let latestChapterFound = 0;
                    let bestSource = null;

                    for (const source of allSources.slice(0, 3)) { // Check up to 3 sources
                        try {
                            const chapters = await mangaScraper.getChapters(source.url, source.parserName);

                            if (chapters.length > 0) {
                                // Use smart chapter validation instead of simple Math.max
                                const validatedLatestChapter = getValidatedLatestChapter(chapters);

                                if (validatedLatestChapter > latestChapterFound) {
                                    latestChapterFound = validatedLatestChapter;
                                    bestSource = source;
                                }
                            }
                        } catch (error) {
                            console.log(`Failed to check ${source.parserName} for ${manga.title}:`, error.message);
                        }
                    }

                    // Get the actual reading progress (what the user has actually read)
                    let lastReadChapter = 0;

                    // First check regular reading progress
                    try {
                        const progress = storage.getReadingProgress(manga.id, manga.source);
                        if (progress && progress.chapterNumber) {
                            lastReadChapter = parseFloat(progress.chapterNumber) || 0;
                        }
                    } catch (error) {
                        // Continue to check other sources
                    }

                    // If no progress found, check imported progress
                    if (lastReadChapter === 0 && manga.importedReadingProgress && manga.importedReadingProgress.chapterNumber) {
                        lastReadChapter = parseFloat(manga.importedReadingProgress.chapterNumber) || 0;
                    }

                    // Fallback to lastKnownChapter if no reading progress found
                    if (lastReadChapter === 0) {
                        lastReadChapter = manga.lastKnownChapter || 0;
                    }

                    console.log(`${manga.title}: Latest available: ${latestChapterFound}, Last read: ${lastReadChapter}`);

                    if (latestChapterFound > lastReadChapter) {
                        console.log(`New chapters found for ${manga.title}: ${lastReadChapter} -> ${latestChapterFound}`);

                        // Update the manga's last known chapter to the latest available
                        storage.updateMangaChapterCount(manga.id, manga.source, latestChapterFound);

                        // Calculate next chapter to read (last read + 1)
                        const nextChapterToRead = Math.floor(lastReadChapter) + 1;

                        // Create notification
                        const notification = {
                            type: 'new_chapter',
                            mangaId: manga.id,
                            title: manga.title,
                            message: `New chapters available! (${lastReadChapter} → ${latestChapterFound})`,
                            mangaCover: manga.coverUrl,
                            oldChapter: lastReadChapter,
                            newChapter: latestChapterFound,
                            nextChapterToRead: nextChapterToRead,
                            source: bestSource ? bestSource.parserName : 'Unknown',
                            sourceUrl: bestSource ? bestSource.url : null,
                            createdAt: new Date().toISOString(),
                            read: false
                        };

                        const notificationAdded = storage.addNotification(notification);
                        if (notificationAdded) {
                            results.notifications.push(notification);
                            results.newChapters++;
                        }
                    } else {
                        console.log(`No new chapters for ${manga.title} (latest: ${latestChapterFound}, last read: ${lastReadChapter})`);
                    }

                } catch (error) {
                    console.error(`Error checking ${manga.title}:`, error);
                    results.errors++;
                }
            });

            // Wait for batch to complete
            await Promise.all(batchPromises);

            // Small delay between batches to be respectful to servers
            if (i + batchSize < follows.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log(`Update check completed: ${results.checked} checked, ${results.newChapters} new chapters, ${results.errors} errors`);

        // Send completion progress
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-progress', {
                current: follows.length,
                total: follows.length,
                status: `Completed! Found ${results.newChapters} new chapter${results.newChapters !== 1 ? 's' : ''}`,
                completed: true
            });
        }

        return results;

    } catch (error) {
        console.error('Failed to check for new chapters:', error);
        throw error;
    }
}

// Import/Export handlers
ipcMain.handle('export-follows-csv', async (event) => {
    try {
        const csvContent = storage.exportFollowsToCSV();
        return { success: true, csvContent };
    } catch (error) {
        console.error('Export follows CSV error:', error);
        return { error: error.message };
    }
});

ipcMain.handle('import-follows-csv', async (event, csvContent) => {
    try {
        const result = storage.importFollowsFromCSV(csvContent);
        return result;
    } catch (error) {
        console.error('Import follows CSV error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('update-follows-reading-progress', async (event) => {
    try {
        const updated = storage.updateFollowsWithReadingProgress();
        return { success: true, updated };
    } catch (error) {
        console.error('Update follows error:', error);
        return { success: false, error: error.message };
    }
});

// Status management handlers
ipcMain.handle('update-manga-status', async (event, mangaId, source, newStatus) => {
    try {
        const success = storage.updateMangaStatus(mangaId, source, newStatus);
        return { success };
    } catch (error) {
        console.error('Update manga status error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-mangas-by-status', async (event, status) => {
    try {
        const mangas = storage.getMangasByStatus(status);
        return { success: true, mangas };
    } catch (error) {
        console.error('Get mangas by status error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-all-statuses', async (event) => {
    try {
        const statuses = storage.getAllStatuses();
        return { success: true, statuses };
    } catch (error) {
        console.error('Get all statuses error:', error);
        return { success: false, error: error.message };
    }
});

// Source settings handlers
ipcMain.handle('get-enabled-sources', async (event) => {
    try {
        return storage.getEnabledSources();
    } catch (error) {
        console.error('Get enabled sources error:', error);
        return ['Comick']; // Default fallback
    }
});

ipcMain.handle('set-enabled-sources', async (event, sources) => {
    try {
        storage.setEnabledSources(sources);
        return { success: true };
    } catch (error) {
        console.error('Set enabled sources error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('is-source-enabled', async (event, sourceName) => {
    try {
        return storage.isSourceEnabled(sourceName);
    } catch (error) {
        console.error('Is source enabled error:', error);
        return sourceName === 'Comick'; // Default fallback
    }
});

ipcMain.handle('enable-source', async (event, sourceName) => {
    try {
        storage.enableSource(sourceName);
        return { success: true };
    } catch (error) {
        console.error('Enable source error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('disable-source', async (event, sourceName) => {
    try {
        storage.disableSource(sourceName);
        return { success: true };
    } catch (error) {
        console.error('Disable source error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('reset-sources-to-default', async (event) => {
    try {
        storage.resetSourcesToDefault();
        return { success: true };
    } catch (error) {
        console.error('Reset sources to default error:', error);
        return { success: false, error: error.message };
    }
});

// Notification source settings handlers
ipcMain.handle('get-enabled-notification-sources', async (event) => {
    try {
        return storage.getEnabledNotificationSources();
    } catch (error) {
        console.error('Get enabled notification sources error:', error);
        return ['Comick', 'MangaFire', 'MangaTown', 'ToonTube']; // Default fallback
    }
});

ipcMain.handle('set-enabled-notification-sources', async (event, sources) => {
    try {
        storage.setEnabledNotificationSources(sources);
        return { success: true };
    } catch (error) {
        console.error('Set enabled notification sources error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('is-notification-source-enabled', async (event, sourceName) => {
    try {
        return storage.isNotificationSourceEnabled(sourceName);
    } catch (error) {
        console.error('Is notification source enabled error:', error);
        return true; // Default fallback - enable all by default
    }
});

ipcMain.handle('enable-notification-source', async (event, sourceName) => {
    try {
        storage.enableNotificationSource(sourceName);
        return { success: true };
    } catch (error) {
        console.error('Enable notification source error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('disable-notification-source', async (event, sourceName) => {
    try {
        storage.disableNotificationSource(sourceName);
        return { success: true };
    } catch (error) {
        console.error('Disable notification source error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('reset-notification-sources-to-default', async (event) => {
    try {
        storage.resetNotificationSourcesToDefault();
        return { success: true };
    } catch (error) {
        console.error('Reset notification sources to default error:', error);
        return { success: false, error: error.message };
    }
});

// Check only source manga setting handlers
ipcMain.handle('get-check-only-source-manga', async (event) => {
    try {
        return storage.getCheckOnlySourceManga();
    } catch (error) {
        console.error('Get check only source manga error:', error);
        return false; // Default fallback
    }
});

ipcMain.handle('set-check-only-source-manga', async (event, enabled) => {
    try {
        storage.setCheckOnlySourceManga(enabled);
        return { success: true };
    } catch (error) {
        console.error('Set check only source manga error:', error);
        return { success: false, error: error.message };
    }
});