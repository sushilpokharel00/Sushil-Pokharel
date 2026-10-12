import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const favicon = await readFile(new URL('../favicon.svg', import.meta.url), 'utf8');
const pngMatch = favicon.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);

if (!pngMatch) {
  throw new Error('favicon.svg must contain the PNG portrait used for the app icon.');
}

const portrait = Buffer.from(pngMatch[1], 'base64');
const waveOverlay = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <path d="M0 350c88-49 166 39 256-1s169-45 256-5v168H0z" fill="#315648" fill-opacity=".92"/>
    <path d="M0 350c88-49 166 39 256-1s169-45 256-5" fill="none" stroke="#eaf1ed" stroke-width="10" stroke-linecap="round"/>
    <path d="M0 385c88-39 166 39 256 1s169-37 256 0v126H0z" fill="#426b5e" fill-opacity=".9"/>
  </svg>
`);
const densities = [
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
];

async function createArtwork(size) {
  return sharp(portrait)
    .resize(size, size, { fit: 'cover', position: 'attention' })
    .composite([{ input: await sharp(waveOverlay).resize(size, size).png().toBuffer() }])
    .png()
    .toBuffer();
}

async function applyMask(image, size, shape) {
  const radius = Math.round(size * 0.22);
  const maskShape = shape === 'circle'
    ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>`
    : `<rect width="${size}" height="${size}" rx="${radius}" fill="white"/>`;
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${maskShape}</svg>`,
  );

  return sharp(image)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

for (const [density, size] of densities) {
  const directory = fileURLToPath(new URL(`../android/app/src/main/res/mipmap-${density}/`, import.meta.url));
  await mkdir(directory, { recursive: true });

  const artwork = await createArtwork(size);
  await sharp(await applyMask(artwork, size, 'rounded')).toFile(join(directory, 'ic_launcher.png'));
  await sharp(await applyMask(artwork, size, 'circle')).toFile(join(directory, 'ic_launcher_round.png'));

  const adaptiveSize = size * 2.25;
  const foregroundSize = Math.round(adaptiveSize * 0.68);
  const foregroundArtwork = await createArtwork(foregroundSize);
  const foregroundIcon = await sharp({
    create: {
      width: adaptiveSize,
      height: adaptiveSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{
      input: await applyMask(foregroundArtwork, foregroundSize, 'circle'),
      left: Math.round((adaptiveSize - foregroundSize) / 2),
      top: Math.round((adaptiveSize - foregroundSize) / 2),
    }])
    .png()
    .toBuffer();

  await sharp(foregroundIcon).toFile(join(directory, 'ic_launcher_foreground.png'));
}
