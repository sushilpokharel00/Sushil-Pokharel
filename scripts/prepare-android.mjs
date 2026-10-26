import { copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { platform } from 'node:os';

await copyFile('dist/app.html', 'dist/index.html');
if (existsSync('CNAME')) {
  await copyFile('CNAME', 'dist/CNAME');
}

// On Windows (especially OneDrive folders), directories can inherit ReadOnly flags
// which cause Capacitor's rmdir step in 'cap sync' to throw EPERM. Clear them proactively.
if (platform() === 'win32') {
  try {
    if (existsSync('android/app/src/main/assets/public')) {
      execFileSync('attrib', ['-r', 'android\\app\\src\\main\\assets\\public\\*.*', '/s', '/d'], { stdio: 'ignore' });
      execFileSync('attrib', ['-r', 'android\\app\\src\\main\\assets\\public', '/d'], { stdio: 'ignore' });
    }
    if (existsSync('dist')) {
      execFileSync('attrib', ['-r', 'dist\\*.*', '/s', '/d'], { stdio: 'ignore' });
      execFileSync('attrib', ['-r', 'dist', '/d'], { stdio: 'ignore' });
    }
  } catch {
    // Non-fatal if attrib cannot run or paths are empty
  }
}
