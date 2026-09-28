// Shield marker matching IntegratedLogoDetector's 32 sample positions.
// Usage: node tools/helmet-marker.cjs MOTO-01D44 public/helmet-logo-MOTO-01D44.svg
const fs = require('node:fs');
const path = require('node:path');
const id = (process.argv[2] || '').toUpperCase();
if (!/^MOTO-[0-3][0-9A-F]{4}$/.test(id) || !process.argv[3]) {
  throw new Error('Provide an 18-bit MOTO-xxxxx ID and output SVG path');
}
const value = parseInt(id.slice(5), 16);
const checksum = (((value & 255) + ((value >>> 8) & 255) + ((value >>> 16) & 255)) ^ 0xaa) & 255;
const bits = [1, 0, 1, 0, 1, 1];
for (let i = 17; i >= 0; i--) bits.push((value >>> i) & 1);
for (let i = 7; i >= 0; i--) bits.push((checksum >>> i) & 1);
// Read the geometry directly from the detector to prevent artwork drift.
const detector = fs.readFileSync(path.join(__dirname, '../MotoLock_Native/app/src/main/java/com/example/motolock/data/LogoIdentityDetector.kt'), 'utf8');
const outline = [...detector.matchAll(/floatArrayOf\((\d+)f,\s*(\d+)f\)/g)].map(m => [+m[1], +m[2]]);
if (outline.length !== 33) throw new Error('Unexpected detector shield geometry');
const lengths = outline.slice(1).map((p, i) => Math.hypot(p[0] - outline[i][0], p[1] - outline[i][1]));
const perimeter = lengths.reduce((a, b) => a + b, 0);
const green = '#80FF80';
const slots = bits.map((bit, i) => {
  let distance = perimeter * (i + 0.5) / 32;
  let segment = 0;
  while (segment < lengths.length - 1 && distance > lengths[segment]) distance -= lengths[segment++];
  const a = outline[segment], b = outline[segment + 1];
  const t = distance / lengths[segment];
  const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
  return `<rect data-slot="${i}" data-bit="${bit}" x="-6" y="-9" width="12" height="18" fill="${bit ? 'none' : '#FFFFFF'}" transform="translate(${x.toFixed(4)} ${y.toFixed(4)}) rotate(${angle.toFixed(4)})"/>`;
}).join('\n');
const logo = fs.readFileSync(path.join(__dirname, '../public/logo.png')).toString('base64');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="56mm" height="66mm" viewBox="48 12 396 466.7143">
<title>MotoLock ${id} encoded helmet sticker</title>
<desc>32 shield slots: ${bits.join('')}. Bright green background. Print at actual size; keep upright.</desc>
<rect x="48" y="12" width="396" height="466.7143" fill="${green}"/>
<image x="0" y="0" width="514" height="486" xlink:href="data:image/png;base64,${logo}"/>
${slots}
</svg>\n`;
fs.writeFileSync(process.argv[3], svg);
console.log(`${id}: ${bits.join('')} (checksum ${checksum.toString(16).toUpperCase()}); print 56 × 66 mm at 100%.`);
