# MobJournal

Vanilla JS Capacitor app. No bundler, no framework, no npm packages in the repo.
GitHub Actions creates the Android project, adds the native SQLite plugin (+ the official Filesystem plugin for screenshots) and builds the APK.

## Layout
- `www/` the whole app (plain ES modules + one CSS file)
  - `js/app.js` boot + router, `js/db.js` bridge to native SQLite, `js/data.js` queries
  - `js/mt5-parser.js` MT5 history report importer, `js/views/*` the four tabs
- `native/JournalDbPlugin.java` tiny plugin over Android's built-in SQLite (no libraries)
- `native/MainActivity.java` registers the plugin, `native/debug.keystore` fixed signing key
- `.github/workflows/build.yml` builds `app-debug.apk` on every push to `main`

## Install
1. Push to `main` (the deploy script does it).
2. GitHub > Actions > latest run > Artifacts > `MobJournal-debug-apk`.
3. The log has a "Show APK size" step with the exact size.

The signing key is fixed, so each new APK installs over the old one and keeps your data.
(Uninstall builds from before this layout once; they were signed with different keys.)

## Journals
Each trading account is a journal (name, optional MT5 account ID, starting balance). Switch from the header on Trades and Dashboard; manage in Settings > Journals. Importing a report sends it to the journal whose MT5 ID matches.

## Import
MT5 desktop > History tab > right-click > Report > HTML. In the app: Settings > Import MT5 history. (A prompt also appears right after you create a journal.)
Re-importing is safe: trades are matched by ticket.
