// Trim the black background and produce a transparent white "KALA" wordmark.
// Usage: node scripts/make-logo.mjs
import sharp from 'sharp'

const INPUT = process.argv[2] || 'C:/Users/Usuario/Downloads/WhatsApp Image 2026-06-21 at 2.50.46 PM.jpeg'

// 1. Trim the solid black border down to the wordmark bounding box.
const trimmed = await sharp(INPUT).trim().toBuffer()
const { width, height } = await sharp(trimmed).metadata()

// 2. Use luminance as the alpha channel (white letters -> opaque, black -> transparent),
//    and paint everything white so the mark works on any dark surface.
const alpha = await sharp(trimmed).greyscale().toColourspace('b-w').raw().toBuffer()

await sharp({ create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } } })
  .joinChannel(alpha, { raw: { width, height, channels: 1 } })
  .png()
  .toFile('public/kala-logo.png')

console.log(`✅ public/kala-logo.png  (${width}x${height}, transparent)`)
