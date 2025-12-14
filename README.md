# Vash Reader

A local Electron-based manga reader that aggregates content from various sources with a beautiful home page and reading progress tracking.

## ✨ Features

### 🏠 **Home Page**
- **Last Read** - Horizontal scrolling list of recently read manga with navigation arrows
- **Popular** - Trending manga from Comick.dev API with navigation
- **Recent Updates** - Latest chapter updates across all sources
- **Clickable title** - Click "Vash Reader" to return to home page anytime

### 📚 **Reading Experience**
- **Multi-source search** - MangaDex, Mangakakalot, Manganato
- **Chapter browsing** - View all available chapters
- **Page reader** - Clean reading interface with navigation
- **Progress tracking** - Automatically saves reading progress
- **Keyboard shortcuts** - Arrow keys for navigation, Escape to go back

### 💾 **Data Management**
- **Reading history** - Tracks last read manga and chapters
- **Progress sync** - Remembers where you left off
- **Local storage** - All data stored locally for privacy
- **Cover images** - Displays manga cover art throughout the app

## 🚀 Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Run the app:**
```bash
npm start
```

3. **Development mode:**
```bash
npm run dev
```

## 🏗️ Architecture

### **Kotatsu-Inspired Parser System**
```
├── src/
│   ├── main.js              # Electron main process
│   ├── preload.js           # IPC bridge
│   ├── scraper.js           # Main scraper coordinator
│   ├── storage.js           # Local data management
│   ├── parsers/
│   │   ├── base-parser.js       # Abstract base class
│   │   ├── mangadex-parser.js   # MangaDex API integration
│   │   ├── mangakakalot-parser.js # HTML scraper
│   │   ├── manganato-parser.js   # HTML scraper
│   │   ├── comick-parser.js      # Comick.dev API for popular/recent
│   │   └── parser-manager.js     # Manages all parsers
│   └── renderer/
│       ├── index.html       # Main UI with home page
│       ├── styles.css       # Beautiful dark theme
│       └── renderer.js      # Frontend logic with home page
├── package.json
├── test-parsers.js          # Test script
└── README.md
```

## 🔧 Adding New Sources

Just like Kotatsu, adding new manga sources is simple:

1. **Create parser** - Extend `BaseParser` class
2. **Implement methods** - `search()`, `getChapters()`, `getPages()`
3. **Add to manager** - Include in `parser-manager.js`

```javascript
class NewSiteParser extends BaseParser {
    constructor() {
        super('NewSite', 'https://newsite.com');
    }
    
    async search(query) { /* implementation */ }
    async getChapters(mangaUrl) { /* implementation */ }
    async getPages(chapterUrl) { /* implementation */ }
}
```

## 🎯 Data Sources

- **MangaDex** - API-based, high quality
- **Mangakakalot** - HTML scraping, large library
- **Manganato** - HTML scraping, frequent updates
- **Comick.dev** - Popular manga and recent updates

## 📱 Usage

1. **Home Page** - Browse popular, recent, and continue reading
2. **Search** - Find manga across all sources
3. **Read** - Automatic progress tracking and history
4. **Navigate** - Use arrows, keyboard, or click to navigate

## 🔒 Privacy

- All data stored locally
- No external accounts required
- Optional Comick.dev integration for enhanced features
- Respects website rate limits and terms of service

## ⚖️ Legal

This app is for personal use only. Please respect:
- Website terms of service
- Copyright laws in your jurisdiction
- Rate limiting and fair usage
- Support official manga sources when possible