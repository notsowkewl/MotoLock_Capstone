// Generate the 18-bit visual identity expected by LogoEncoder/LogoIdentityDetector.
// Usage: node tools/helmet-marker.cjs MOTO-0007B output.svg
const fs = require('node:fs');
const id = (process.argv[2] || '').toUpperCase();
if (!/^MOTO-[0-3][0-9A-F]{4}$/.test(id) || !process.argv[3]) {
  throw new Error('Usage: node tools/helmet-marker.cjs MOTO-xxxxx output.svg (use the paired helmet ID)');
}
const value = parseInt(id.slice(5), 16);
const checksum = (((value & 255) + ((value >>> 8) & 255) + ((value >>> 16) & 255)) ^ 0xaa) & 255;
const bits = [1, 0, 1, 0, 1, 1];
for (let i = 17; i >= 0; --i) bits.push((value >>> i) & 1);
for (let i = 7; i >= 0; --i) bits.push((checksum >>> i) & 1);
const point = (r, a) => `${(120 + r * Math.cos(a)).toFixed(4)},${(120 + r * Math.sin(a)).toFixed(4)}`;
const sectors = bits.map((bit, i) => {
  if (!bit) return '';
  const a = 2 * Math.PI * (i - 0.5) / 32;
  const b = 2 * Math.PI * (i + 0.5) / 32;
  return `<path d="M${point(76, a)} L${point(94, a)} A94,94 0 0 1 ${point(94, b)} L${point(76, b)} A76,76 0 0 0 ${point(76, a)} Z"/>`;
}).join('\n');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="60mm" height="60mm" viewBox="0 0 240 240">
<title>${id}</title><rect width="240" height="240" fill="white"/>
<circle cx="120" cy="120" r="98" stroke="black" stroke-width="4" fill="none"/>
<g fill="black">${sectors}</g>
<circle cx="120" cy="120" r="62" stroke="black" stroke-width="2" fill="none"/>
<text x="120" y="124" text-anchor="middle" font-family="sans-serif" font-size="12">${id}</text>
</svg>\n`;
fs.writeFileSync(process.argv[3], svg, { flag: 'wx' });
console.log(`Created ${process.argv[3]} for ${id}; print at 100% (outer ring diameter 50 mm).`);
