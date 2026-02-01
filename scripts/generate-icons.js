// Script to generate PWA icons
// Run with: node scripts/generate-icons.js

import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');

const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2563eb"/>
      <stop offset="100%" style="stop-color:#1d4ed8"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="80" fill="url(#bg)"/>
  <g transform="translate(96, 96)" fill="white">
    <path d="M128 32c-10.6 0-19.1 8.6-19.1 19.2V288c0 10.6 8.5 19.2 19.1 19.2h48c10.6 0 19.2-8.6 19.2-19.2V51.2c0-10.6-8.6-19.2-19.2-19.2h-48zM48 96c-10.6 0-19.1 8.6-19.1 19.2V288c0 10.6 8.5 19.2 19.1 19.2h48c10.6 0 19.2-8.6 19.2-19.2V115.2c0-10.6-8.6-19.2-19.2-19.2H48zM208 96c-10.6 0-19.1 8.6-19.1 19.2V288c0 10.6 8.5 19.2 19.1 19.2h48c10.6 0 19.2-8.6 19.2-19.2V115.2c0-10.6-8.6-19.2-19.2-19.2h-48z"/>
    <circle cx="160" cy="280" r="24" fill="white" opacity="0.8"/>
  </g>
</svg>`;

const sizes = [192, 512];

async function generateIcons() {
  try {
    await mkdir(publicDir, { recursive: true });
    
    for (const size of sizes) {
      const buffer = Buffer.from(svgIcon);
      await sharp(buffer)
        .resize(size, size)
        .png()
        .toFile(join(publicDir, `pwa-${size}x${size}.png`));
      console.log(`Generated pwa-${size}x${size}.png`);
    }
    
    // Generate apple-touch-icon
    await sharp(Buffer.from(svgIcon))
      .resize(180, 180)
      .png()
      .toFile(join(publicDir, 'apple-touch-icon.png'));
    console.log('Generated apple-touch-icon.png');
    
    // Generate favicon
    await sharp(Buffer.from(svgIcon))
      .resize(32, 32)
      .png()
      .toFile(join(publicDir, 'favicon.ico'));
    console.log('Generated favicon.ico');
    
    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();
