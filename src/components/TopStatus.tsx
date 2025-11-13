import React from 'react';

export type TopStatusProps = {
  zoom: number;
  pan: { x: number; y: number };
  mapSize: { w: number; h: number };
  loadingAssetsCount?: number;
};

export default function TopStatus({ zoom, pan, mapSize, loadingAssetsCount = 0 }: TopStatusProps) {
  return (
    <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-xl bg-slate-900/70 border border-slate-700 backdrop-blur px-2.5 py-1 text-xs text-slate-100 shadow-md">
      {loadingAssetsCount > 0 && (
        <span className="px-2 py-0.5 rounded bg-white/10">Asset {loadingAssetsCount}</span>
      )}
      <span className="px-2 py-0.5 rounded bg-white/10">Zoom {zoom.toFixed(2)}x</span>
      <span className="px-2 py-0.5 rounded bg-white/10">Pan {Math.round(pan.x)}, {Math.round(pan.y)}</span>
      <span className="px-2 py-0.5 rounded bg-white/10">Map {mapSize.w}×{mapSize.h}px</span>
    </div>
  );
}
