import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { encodeHelmetId, helmetSlots, helmetStickerSvg, isHelmetVisualId } from './helmet-marker';
import layout from './helmet-marker-layout.json';

describe('helmet sticker protocol', () => {
  it('matches the printed reference payload and rejects non-helmet IDs', () => {
    expect(encodeHelmetId('MOTO-01D44').join('')).toBe('10101100000111010100010011001011');
    for (const id of ['MOTO-40000', 'MOTO-FFFFF', 'MOTO-1D44', 'device-123', '<script>', 'MOTO-01d44']) {
      expect(isHelmetVisualId(id)).toBe(false);
      expect(() => encodeHelmetId(id)).toThrow();
    }
  });
  it('round trips every supported 18-bit payload with its checksum', () => {
    for (let payload = 0; payload < 0x40000; payload++) {
      const bits = encodeHelmetId(`MOTO-${payload.toString(16).toUpperCase().padStart(5, '0')}`);
      const decoded = parseInt(bits.slice(6, 24).join(''), 2);
      const checksum = parseInt(bits.slice(24).join(''), 2);
      if (decoded !== payload || checksum !== (((payload % 256 + Math.floor(payload / 256) % 256 + Math.floor(payload / 65536)) ^ 170) & 255)) {
        throw new Error(`Protocol mismatch for ${payload}`);
      }
    }
  });
  it('keeps admin slot geometry aligned with the production Android detector', () => {
    const kotlin = readFileSync('MotoLock_Native/app/src/main/java/com/example/motolock/data/LogoIdentityDetector.kt', 'utf8');
    const outline = [...kotlin.matchAll(/floatArrayOf\((\d+)f,\s*(\d+)f\)/g)].map(m => [+m[1], +m[2]]);
    expect(layout.outline).toEqual(outline);
    expect(helmetSlots('MOTO-2ABCD')).toHaveLength(32);
  });
  it('embeds the original logo and white slots in self-contained transparent or green SVGs', () => {
    const logo = 'data:image/png;base64,aGVsbG8=';
    const transparent = helmetStickerSvg('MOTO-2ABCD', logo);
    expect(transparent).toContain('MOTO-2ABCD');
    expect(transparent).toContain(logo);
    expect(transparent).toContain('width="56mm" height="66mm"');
    expect(transparent).not.toContain('#80FF80');
    expect(transparent).toContain('#FFFFFF');
    expect(helmetStickerSvg('MOTO-00000', logo, 'green')).toContain('#80FF80');
    expect(() => helmetStickerSvg('MOTO-01D44', '" onload="alert(1)')).toThrow();
  });
});
