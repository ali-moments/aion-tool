# Electron Desktop Application

This directory contains the Electron wrapper that allows the application to run as a desktop executable.

## How It Works

The Electron application:
1. Starts a Node.js server (using `npm run preview`) as a child process
2. Opens a browser window pointing to `http://localhost:8081`
3. Manages the server lifecycle (starts on launch, stops on quit)

## Development

To test the Electron app in development:

```bash
# First, build the application
npm run build

# Then run the Electron app
npm run electron:dev
```

## Building Executables

### Windows

```bash
npm run electron:build
```

This will create a Windows installer in the `release/` directory.

### All Platforms

```bash
npm run electron:build:all
```

This builds for Windows, macOS, and Linux (requires appropriate build tools).

## Files

- `main.js` - The main Electron process, creates windows and manages the app lifecycle
- `server.js` - Server management module, handles starting/stopping the Node.js server
- `preload.js` - Security-enhanced preload script (optional)

## Configuration

The Electron builder configuration is in `package.json` under the `"build"` key.

### Customization

- **App Name**: Change `productName` in package.json
- **App ID**: Change `appId` in package.json (use reverse domain notation)
- **Icon**: Replace `public/icon.png` with your app icon (must be PNG, 512x512 or larger)
- **Window Size**: Modify width/height in `main.js`

## Troubleshooting

### Server Won't Start

If the app shows an error about the server not starting:
1. Make sure you've run `npm run build` first
2. Check that port 8081 is not already in use
3. Look at the console output for error messages

### White Screen

If you see a white screen:
1. Open DevTools (View > Toggle Developer Tools)
2. Check the Console tab for errors
3. Verify the server is running on port 8081

### Build Fails

If `electron-builder` fails:
- On Windows: Make sure you have Windows Build Tools installed
- On macOS: Make sure you have Xcode Command Line Tools
- On Linux: Make sure you have required packages (see electron-builder docs)
