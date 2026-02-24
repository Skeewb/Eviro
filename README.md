# Notes & Tasks Manager

A modern desktop application for managing notes and tasks, built with Electron and React.

## Features

- 📝 **Notes**: Create and manage text notes with auto-save
- ✓ **Tasks**: Track tasks with due dates and completion status
- 💾 **Persistent Storage**: All data is saved locally on your machine
- 🎨 **Modern UI**: Clean and intuitive interface
- ⌨️ **Keyboard Shortcuts**: Ctrl+S to save (Cmd+S on Mac)

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Steps

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development mode**:
   ```bash
   npm run electron-dev
   ```
   This will start both the React dev server and Electron app.

3. **Build for production**:
   ```bash
   npm run build
   ```
   This creates an installer in the `dist/` folder.

## Usage

### Notes Tab
- Click **+ New Note** to create a note
- Type in the editor area
- Press **Save** or use Ctrl+S
- Click **✕** to delete a note

### Tasks Tab
- Click **+ New Task** to create a task
- Set title, description, and due date
- Check the box to mark as complete
- Save changes with **Save** button or Ctrl+S
- Click **✕** to delete a task

## Data Storage

All data is stored in:
- **Windows**: `C:\Users\[YourName]\.notes-tasks-manager\`
- **Mac**: `/Users/[YourName]/.notes-tasks-manager/`
- **Linux**: `/home/[YourName]/.notes-tasks-manager/`

Files:
- `notes.json` - All your notes
- `tasks.json` - All your tasks

## Development

### Project Structure
```
App/
├── public/
│   ├── electron.js      # Main Electron process
│   ├── preload.js       # IPC bridge for data access
│   ├── index.html       # HTML template
├── src/
│   ├── App.js           # Main React component
│   ├── components/      # React components
│   └── index.js         # React entry point
└── package.json         # Dependencies and scripts
```

### Available Scripts

- `npm run react-start` - Start React dev server
- `npm run electron-start` - Start Electron app
- `npm run electron-dev` - Start both (dev mode)
- `npm run react-build` - Build React app
- `npm run build` - Build Electron app

## Auto Updates

This app now includes auto-update wiring via `electron-updater` in `public/electron.js`.

### How it works
- Update checks run only in packaged production builds (not in `electron-dev`).
- On app launch, it checks for updates.
- If found, update downloads in background.
- After download, app prompts to restart and install.

### Update source
You can configure updates in one of two ways:

1. **electron-builder publish config** in `package.json` (`build.publish`), or
2. Runtime env var for generic feed URL:
   - `EVIRO_UPDATE_URL=https://your-server/updates`

If neither is configured, checks will fail safely and log an updater error in the main process console.

## Troubleshooting

**Electron doesn't start in dev mode:**
- Wait for React to start on http://localhost:3000 first
- Check that port 3000 is not in use

**Data not persisting:**
- Check the data storage directory exists
- Ensure write permissions to the directory

**Build fails:**
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again
- Try `npm run build`

## License

MIT
