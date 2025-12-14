# 🎨 Creating the Vash Reader Icon

## Quick Steps:

1. **Open the icon generator:**
   - Double-click `generate-icon.html` in your browser

2. **Download the icons:**
   - Click "Download 512x512" and save as `assets/icon.png`
   - Click "Download 256x256" and save as `assets/icon@2x.png` (optional)

3. **Rebuild the app:**
   ```bash
   npm run build-win
   ```

## What the icon looks like:
- 📚 **Manga book** with layered pages
- 🔴 **Red accent color** (#ff6b6b) 
- ⚡ **Speed lines** for action/movement
- 👁️ **Eye symbol** for reading
- **"V" shape** for "Vash"
- 🌑 **Dark theme** to match your app

## Alternative: Use any PNG icon
If you have your own icon:
1. Save it as `assets/icon.png` (512x512 recommended)
2. Run `npm run build-win` to rebuild with the new icon

The icon will appear on:
- ✅ Desktop shortcut
- ✅ Taskbar
- ✅ Window title bar
- ✅ Alt+Tab switcher