import { app, Menu, Tray, nativeImage } from 'electron';
import path from 'node:path';
import { signIn } from './supabase';
import { startScheduler } from './scheduler';
import {
  listActiveMedications,
  logPillTaken,
  logStandingDesk,
  logWalkingPad,
  logWater,
} from './quickLog';

app.dock?.hide(); // menu-bar-only, no dock icon on macOS

let tray: Tray | null = null;

app.whenReady().then(async () => {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, '../src/assets/tray-icon.png'),
  );
  tray = new Tray(icon);
  tray.setToolTip('Pulsr');

  await signIn();
  await buildMenu();
  startScheduler();
});

async function buildMenu(): Promise<void> {
  if (!tray) return;
  const medications = await listActiveMedications().catch(() => []);

  const menu = Menu.buildFromTemplate([
    { label: 'Drink water', click: () => logWater().catch(console.error) },
    { label: 'Stood up', click: () => logStandingDesk().catch(console.error) },
    {
      label: 'Used walking pad',
      click: () => logWalkingPad().catch(console.error),
    },
    { type: 'separator' },
    ...(medications.length > 0
      ? [
          {
            label: 'Took pill',
            submenu: medications.map((med) => ({
              label: med.name,
              click: () => logPillTaken(med.id, med.name).catch(console.error),
            })),
          },
        ]
      : []),
    { type: 'separator' },
    { label: 'Refresh menu', click: () => buildMenu() },
    { label: 'Quit Pulsr', role: 'quit' },
  ] as Electron.MenuItemConstructorOptions[]);

  tray.setContextMenu(menu);
}

// Stay running in the tray instead of quitting when all windows close (there are none).
app.on('window-all-closed', () => undefined);
