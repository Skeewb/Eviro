# Auto Update Setup (No Server Required)

This app is configured for `electron-updater` using a **generic** update feed.

## 1. Pick a static file host

Use any HTTPS static hosting:

- Cloudflare R2 public bucket
- AWS S3 (public objects)
- Bunny storage
- Backblaze B2 public bucket

You need a URL like:

`https://your-host.example.com/eviro/win`

## 2. Configure update URL in your build/runtime

Set environment variable before launching packaged app:

`EVIRO_UPDATE_URL=https://your-host.example.com/eviro/win`

Notes:
- If this is not set (or still `example.com`), updates stay disabled.
- You can also hardcode this URL in `package.json` `build.publish[0].url`.

## 3. Build a release

1. Bump version in `package.json` (e.g. `1.0.0` -> `1.0.1`)
2. Run:

`npm run release`

This creates files in `dist/` including:

- `latest.yml`
- `Eviro Setup <version>.exe`
- `Eviro Setup <version>.exe.blockmap`

## 4. Upload files to update URL folder

Upload the 3 files above into:

`https://your-host.example.com/eviro/win/`

Keep old installers available when possible.

## 5. Client update behavior

- On app open, it checks for updates automatically.
- If found, it downloads in background.
- User gets a restart prompt when ready.

## Quick checklist per update

1. Bump version
2. `npm run release`
3. Upload `latest.yml` + installer + blockmap
4. Done
