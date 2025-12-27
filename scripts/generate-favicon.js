/**
 * Script to generate favicon.ico and other icon sizes from favicon.svg
 * 
 * This script requires sharp package:
 * npm install --save-dev sharp
 * 
 * Run: node scripts/generate-favicon.js
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is installed
let sharp;
try {
    sharp = require('sharp');
} catch (error) {
    console.error('❌ Sharp is not installed. Please run: npm install --save-dev sharp');
    process.exit(1);
}

const svgPath = path.join(__dirname, '../client/public/favicon.svg');
const publicDir = path.join(__dirname, '../client/public');

async function generateIcons() {
    try {
        console.log('📦 Generating favicon and icons...\n');

        // Read SVG
        const svgBuffer = fs.readFileSync(svgPath);

        // Generate favicon.ico (32x32)
        await sharp(svgBuffer)
            .resize(32, 32)
            .toFile(path.join(publicDir, 'favicon.ico'));
        console.log('✅ Generated favicon.ico (32x32)');

        // Generate apple-touch-icon.png (180x180)
        await sharp(svgBuffer)
            .resize(180, 180)
            .toFile(path.join(publicDir, 'apple-touch-icon.png'));
        console.log('✅ Generated apple-touch-icon.png (180x180)');

        // Generate og-image.png (1200x630) for social media
        await sharp(svgBuffer)
            .resize(1200, 630, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .toFile(path.join(publicDir, 'og-image.png'));
        console.log('✅ Generated og-image.png (1200x630)');

        // Generate icon-192.png for PWA
        await sharp(svgBuffer)
            .resize(192, 192)
            .toFile(path.join(publicDir, 'icon-192.png'));
        console.log('✅ Generated icon-192.png (192x192)');

        // Generate icon-512.png for PWA
        await sharp(svgBuffer)
            .resize(512, 512)
            .toFile(path.join(publicDir, 'icon-512.png'));
        console.log('✅ Generated icon-512.png (512x512)');

        console.log('\n🎉 All icons generated successfully!');
        console.log('\n📝 Files created:');
        console.log('   - favicon.ico (32x32)');
        console.log('   - apple-touch-icon.png (180x180)');
        console.log('   - og-image.png (1200x630)');
        console.log('   - icon-192.png (192x192)');
        console.log('   - icon-512.png (512x512)');

    } catch (error) {
        console.error('❌ Error generating icons:', error);
        process.exit(1);
    }
}

generateIcons();
