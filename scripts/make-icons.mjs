// Genera los iconos de la app (PNG) y el favicon (SVG) a partir del logo B.
// Uso: node scripts/make-icons.mjs   (necesita `sharp`, instalado como devDependency)
import { mkdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const tile = (padding) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-padding} ${-padding} ${200 + padding * 2} ${200 + padding * 2}">
  <rect x="${-padding}" y="${-padding}" width="${200 + padding * 2}" height="${200 + padding * 2}" rx="${padding ? 0 : 44}" fill="#2f6f5e"/>
  <circle cx="100" cy="46" r="15" fill="#e9b949"/>
  <circle cx="100" cy="46" r="8" fill="none" stroke="#ffffff" stroke-width="4"/>
  <circle cx="60" cy="72" r="13" fill="#dcefe8"/>
  <rect x="38" y="74" width="124" height="82" rx="41" fill="#dcefe8"/>
  <rect x="88" y="84" width="26" height="7" rx="3.5" fill="#2f6f5e"/>
  <circle cx="128" cy="104" r="4.5" fill="#2f6f5e"/>
  <circle cx="152" cy="118" r="15" fill="#b3a6e6"/>
  <circle cx="147" cy="116" r="2.6" fill="#ffffff"/>
  <circle cx="157" cy="116" r="2.6" fill="#ffffff"/>
  <rect x="60" y="146" width="20" height="20" rx="7" fill="#dcefe8"/>
  <rect x="118" y="146" width="20" height="20" rx="7" fill="#dcefe8"/>
</svg>`

mkdirSync('public/icons', { recursive: true })

// Favicon: baldosa redondeada (los navegadores no recortan)
writeFileSync('public/favicon.svg', tile(0).trim())

// Iconos "any": baldosa con esquinas redondeadas
for (const size of [192, 512]) {
  await sharp(Buffer.from(tile(0))).resize(size, size).png().toFile(`public/icons/icon-${size}.png`)
}
// iOS: sin esquinas redondeadas (iOS las pone), con un poco de margen
await sharp(Buffer.from(tile(20))).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png')
// Maskable (Android): zona segura amplia
await sharp(Buffer.from(tile(40))).resize(512, 512).png().toFile('public/icons/maskable-512.png')

console.log('iconos generados en public/icons')
