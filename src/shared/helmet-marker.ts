import layout from './helmet-marker-layout.json';

export type StickerBackground = 'transparent' | 'green';
export const isHelmetVisualId = (id: unknown): id is string =>
  typeof id === 'string' && /^MOTO-[0-3][0-9A-F]{4}$/.test(id);

export function encodeHelmetId(id: string): number[] {
  if (!isHelmetVisualId(id)) throw new Error('A valid paired helmet visual ID is required.');
  const value = parseInt(id.slice(5), 16);
  const checksum = (((value & 255) + ((value >>> 8) & 255) + ((value >>> 16) & 255)) ^ 0xaa) & 255;
  return [1, 0, 1, 0, 1, 1,
    ...Array.from({ length: 18 }, (_, i) => (value >>> (17 - i)) & 1),
    ...Array.from({ length: 8 }, (_, i) => (checksum >>> (7 - i)) & 1)];
}

export function helmetSlots(id: string) {
  const points = layout.outline;
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  const perimeter = lengths.reduce((a, b) => a + b, 0);
  return encodeHelmetId(id).map((bit, i) => {
    let distance = perimeter * (i + 0.5) / 32;
    let segment = 0;
    while (segment < lengths.length - 1 && distance > lengths[segment]) distance -= lengths[segment++];
    const a = points[segment], b = points[segment + 1];
    const t = distance / lengths[segment];
    return { bit, x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t,
      angle: Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI };
  });
}

export function helmetStickerSvg(id: string, logoDataUrl: string, background: StickerBackground = 'transparent'): string {
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(logoDataUrl)) throw new Error('Unable to load the MotoLock logo.');
  const slots = helmetSlots(id).map(({ bit, x, y, angle }) =>
    `<rect x="-6" y="-9" width="12" height="18" fill="${bit ? 'none' : '#FFFFFF'}" transform="translate(${x.toFixed(4)} ${y.toFixed(4)}) rotate(${angle.toFixed(4)})"/>`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="56mm" height="66mm" viewBox="48 12 396 466.7143">
<title>MotoLock ${id} helmet sticker</title>
${background === 'green' ? '<rect x="48" y="12" width="396" height="466.7143" fill="#80FF80"/>' : ''}
<image x="0" y="0" width="514" height="486" xlink:href="${logoDataUrl}"/>
${slots}
</svg>`;
}
