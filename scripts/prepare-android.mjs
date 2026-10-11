import { copyFile } from 'node:fs/promises';

await copyFile('dist/app.html', 'dist/index.html');
