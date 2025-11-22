import type { Asset, Sprite } from '../types';

export type RenderOptions = {
  assets: Asset[];
  sprites: Sprite[];
  backgroundAssetId: string | null | undefined;
  mapSize: { w: number; h: number };
  scale: number; // 0 < scale <= 1
  transparent: boolean;
};

export function renderToCanvas(opts: RenderOptions): HTMLCanvasElement {
  const { assets, sprites, backgroundAssetId, mapSize, scale, transparent } = opts;
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.floor(mapSize.w * scale));
  out.height = Math.max(1, Math.floor(mapSize.h * scale));
  const ctx = out.getContext('2d', { alpha: transparent })!;

  if (!transparent) {
    ctx.fillStyle = '#0f162b';
    ctx.fillRect(0, 0, out.width, out.height);
  } else {
    ctx.clearRect(0, 0, out.width, out.height);
  }

  // background
  if (backgroundAssetId) {
    const bg = assets.find(a => a.id === backgroundAssetId);
    if (bg && bg.img && bg.img.complete) {
      try { ctx.drawImage(bg.img, 0, 0, out.width, out.height); } catch {}
    } else if (!transparent) {
      // fallback already filled
    }
  }

  // sprites ordered by z ascending
  const ordered = [...sprites].sort((a, b) => a.z - b.z);
  for (const s of ordered) {
    if (!s.visible) continue;
    const img = s.img; if (!img || !img.complete) continue;
    ctx.save();
    ctx.globalAlpha = s.opacity;
    ctx.translate(s.x * scale, s.y * scale);
    ctx.rotate((s.rotation * Math.PI) / 180);
    ctx.scale(s.scale * scale, s.scale * scale);
    try { ctx.drawImage(img, 0, 0); } catch {}
    ctx.restore();
  }

  return out;
}

export async function canvasToBlobPNG(canvas: HTMLCanvasElement): Promise<Blob> {
  return await new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => b ? resolve(b) : reject(new Error('toBlob returned null')), 'image/png');
    } catch (e) {
      reject(e);
    }
  });
}

