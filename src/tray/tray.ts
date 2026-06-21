import fs from 'fs';
import path from 'path';

// node-systray is CommonJS; import with require to avoid ESM/CJS interop issues
const Systray = require('node-systray').default;

const ICON_REL_PATH = path.join(__dirname, '..', 'assets', 'icon.png');

function loadIconBase64(iconPath: string) {
  if (!fs.existsSync(iconPath)) {
    console.warn('Tray icon not found at', iconPath, "— place an icon at src/assets/icon.png and restart the tray.");
    return '';
  }
  return fs.readFileSync(iconPath).toString('base64');
}

export default function startTray() {
  const iconBase64 = loadIconBase64(ICON_REL_PATH);

  // menu structure: adjust titles/actions as needed
  const systray = new Systray({
    menu: {
      icon: iconBase64,
      title: 'RL Data Engine',
      tooltip: 'RL Data Engine — inactive',
      items: [
        { title: 'Show status', tooltip: 'Show status (not implemented)', enabled: true },
        { title: 'Open logs', tooltip: 'Open logs folder', enabled: true },
        { title: '-' },
        { title: 'Quit', tooltip: 'Quit the app', enabled: true }
      ]
    }
  });

  systray.onClick((action: any) => {
    const item = action?.data?.menuItem;
    const title = item?.title;
    if (!title) return;

    if (title === 'Open logs') {
      // open logs folder on Windows
      try {
        const { exec } = require('child_process');
        exec('explorer.exe .\\logs');
      } catch (e) {
        console.error('Failed to open logs folder', e);
      }
    } else if (title === 'Quit') {
      systray.kill();
      process.exit(0);
    } else if (title === 'Show status') {
      // Toggle tooltip or show a message in console -- extend as needed
      console.log('RL Data Engine: active');
      try {
        systray.sendAction({ type: 'update', menu: { tooltip: 'RL Data Engine — active' } });
      } catch (e) {
        // some versions/OS may not support sendAction; ignore
      }
    }
  });

  process.on('exit', () => systray.kill());
  process.on('SIGINT', () => { systray.kill(); process.exit(0); });
  process.on('SIGTERM', () => { systray.kill(); process.exit(0); });

  console.log('Tray started (src/tray/tray.ts)');
  return systray;
}

// If tray started directly (node ./dist/src/tray/tray.js), auto-start
if (require.main === module) {
  startTray();
}
