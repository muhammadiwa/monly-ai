# Monly AI Icons & Favicon

This directory contains all the icons and favicon files for Monly AI.

## Files

- `favicon.svg` - Main favicon (SVG format, scalable)
- `favicon.ico` - Fallback favicon for older browsers (32x32)
- `apple-touch-icon.png` - iOS home screen icon (180x180)
- `og-image.png` - Open Graph image for social media sharing (1200x630)
- `icon-192.png` - PWA icon (192x192)
- `icon-512.png` - PWA icon (512x512)

## Logo Design

The Monly AI logo features:
- Letter "M" in white
- Gradient background from emerald-600 (#059669) to blue-600 (#2563eb)
- Rounded corners (12px border radius)
- Modern, clean design

## Generating Icons

To regenerate all icon sizes from the SVG source:

```bash
# Install sharp (if not already installed)
npm install --save-dev sharp

# Generate all icons
npm run generate:favicon
```

This will create:
- favicon.ico (32x32) - Browser tab icon
- apple-touch-icon.png (180x180) - iOS home screen
- og-image.png (1200x630) - Social media preview
- icon-192.png (192x192) - PWA manifest
- icon-512.png (512x512) - PWA manifest

## Updating the Logo

1. Edit `favicon.svg` with your preferred SVG editor
2. Run `npm run generate:favicon` to regenerate all sizes
3. Test in different browsers and devices

## Browser Support

- Modern browsers: Use `favicon.svg`
- Older browsers: Fallback to `favicon.ico`
- iOS devices: Use `apple-touch-icon.png`
- Social media: Use `og-image.png`
- PWA: Use `icon-192.png` and `icon-512.png`
