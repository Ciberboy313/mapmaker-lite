import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Sprite, Asset } from '../types';
import { logger } from '../logger';

function degToRad(d: number) { return (d * Math.PI) / 180; }

export type MapCanvasProps = {
  sprites: Sprite[];
  setSprites: React.Dispatch<React.SetStateAction<Sprite[]>>;
  setSpritesImmediate?: React.Dispatch<React.SetStateAction<Sprite[]>>;
  selectedId?: string | null;
  setSelectedId: (id: string | null) => void;
  tool?: 'select' | 'pan' | 'rotate' | 'scale' | 'delete';
  grid: boolean;
  snap: boolean;
  gridSize: number;
  zoom: number;
  setZoom: (z: number) => void;
  pan: { x: number; y: number };
  setPan: (p: { x: number; y: number }) => void;
  mapSize: { w: number; h: number };
  assets: Asset[];
  backgroundAssetId?: string | null;
  onRequestDelete?: (id: string | null) => void;
  onInteractStart?: () => void;
  onInteractEnd?: () => void;
};

export default function MapCanvas({ sprites, setSprites, setSpritesImmediate, selectedId, setSelectedId, tool = 'select', grid, snap, gridSize, zoom, setZoom, pan, setPan, mapSize, assets, backgroundAssetId, onRequestDelete, onInteractStart, onInteractEnd }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hoveringRef = useRef<string | null>(null);
  const draggingRef = useRef<{ id: string; offsetX: number; offsetY: number; startScale?: number; startRotation?: number } | null>(null);
  const rotatingRef = useRef<{ id: string; startX: number; startRotation: number } | null>(null);
  const scalingRef = useRef<{ id: string; startX: number; startScale: number } | null>(null);
  const panningRef = useRef<boolean>(false);
  const wheelBatchActiveRef = useRef<boolean>(false);
  const wheelTimeoutRef = useRef<number | null>(null);

  const orderedByZAsc = useMemo(() => {
    return [...sprites].sort((a, b) => a.z - b.z);
  }, [sprites]);
  const orderedByZDesc = useMemo(() => {
    return [...sprites].sort((a, b) => b.z - a.z);
  }, [sprites]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    let raf = 0;
    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
      if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
        canvas.width = cssW * dpr; canvas.height = cssH * dpr;
      }
      ctx.save(); ctx.scale(dpr, dpr);
      ctx.fillStyle = "#0b1020"; ctx.fillRect(0,0,cssW,cssH);
      if (grid) {
        ctx.save(); ctx.translate(pan.x, pan.y); ctx.scale(zoom, zoom);
        ctx.strokeStyle = "#1f2a44"; ctx.lineWidth = 1/zoom;
        const step = gridSize, maxX = mapSize.w, maxY = mapSize.h;
        for (let x=0; x<=maxX; x+=step) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,maxY); ctx.stroke(); }
        for (let y=0; y<=maxY; y+=step) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(maxX,y); ctx.stroke(); }
        ctx.restore();
      }
      ctx.save(); ctx.translate(pan.x, pan.y); ctx.scale(zoom, zoom);
      if (backgroundAssetId) {
        const bg = assets.find(a => a.id === backgroundAssetId);
        if (bg && bg.img && bg.img.complete) {
          try { ctx.drawImage(bg.img, 0, 0, mapSize.w, mapSize.h); } catch (e) { ctx.fillStyle = "#0f162b"; ctx.fillRect(0,0,mapSize.w,mapSize.h); }
        } else { ctx.fillStyle = "#0f162b"; ctx.fillRect(0,0,mapSize.w,mapSize.h); }
      } else { ctx.fillStyle = "#0f162b"; ctx.fillRect(0,0,mapSize.w,mapSize.h); }
      for (const s of orderedByZAsc) {
        if (!s.visible) continue;
        const img = s.img; if (!img || !img.complete) continue;
        ctx.save(); ctx.globalAlpha = s.opacity;
        ctx.translate(s.x, s.y); ctx.rotate((s.rotation * Math.PI)/180); ctx.scale(s.scale, s.scale);
        try { ctx.drawImage(img, 0, 0); } catch (e) { logger.error('drawImage failed for sprite', { id: s.id, name: s.name, error: String(e) }); }
        if (s.id === selectedId) { ctx.lineWidth = 2/zoom; ctx.strokeStyle = "#7dd3fc"; ctx.strokeRect(0,0,img.width,img.height); }
        else if (hoveringRef.current === s.id) { ctx.lineWidth = 1/zoom; ctx.strokeStyle = "#a78bfa"; ctx.strokeRect(0,0,img.width,img.height); }
        ctx.restore();
      }
      ctx.restore(); ctx.restore();
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [orderedByZAsc, selectedId, grid, zoom, pan, gridSize, mapSize, assets, backgroundAssetId]);

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (clientX - rect.left - pan.x) / zoom;
    const y = (clientY - rect.top - pan.y) / zoom;
    return { x, y };
  }, [pan.x, pan.y, zoom]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (selectedId && (tool === 'rotate' || tool === 'scale')) {
      e.preventDefault();
      if (!wheelBatchActiveRef.current) { wheelBatchActiveRef.current = true; onInteractStart && onInteractStart(); }
      if (tool === 'rotate') {
        (setSpritesImmediate || setSprites)(prev => prev.map(s => s.id === selectedId ? { ...s, rotation: s.rotation + (e.deltaY > 0 ? 2 : -2) } : s));
      } else {
        (setSpritesImmediate || setSprites)(prev => prev.map(s => s.id === selectedId ? { ...s, scale: Math.max(0.01, s.scale * (e.deltaY > 0 ? 0.95 : 1.05)) } : s));
      }
      if (wheelTimeoutRef.current) { window.clearTimeout(wheelTimeoutRef.current); }
      wheelTimeoutRef.current = window.setTimeout(() => {
        wheelBatchActiveRef.current = false;
        onInteractEnd && onInteractEnd();
        wheelTimeoutRef.current = null;
      }, 180);
      return;
    }
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(8, Math.max(0.1, zoom * factor));
    setZoom(newZoom);
  }, [zoom, setZoom, selectedId, setSprites, tool]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const { x, y } = toWorld(e.clientX, e.clientY);
    // interactions first
    if (rotatingRef.current) {
      const r = rotatingRef.current;
      const dx = e.clientX - r.startX;
      const angle = r.startRotation + dx * 0.3;
      (setSpritesImmediate || setSprites)(prev => prev.map(s => s.id === r.id ? { ...s, rotation: angle } : s));
      return;
    }
    if (scalingRef.current) {
      const sc = scalingRef.current;
      const dx = e.clientX - sc.startX;
      const factor = 1 + dx * 0.005; // gentle scaling
      const next = Math.max(0.01, Math.min(8, sc.startScale * factor));
      (setSpritesImmediate || setSprites)(prev => prev.map(s => s.id === sc.id ? { ...s, scale: next } : s));
      return;
    }
    let over: string | null = null;
    for (const s of orderedByZDesc) {
      const img = s.img; if (!img || !img.complete) continue;
      const cos = Math.cos(degToRad(s.rotation));
      const sin = Math.sin(degToRad(s.rotation));
      const dx = x - s.x; const dy = y - s.y;
      const lx = (dx * cos + dy * sin) / s.scale;
      const ly = (-dx * sin + dy * cos) / s.scale;
      if (lx>=0 && ly>=0 && lx<=img.width && ly<=img.height) { over = s.id; break; }
    }
    hoveringRef.current = over;
  }, [orderedByZDesc, toWorld, setSprites]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const isPan = e.button === 1 || (e.button === 0 && (e.shiftKey || tool === 'pan'));
    if (isPan) { panningRef.current = true; return; }
    const { x, y } = toWorld(e.clientX, e.clientY);
    const ordered = [...sprites].sort((a,b)=> b.z - a.z);
    let picked: Sprite | null = null;
    for (const s of ordered) {
      const img = s.img; if (!img || !img.complete) continue;
      const cos = Math.cos(degToRad(s.rotation));
      const sin = Math.sin(degToRad(s.rotation));
      const dx = x - s.x; const dy = y - s.y;
      const lx = (dx * cos + dy * sin) / s.scale;
      const ly = (-dx * sin + dy * cos) / s.scale;
      if (lx>=0 && ly>=0 && lx<=img.width && ly<=img.height) { picked = s; break; }
    }
    if (picked) {
      setSelectedId(picked.id);
      onInteractStart && onInteractStart();
      if (tool === 'delete') { onRequestDelete?.(picked.id); onInteractEnd && onInteractEnd(); return; }
      if (e.altKey || tool === 'rotate') {
        rotatingRef.current = { id: picked.id, startX: e.clientX, startRotation: picked.rotation };
      } else if (tool === 'scale') {
        scalingRef.current = { id: picked.id, startX: e.clientX, startScale: picked.scale };
      } else {
        const img = picked.img!;
        const cos = Math.cos(degToRad(picked.rotation));
        const sin = Math.sin(degToRad(picked.rotation));
        const dx = x - picked.x; const dy = y - picked.y;
        const lx = (dx * cos + dy * sin) / picked.scale;
        const ly = (-dx * sin + dy * cos) / picked.scale;
        draggingRef.current = { id: picked.id, offsetX: lx, offsetY: ly, startScale: picked.scale, startRotation: picked.rotation };
      }
    } else {
      setSelectedId(null);
    }
  }, [sprites, setSelectedId, toWorld, onRequestDelete, tool]);

  const onMouseUp = useCallback(() => { draggingRef.current = null; rotatingRef.current = null; scalingRef.current = null; panningRef.current = false; onInteractEnd && onInteractEnd(); }, [onInteractEnd]);
  const onContextMenu = useCallback((e: React.MouseEvent) => { e.preventDefault(); }, []);
  const onMouseLeave = useCallback(() => { draggingRef.current = null; panningRef.current = false; }, []);
  const onMouseMovePan = useCallback((e: React.MouseEvent) => { if (!panningRef.current) return; setPan({ x: pan.x + e.movementX, y: pan.y + e.movementY }); }, [pan, setPan]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const assetId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('assetId');
    if (!assetId) return;
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;
    const { x, y } = toWorld(e.clientX, e.clientY);
    const img = asset.img ?? (() => { const im = new Image(); im.src = asset.url; return im; })();
    const s: Sprite = { id: Math.random().toString(36).slice(2), name: asset.name, img: img as HTMLImageElement, x, y, scale: 1, rotation: 0, opacity: 1, visible: true, locked: false, z: sprites.length ? Math.max(...sprites.map(s => s.z)) + 1 : 1 };
    setSprites(prev => [...prev, s]);
    setSelectedId(s.id);
  }, [assets, sprites, setSprites, setSelectedId, toWorld]);

  const onDragOverCanvas = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "+") setZoom(Math.min(8, zoom * 1.1));
      if (e.key === "-") setZoom(Math.max(0.1, zoom / 1.1));
      if (!selectedId) return;
      if (["Delete","Backspace"].includes(e.key)) {
        if (onRequestDelete) onRequestDelete(selectedId);
        else setSprites(prev => prev.filter(s => s.id !== selectedId));
      }
      const delta = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowLeft") setSprites(prev => prev.map(s => s.id === selectedId ? { ...s, x: s.x - delta } : s));
      if (e.key === "ArrowRight") setSprites(prev => prev.map(s => s.id === selectedId ? { ...s, x: s.x + delta } : s));
      if (e.key === "ArrowUp") setSprites(prev => prev.map(s => s.id === selectedId ? { ...s, y: s.y - delta } : s));
      if (e.key === "ArrowDown") setSprites(prev => prev.map(s => s.id === selectedId ? { ...s, y: s.y + delta } : s));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, setSprites, setZoom, zoom, onRequestDelete]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ cursor: ((): string => {
        if (panningRef.current) return 'grabbing';
        const over = !!hoveringRef.current;
        switch (tool) {
          case 'pan': return 'grab';
          case 'delete': return 'not-allowed';
          case 'rotate': return over ? 'crosshair' : 'default';
          case 'scale': return over ? 'nwse-resize' : 'default';
          case 'select': return over ? 'pointer' : 'default';
          default: return 'default';
        }
      })() }}
      onWheel={onWheel}
      onMouseMove={onMouseMove}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onContextMenu={onContextMenu}
      onMouseLeave={onMouseLeave}
      onMouseMoveCapture={onMouseMovePan}
      onDrop={onDrop}
      onDragOver={onDragOverCanvas}
    />
  );
}
