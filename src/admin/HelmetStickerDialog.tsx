import { useEffect, useRef, useState } from 'react';
import type { Device } from './types';
import { helmetStickerSvg, isHelmetVisualId } from '../shared/helmet-marker';
import type { StickerBackground } from '../shared/helmet-marker';

const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function HelmetStickerDialog({ device, onClose }: { device: Device; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [background, setBackground] = useState<StickerBackground>('transparent');
  const [logo, setLogo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const id = device.helmet_visual_id;
  const valid = isHelmetVisualId(id);
  const svg = valid && logo ? helmetStickerSvg(id, logo, background) : '';
  const preview = svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : '';
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}logo.png`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load the MotoLock logo. Please reopen this window.');
        const bytes = new Uint8Array(await response.arrayBuffer());
        let binary = '';
        for (const byte of bytes) binary += String.fromCharCode(byte);
        if (!controller.signal.aborted) setLogo(`data:image/png;base64,${btoa(binary)}`);
      }).catch(reason => { if (!controller.signal.aborted) setError(String(reason.message || reason)); });
    return () => controller.abort();
  }, []);
  const downloadPng = async () => {
    if (!svg || !valid || busy) return;
    setBusy(true); setError('');
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve(); image.onerror = () => reject(new Error('Unable to render the sticker. Try downloading the SVG.'));
        image.src = preview;
      });
      const canvas = document.createElement('canvas');
      canvas.width = 1120; canvas.height = 1320;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('PNG export is unavailable. Download the SVG instead.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG export failed.')), 'image/png'));
      saveBlob(blob, `helmet-logo-${id}-${background}.png`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Sticker export failed.'); }
    finally { setBusy(false); }
  };
  return <dialog ref={dialog} className="device-dialog" aria-labelledby="sticker-title" onCancel={onClose} onClose={onClose}>
    <h3 id="sticker-title">Helmet sticker</h3>
    <p>Device: <strong>{device.id}</strong></p>
    <p>Helmet ID: <strong>{id || 'Not synced'}</strong></p>
    {!valid ? <p role="alert">Pair and sync this helmet in the updated mobile app before generating its sticker.</p> : <>
      <label className="sticker-background">Background<select value={background} onChange={event => setBackground(event.target.value as StickerBackground)}><option value="transparent">Transparent</option><option value="green">Green</option></select></label>
      {preview ? <div className="sticker-preview"><img src={preview} alt={`Encoded helmet sticker ${id}`} /></div> : !error && <p role="status">Preparing sticker…</p>}
      <p>Print at <strong>56 × 66 mm</strong>. Keep the red logo and all white border marks intact. Ask the printer to preserve white ink if using clear material.</p>
    </>}
    {error && <p role="alert">{error}</p>}
    <div className="device-dialog-actions">
      <button disabled={!svg || busy} onClick={downloadPng}>{busy ? 'Preparing PNG…' : 'Download PNG'}</button>
      <button disabled={!svg || busy} onClick={() => saveBlob(new Blob([svg], { type: 'image/svg+xml' }), `helmet-logo-${id}-${background}.svg`)}>Download SVG</button>
      <button onClick={onClose}>Close</button>
    </div>
  </dialog>;
}
