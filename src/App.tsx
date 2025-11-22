import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from 'react-dom';
import { logger, initGlobalErrorHandlers } from './logger';
import { Download, Eye, EyeOff, Grid3X3, ImagePlus, Layers, Lock, LockOpen, MousePointer2, Move, Replace, RotateCw, Trash2, Upload, ZoomIn, ZoomOut, Maximize2, PanelLeft, PanelRight, Check, X, ChevronDown, ChevronRight, CornerUpLeft, CornerDownRight, Save, FolderOpen, ChevronUp } from "lucide-react";
import { serializeProject, validateAndMigrate } from './model/project';
import type { Sprite, Asset, Folder } from './types';
import MapCanvas from './components/MapCanvas';
import Inspector from './components/Inspector';
import ToolsBar, { type Tool } from './components/ToolsBar';
import TopStatus from './components/TopStatus';
import AssetsPanel from './components/AssetsPanel';
import { renderToCanvas, canvasToBlobPNG } from './utils/export-canvas';

function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
// Tipi importati da './types'

function FolderCreator({ setFolders }: { setFolders: React.Dispatch<React.SetStateAction<Folder[]>> }) {
  const [val, setVal] = useState("");
  const onAdd = () => { if (!val.trim()) return; setFolders(f => [...f, { id: uid('folder'), name: val.trim() }]); setVal(''); };
  return (
    <div className="ml-2 flex items-center gap-2">
      <input
        placeholder="Nuovo folder"
        value={val}
        onChange={(e)=> setVal(e.target.value)}
        onKeyDown={(e)=> { if (e.key === 'Enter') onAdd(); }}
        className="bg-slate-800 rounded px-2 py-1 text-sm w-36"
        aria-label="Nome nuovo folder"
      />
      <button
        type="button"
        className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-sm text-white"
        onClick={onAdd}
        aria-label="Aggiungi folder"
        title="Aggiungi folder"
      >
        Aggiungi
      </button>
    </div>
  );
}

export default function App() {
  console.log('[App] render start');
  // Refs must be declared before any usage in callbacks/effects/JSX
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [sprites, setSpritesState] = useState<Sprite[]>([]);
  // undo/redo stacks for sprites
  const [undoStack, setUndoStack] = useState<Sprite[][]>([]);
  const [redoStack, setRedoStack] = useState<Sprite[][]>([]);
  const spritesRef = useRef<Sprite[]>(sprites);
  useEffect(() => { spritesRef.current = sprites; }, [sprites]);
  // On unmount, revoke any remaining object URLs tied to assets
  useEffect(() => {
    return () => {
      try {
        assets.forEach(a => { if ((a as any)._objectUrl) { try { URL.revokeObjectURL((a as any)._objectUrl as any); } catch {} } });
      } catch {}
    };
  }, [assets]);
  // batch interaction helpers for commit-on-mouseup
  const interactionStartRef = useRef<Sprite[] | null>(null);
  const beginSpriteInteraction = useCallback(() => {
    if (interactionStartRef.current == null) {
      interactionStartRef.current = spritesRef.current;
    }
  }, []);
  const UNDO_LIMIT = 100;
  const commitSpriteInteraction = useCallback(() => {
    if (interactionStartRef.current) {
      const snapshot = interactionStartRef.current;
      interactionStartRef.current = null;
      // push snapshot to undo and clear redo
      setUndoStack(u => { const next = [...u, snapshot]; if (next.length > UNDO_LIMIT) next.splice(0, next.length - UNDO_LIMIT); return next; });
      setRedoStack([]);
    }
  }, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [backgroundAssetId, setBackgroundAssetId] = useState<string | null>(() => {
    try { return localStorage.getItem("backgroundAssetId"); } catch (e) { return null; }
  });
  const [recentBackgroundIds, setRecentBackgroundIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('recentBackgroundIds');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { if (backgroundAssetId) localStorage.setItem('backgroundAssetId', backgroundAssetId); else localStorage.removeItem('backgroundAssetId'); } catch (e) {}
  }, [backgroundAssetId]);
  useEffect(() => {
    try { localStorage.setItem('recentBackgroundIds', JSON.stringify(recentBackgroundIds.slice(0,5))); } catch {}
  }, [recentBackgroundIds]);

  // Global shortcuts: grid/snap toggle, z-order tweaks
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'g') { e.preventDefault(); setGrid(v => !v); return; }
      if (key === 's') { e.preventDefault(); setSnap(v => !v); return; }
      if (!selectedId) return;
      if (e.ctrlKey || e.metaKey) {
        // Bring to front/back with Alt modifier
        if (e.altKey && e.key === ']') { e.preventDefault(); setSpritesWithHistory(prev => prev.map(x => x.id===selectedId? {...x, z: Math.max(...prev.map(p=>p.z))+1 }: x)); return; }
        if (e.altKey && e.key === '[') { e.preventDefault(); setSpritesWithHistory(prev => prev.map(x => x.id===selectedId? {...x, z: Math.min(...prev.map(p=>p.z))-1 }: x)); return; }
        if (e.key === ']') {
          e.preventDefault();
          setSpritesWithHistory(prev => prev.map(x => x.id===selectedId? { ...x, z: Math.max(...prev.map(p=>p.z))+1 }: x));
        } else if (e.key === '[') {
          e.preventDefault();
          setSpritesWithHistory(prev => {
            const cur = prev.find(x=>x.id===selectedId); if (!cur) return prev;
            const lower = [...prev].filter(x=> x.z<cur.z).sort((a,b)=> b.z-a.z)[0];
            if (!lower) return prev; const lz = lower.z; const cz = cur.z; return prev.map(x => x.id===cur.id? {...x, z: lz }: (x.id===lower.id? {...x, z: cz }: x));
          });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  // init global logger and handlers
  useEffect(() => {
    try { initGlobalErrorHandlers(); logger.info('Logger initialized'); } catch (e) {}
  }, []);

  

  // wrapped setter that records history for undo/redo
  const setSpritesWithHistory = useCallback((updater: React.SetStateAction<Sprite[]>) => {
    setSpritesState(prev => {
      const next = typeof updater === 'function' ? (updater as (p: Sprite[]) => Sprite[])(prev) : updater;
      // only push to history if actually changed (shallow compare by length or reference)
      if (next !== prev) {
        setUndoStack(u => [...u, prev]);
        setRedoStack([]);
      }
      return next;
    });
  }, []);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  const undo = useCallback(() => {
    setUndoStack(u => {
      if (u.length === 0) return u;
      const prev = u[u.length - 1];
      // move current to redo
      setRedoStack(r => [spritesRef.current, ...r]);
      // apply prev without recording history
      setSpritesState(prev);
      return u.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setRedoStack(r => {
      if (r.length === 0) return r;
      const next = r[0];
      // push current to undo
      setUndoStack(u => [...u, spritesRef.current]);
      // apply next without recording history
      setSpritesState(next);
      return r.slice(1);
    });
  }, []);

  // keyboard shortcuts for undo/redo: Ctrl/Cmd+Z, Ctrl+Y or Ctrl+Shift+Z
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key;
      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      // Canvas-level toggles
      if (!e.ctrlKey && !e.metaKey) {
        if (key.toLowerCase() === 'g') { e.preventDefault(); setGrid(g=>!g); return; }
        if (key.toLowerCase() === 's') { e.preventDefault(); setSnap(s=>!s); return; }
      }
      // Transform selected sprite (DungeonDraft-like)
      if (selectedId) {
        const stepScalePct = e.shiftKey ? 10 : 5; // Shift for larger steps
        const stepRot = e.shiftKey ? 30 : 15;     // Shift for larger rotation
        const stepOpacityPct = e.shiftKey ? 10 : 5;
        if (!e.ctrlKey && !e.metaKey) {
          // Q/E rotate
          if (key.toLowerCase() === 'q') { e.preventDefault(); setSpritesWithHistory(prev => prev.map(s => s.id===selectedId? { ...s, rotation: s.rotation - stepRot }: s)); return; }
          if (key.toLowerCase() === 'e') { e.preventDefault(); setSpritesWithHistory(prev => prev.map(s => s.id===selectedId? { ...s, rotation: s.rotation + stepRot }: s)); return; }
          // +/- scale by percentage up to 200%
          if (key === '+' || key === '=' ) { e.preventDefault(); setSpritesWithHistory(prev => prev.map(s => s.id===selectedId? { ...s, scale: Math.min(2.0, s.scale * (1 + stepScalePct/100)) }: s)); return; }
          if (key === '-') { e.preventDefault(); setSpritesWithHistory(prev => prev.map(s => s.id===selectedId? { ...s, scale: Math.max(0.01, s.scale * (1 - stepScalePct/100)) }: s)); return; }
          // , . opacity
          if (key === ',') { e.preventDefault(); setSpritesWithHistory(prev => prev.map(s => s.id===selectedId? { ...s, opacity: Math.max(0, s.opacity - stepOpacityPct/100) }: s)); return; }
          if (key === '.') { e.preventDefault(); setSpritesWithHistory(prev => prev.map(s => s.id===selectedId? { ...s, opacity: Math.min(1, s.opacity + stepOpacityPct/100) }: s)); return; }
          // Delete
          if (key === 'Delete' || key === 'Backspace') { e.preventDefault(); setSpritesWithHistory(prev => prev.filter(s => s.id !== selectedId)); setSelectedId(null); return; }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, selectedId, setSpritesWithHistory]);

  const [grid, setGrid] = useState(true);
  const [snap, setSnap] = useState(true);
  const [gridSize, setGridSize] = useState(64);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [mapSize, setMapSize] = useState({ w: 4096, h: 3072 });
  const [newMapOpen, setNewMapOpen] = useState<boolean>(false);
  const [newMapDraft, setNewMapDraft] = useState<{ w: string; h: string; grid: boolean; gridSize: string; backgroundAssetId: string | ''; error?: string; warnLarge?: boolean; fieldErrors?: { w?: string; h?: string; gridSize?: string } }>({ w: '4096', h: '3072', grid: true as any, gridSize: '64', backgroundAssetId: '' });
  const canCreateNewMap = useMemo(() => {
    const w = parseInt(newMapDraft.w, 10);
    const h = parseInt(newMapDraft.h, 10);
    const g = parseInt(newMapDraft.gridSize, 10);
    return Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0 && Number.isFinite(g) && g > 0;
  }, [newMapDraft.w, newMapDraft.h, newMapDraft.gridSize]);

  const performCreateNewMap = useCallback(() => {
    const w = parseInt(newMapDraft.w, 10);
    const h = parseInt(newMapDraft.h, 10);
    const g = parseInt(newMapDraft.gridSize, 10);
    const fe: any = {};
    if (!Number.isFinite(w) || w <= 0) fe.w = 'Inserisci un intero > 0';
    if (!Number.isFinite(h) || h <= 0) fe.h = 'Inserisci un intero > 0';
    if (!Number.isFinite(g) || g <= 0) fe.gridSize = 'Inserisci un intero > 0';
    if (Object.keys(fe).length) { setNewMapDraft(d=> ({...d, fieldErrors: fe, error: 'Correggi i campi evidenziati'})); return; }
    const tooLarge = w * h > 20_000_000;
    setNewMapDraft(d=> ({...d, warnLarge: tooLarge, error: d.error && !tooLarge ? d.error : undefined }));
    setMapSize({ w, h });
    setGrid(!!newMapDraft.grid);
    setGridSize(g);
    if (newMapDraft.backgroundAssetId) {
      setBackgroundAssetId(newMapDraft.backgroundAssetId);
      // Ensure background image is loaded
      const bg = assets.find(a => a.id === newMapDraft.backgroundAssetId);
      if (bg && !bg.img && bg.url) {
        try {
          const im = new Image();
          im.onload = () => {
            setAssets(prev => prev.map(x => x.id === bg.id ? { ...x, img: im, w: im.width, h: im.height } : x));
          };
          im.src = bg.url;
        } catch {}
      }
      setRecentBackgroundIds(prev => {
        const next = [newMapDraft.backgroundAssetId!, ...prev.filter(id => id !== newMapDraft.backgroundAssetId)];
        return next.slice(0,5);
      });
    } else setBackgroundAssetId(null);
    setPan({ x: 40, y: 40 });
    setZoom(1);
    setNewMapOpen(false);
    // reset draft for next time
    setTimeout(() => setNewMapDraft({ w: String(w), h: String(h), grid: true as any, gridSize: String(g), backgroundAssetId: '' }), 0);
  }, [newMapDraft, setMapSize, setGrid, setGridSize, setBackgroundAssetId, setPan, setZoom, setRecentBackgroundIds, assets, setAssets]);
  const [loadingAssetsCount, setLoadingAssetsCount] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState<{ transparent: boolean; scale: number }>(() => {
    let scale = 1;
    try { const s = parseFloat(localStorage.getItem('lastExportScale')||''); if (s>0 && s<=1) scale = s; } catch {}
    return { transparent: true, scale };
  });
  const [showAssets, setShowAssets] = useState(true);
  const [showLayers, setShowLayers] = useState(true);
  const [showProperties, setShowProperties] = useState(true);
  const [activeTool, setActiveTool] = useState<'select'|'move'|'rotate'|'scale'>("select");

  const selectedSprite = useMemo(() => sprites.find(s => s.id === selectedId) || null, [sprites, selectedId]);
  const changeSelected = useCallback((patch: Partial<Sprite>) => {
    if (!selectedId) return;
    setSpritesWithHistory(prev => prev.map(s => s.id === selectedId ? { ...s, ...patch } : s));
  }, [selectedId]);

  // Ensure we have a default map visible on first load
  useEffect(() => {
    console.log('[App] ensure default map effect');
    if (!mapSize || !mapSize.w || !mapSize.h) {
      setMapSize({ w: 1920, h: 1080 });
      setGrid(true); setGridSize(64);
      setPan({ x: 40, y: 40 }); setZoom(1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // project save/load handlers (defined before IPC effect to avoid hoist issues)
  const saveProject = useCallback(() => {
    try {
      const data = serializeProject({
        mapSize, pan, zoom, grid, gridSize, snap,
        backgroundAssetId: backgroundAssetId ?? null,
        folders,
        assets: assets.map(a => ({ id: a.id, name: a.name, url: a.url, w: a.w, h: a.h, folderId: a.folderId ?? null })),
        sprites,
      });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const name = `mapmaker-project-${new Date().toISOString().replace(/[:.]/g,'_')}.json`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) {
      logger.error('saveProject failed', { error: String(e) });
      alert('Salvataggio progetto fallito: ' + (((e as any)?.message) ?? String(e)));
    }
  }, [mapSize, pan, zoom, grid, gridSize, snap, backgroundAssetId, folders, assets, sprites]);

  const requestLoadProject = useCallback(() => {
    projectInputRef.current?.click();
  }, []);

  const onProjectFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result));
        const project = validateAndMigrate(json);
        // apply state
        setMapSize(project.mapSize);
        if (project.view) { setPan(project.view.pan); setZoom(project.view.zoom); }
        setGrid(project.grid.enabled); setGridSize(project.grid.size); setSnap(project.grid.snap);
        setFolders(project.folders);
        // prime assets metadata, keep previous URLs if present
        setAssets(prev => project.assets.map(a => {
          const found = prev.find(p => p.id === a.id);
          return { id: a.id, name: a.name, url: (found?.url ?? a.url) || '', w: a.w, h: a.h, folderId: a.folderId ?? null } as any;
        }));
        // set sprites without images for now, will link after images load
        setSpritesWithHistory(project.sprites.map(s => ({
          id: s.id, name: s.name,
          img: undefined as any,
          x: s.x, y: s.y, z: s.z, scale: s.scale, rotation: s.rotation, opacity: s.opacity,
          visible: s.visible, locked: s.locked,
        })) as any);
        // load images
        setTimeout(() => {
          project.assets.forEach(a => {
            if (!a.url) return;
            const img = new Image();
            img.onload = () => {
              setLoadingAssetsCount(c => Math.max(0, c - 1));
              setAssets(prev => prev.map(p => p.id === a.id ? { ...p, img, w: img.width, h: img.height } : p));
              setSpritesWithHistory(prev => prev.map(s => (s.name === a.name ? { ...s, img } : s)) as any);
            };
            img.onerror = () => { setLoadingAssetsCount(c => Math.max(0, c - 1)); logger.error('asset image load failed', { id: a.id, name: a.name, url: a.url }); };
            setLoadingAssetsCount(c => c + 1);
            img.src = a.url;
          });
        }, 0);
        setBackgroundAssetId(project.backgroundAssetId);
      } catch (err) {
        logger.error('loadProject failed', { error: String(err) });
        alert('Caricamento progetto fallito: ' + (((err as any)?.message) ?? String(err)));
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  }, [assets]);

  // Handle actions from native menu via IPC (preload)
  useEffect(() => {
    const api: any = (window as any).menuAPI;
    if (!api || typeof api.onAction !== 'function') { logger.warn('menuAPI not available'); return; }
    logger.info('menu ipc listener attached');
    const off = api.onAction((type: string, payload: any) => {
      logger.info('menu action', { type, payload });
      switch (type) {
        case 'file:new': setNewMapOpen(true); break;
        case 'file:new-quick': {
          const w = Number(payload?.w) || 4096; const h = Number(payload?.h) || 3072;
          setMapSize({ w, h }); setGrid(true); setGridSize(64); setBackgroundAssetId(null); setPan({ x: 40, y: 40 }); setZoom(1);
          break;
        }
        case 'file:open-project': requestLoadProject(); break;
        case 'file:save-project': saveProject(); break;
        case 'file:import-assets': fileInputRef.current?.click(); break;
        case 'file:set-background': setNewMapOpen(true); break;
        case 'file:export-png': setExportOpen(true); break;
        case 'edit:undo': undo(); break;
        case 'edit:redo': redo(); break;
        case 'edit:toggle-snap': setSnap(s=>!s); break;
        case 'edit:toggle-grid': setGrid(g=>!g); break;
        case 'view:zoom-in': setZoom(z=> Math.min(8, z*1.1)); break;
        case 'view:zoom-out': setZoom(z=> Math.max(0.1, z/1.1)); break;
        case 'view:zoom-reset': setZoom(1); break;
        case 'view:toggle-assets': setShowAssets(v=>!v); break;
        case 'view:toggle-layers': setShowLayers(v=>!v); break;
        case 'view:toggle-properties': setShowProperties(v=>!v); break;
        case 'tool:set': setActiveTool(payload?.tool || 'select'); break;
        case 'zorder:forward': if (selectedId) setSpritesWithHistory(prev => prev.map(s => s.id === selectedId ? { ...s, z: s.z + 1 } : s)); break;
        case 'zorder:backward': if (selectedId) setSpritesWithHistory(prev => prev.map(s => s.id === selectedId ? { ...s, z: s.z - 1 } : s)); break;
        case 'zorder:front': if (selectedId) { const maxZ = Math.max(0, ...sprites.map(s=>s.z)); setSpritesWithHistory(prev => prev.map(s => s.id === selectedId ? { ...s, z: maxZ + 1 } : s)); } break;
        case 'zorder:back': if (selectedId) { const minZ = Math.min(0, ...sprites.map(s=>s.z)); setSpritesWithHistory(prev => prev.map(s => s.id === selectedId ? { ...s, z: minZ - 1 } : s)); } break;
        case 'help:shortcuts': alert('Scorciatoie:\n- Undo: Ctrl/Cmd+Z\n- Redo: Ctrl+Y o Ctrl+Shift+Z\n- Zoom: Ctrl+ / Ctrl- / Ctrl0'); break;
        case 'help:about': alert('MapMaker Lite – Editor leggero per mappe fantasy'); break;
        default: break;
      }
    });
    return () => { try { off && off(); } catch {} };
  }, [saveProject, requestLoadProject, undo, redo, setSpritesWithHistory, selectedId, sprites]);

  // Log DOM sizes after layout
  useEffect(() => {
    try {
      const de = document.documentElement; const body = document.body;
      const root = document.getElementById('root');
      logger.debug('dom sizes', { de: { w: de.clientWidth, h: de.clientHeight }, body: { w: body.clientWidth, h: body.clientHeight }, root: { w: root?.clientWidth, h: root?.clientHeight } });
    } catch {}
  }, []);

  const exportPng = useCallback(async () => {
    try {
      const scale = (exportOptions as any).scale ?? 1;
      const pixels = Math.max(1, Math.floor(mapSize.w * scale)) * Math.max(1, Math.floor(mapSize.h * scale));
      const MEGA = 1_000_000;
      if (pixels > 50 * MEGA) {
        const proceed = window.confirm(`Attenzione: l'export è molto grande (, ~${Math.round(pixels/MEGA)} MP). Potrebbe fallire o essere lento. Procedere?`);
        if (!proceed) { return; }
      }
      let blob: Blob;
      try {
        const canvas = renderToCanvas({ assets, sprites, backgroundAssetId, mapSize, scale, transparent: exportOptions.transparent });
        blob = await canvasToBlobPNG(canvas);
      } catch (err) {
        // Fallback legacy path in caso di problemi con la utility condivisa
        const off = document.createElement('canvas');
        off.width = Math.max(1, Math.floor(mapSize.w * scale));
        off.height = Math.max(1, Math.floor(mapSize.h * scale));
        const ctx = off.getContext('2d', { alpha: exportOptions.transparent })!;
        if (!exportOptions.transparent) { ctx.fillStyle = '#0f162b'; ctx.fillRect(0,0,off.width,off.height); } else { ctx.clearRect(0,0,off.width,off.height); }
        if (backgroundAssetId) {
          const bg = assets.find(a => a.id === backgroundAssetId);
          if (bg?.img && bg.img.complete) { try { ctx.drawImage(bg.img, 0, 0, off.width, off.height); } catch {} }
        }
        const ordered = [...sprites].sort((a,b)=> a.z - b.z);
        for (const s of ordered) {
          if (!s.visible) continue; const img = s.img; if (!img || !img.complete) continue;
          ctx.save(); ctx.globalAlpha = s.opacity; ctx.translate(s.x * scale, s.y * scale); ctx.rotate((s.rotation*Math.PI)/180); ctx.scale(s.scale * scale, s.scale * scale);
          try { ctx.drawImage(img, 0, 0); } catch {}
          ctx.restore();
        }
        blob = await new Promise((res)=> off.toBlob(b=> res(b!), 'image/png')) as Blob;
      }
      const name = `map-export-${new Date().toISOString().replace(/[:.]/g,'_')}.png`;
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(()=> URL.revokeObjectURL(a.href), 1000);
      setExportOpen(false);
    } catch (e) {
      logger.error('exportPng failed', { error: String(e) });
      alert('Export PNG fallito: ' + (((e as any)?.message) ?? String(e)));
    }
  }, [sprites, assets, backgroundAssetId, mapSize.w, mapSize.h, exportOptions.transparent]);

  return (
    <>
    {/* hidden asset upload input is rendered inside EditorUI where onHiddenFileChange is defined */}
    {/* Remove HTML menubar to avoid duplication with native menu. Keep status bar at right. */}
    <div className="w-full h-6 bg-slate-950/60 border-b border-slate-800 flex items-center px-3 gap-4 text-slate-200">
      <div className="ml-auto text-xs text-slate-400">
        {loadingAssetsCount > 0 ? `Caricamento asset… (${loadingAssetsCount})` : ``}
      </div>
    </div>
    {/* floating quick action removed in favor of menu */}

    {newMapOpen && createPortal((
      <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/50" onClick={()=> setNewMapOpen(false)}>
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-0 w-[460px] text-slate-100" onClick={(e)=> e.stopPropagation()} onKeyDown={(e)=> {
          if (e.key === 'Escape') { e.preventDefault(); setNewMapOpen(false); return; }
          if (e.key === 'Enter') { e.preventDefault(); if (canCreateNewMap) performCreateNewMap(); }
        }}>
          <form onSubmit={(e)=> { e.preventDefault(); if (canCreateNewMap) performCreateNewMap(); }}>
          <div className="text-lg font-semibold mb-3 px-4 pt-4">Crea nuova mappa</div>
          {newMapDraft.error && <div className="mb-2 text-sm text-red-300 bg-red-900/30 border border-red-700 rounded px-2 py-1">{newMapDraft.error}</div>}
          {newMapDraft.warnLarge && <div className="mb-2 text-xs text-amber-200 bg-amber-900/30 border border-amber-700 rounded px-2 py-1">Mappa molto grande: potrebbero verificarsi rallentamenti o errori in export.</div>}
          <div className="grid grid-cols-2 gap-3 mb-3 px-4">
            <div>
              <div className="text-xs text-slate-300 mb-1">Larghezza (px)</div>
              <input className={`w-full bg-slate-800 rounded px-2 py-1 ${newMapDraft.fieldErrors?.w? 'border border-red-600':''}`} value={newMapDraft.w} onChange={(e)=> setNewMapDraft(d=> ({...d, w: e.target.value, fieldErrors: {...(d.fieldErrors||{}), w: undefined}}))} placeholder="es. 4096" />
              {newMapDraft.fieldErrors?.w && <div className="text-xs text-red-300 mt-1">{newMapDraft.fieldErrors.w}</div>}
            </div>
            <div>
              <div className="text-xs text-slate-300 mb-1">Altezza (px)</div>
              <input className={`w-full bg-slate-800 rounded px-2 py-1 ${newMapDraft.fieldErrors?.h? 'border border-red-600':''}`} value={newMapDraft.h} onChange={(e)=> setNewMapDraft(d=> ({...d, h: e.target.value, fieldErrors: {...(d.fieldErrors||{}), h: undefined}}))} placeholder="es. 3072" />
              {newMapDraft.fieldErrors?.h && <div className="text-xs text-red-300 mt-1">{newMapDraft.fieldErrors.h}</div>}
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!newMapDraft.grid} onChange={(e)=> setNewMapDraft(d=> ({...d, grid: e.target.checked as any}))} />
                Griglia attiva
              </label>
              <div className="flex items-center gap-2">
                <div className="text-xs text-slate-300">Grid size</div>
                <input className={`w-24 bg-slate-800 rounded px-2 py-1 ${newMapDraft.fieldErrors?.gridSize? 'border border-red-600':''}`} value={newMapDraft.gridSize} onChange={(e)=> setNewMapDraft(d=> ({...d, gridSize: e.target.value, fieldErrors: {...(d.fieldErrors||{}), gridSize: undefined}}))} placeholder="64" />
              </div>
              {newMapDraft.fieldErrors?.gridSize && <div className="text-xs text-red-300">{newMapDraft.fieldErrors.gridSize}</div>}
            </div>
            {/* Preset rapidi */}
            <div className="col-span-2 flex items-center gap-2 text-xs">
              <span className="text-slate-400">Preset:</span>
              <button className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700" onClick={()=> setNewMapDraft(d=> ({...d, w: '1280', h: '720'}))}>HD 1280×720</button>
              <button className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700" onClick={()=> setNewMapDraft(d=> ({...d, w: '1920', h: '1080'}))}>Full HD 1920×1080</button>
              <button className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700" onClick={()=> setNewMapDraft(d=> ({...d, w: '4096', h: '3072'}))}>Ultra HD 2560×1440</button>
              <button className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700" onClick={()=> setNewMapDraft(d=> ({...d, w: '3840', h: '2160'}))}>Large 8192×6144</button>
              <button className="ml-auto px-2 py-1 rounded bg-slate-800 hover:bg-slate-700" title="Usa dimensioni correnti" onClick={()=> setNewMapDraft(d=> ({...d, w: String(mapSize.w), h: String(mapSize.h)}))}>Usa dimensioni correnti</button>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-slate-300 mb-1">Background (opzionale)</div>
              {/* Recenti */}
              {recentBackgroundIds.length > 0 && (
                <div className="mb-2 text-xs">
                  <div className="text-slate-400 mb-1">Recenti</div>
                  <div className="flex flex-wrap gap-2">
                    {recentBackgroundIds
                      .map(id => assets.find(a => a.id === id))
                      .filter(Boolean)
                      .slice(0,5)
                      .map(a => (
                        <button key={(a as any)!.id} className={`px-2 py-1 rounded ${newMapDraft.backgroundAssetId === (a as any)!.id ? 'bg-sky-700/60' : 'bg-slate-800 hover:bg-slate-700'}`} onClick={()=> setNewMapDraft(d=> ({...d, backgroundAssetId: (a as any)!.id }))}>
                          {(a as any)!.name}
                        </button>
                      ))}
                  </div>
                </div>
              )}
              {/* Dropdown elenco asset */}
              <select className="w-full bg-slate-800 rounded px-2 py-1 mb-2" value={newMapDraft.backgroundAssetId} onChange={(e)=> setNewMapDraft(d=> ({...d, backgroundAssetId: e.target.value}))}>
                <option value="">— Nessuno —</option>
                {assets.map(a=> (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              {/* Upload diretto */}
              <label className="block text-xs text-slate-300 mb-1">Carica background</label>
              <input type="file" accept="image/*" onChange={(e)=> {
                const f = e.target.files?.[0]; if (!f) return;
                const url = URL.createObjectURL(f);
                const id = uid('asset');
                const a: Asset = { id, name: `Background: ${f.name}` , url, folderId: null, _objectUrl: url };
                const img = new Image();
                img.onload = () => { a.img = img; a.w = img.width; a.h = img.height; setAssets(prev => [...prev]);
                  if (a._objectUrl) { try { URL.revokeObjectURL(a._objectUrl); } catch {} a._objectUrl = undefined as any; }
                };
                img.src = url;
                setAssets(prev => [...prev, a]);
                setNewMapDraft(d=> ({...d, backgroundAssetId: id }));
              }} />
              <div className="mt-2 text-xs text-slate-400">Puoi anche caricare o scegliere un background dopo la creazione.</div>
            </div>
          </div>
          <div className="flex justify-end gap-2 px-4 pb-4">
            <button type="button" className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700" onClick={()=> setNewMapOpen(false)}>Annulla</button>
            <button type="submit" id="btn-create-map" className={`px-3 py-1 rounded text-white ${canCreateNewMap ? 'bg-sky-600 hover:bg-sky-500' : 'bg-slate-700 cursor-not-allowed opacity-60'}`} onClick={(e)=> { if (!canCreateNewMap) { e.preventDefault(); return; } }} disabled={!canCreateNewMap}>Crea</button>
          </div>
          </form>
        </div>
      </div>
    ), document.getElementById('overlay-root')!)}

    {exportOpen && createPortal((
      <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/50" onClick={()=> setExportOpen(false)}>
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 w-[360px] text-slate-100" onClick={(e)=> e.stopPropagation()}>
          <div className="text-lg font-semibold mb-3">Esporta PNG</div>
          <div className="mb-3 text-sm text-slate-300">Dimensione export: {mapSize.w}×{mapSize.h}</div>
          <div className="mb-3 text-sm text-slate-300 flex items-center gap-2">
            <span>Scala export:</span>
            <select className="bg-slate-800 rounded px-2 py-1" value={(exportOptions as any).scale}
              onChange={(e)=> { const s = parseFloat(e.target.value); setExportOptions((o:any)=> ({...o, scale: s})); try { localStorage.setItem('lastExportScale', String(s)); } catch {} }}>
              {[1,0.75,0.5,0.25].map(s => (<option key={s} value={s}>{Math.round(s*100)}%</option>))}
            </select>
            <span className="opacity-70">→ {Math.max(1, Math.floor(mapSize.w * ((exportOptions as any).scale ?? 1)))}×{Math.max(1, Math.floor(mapSize.h * ((exportOptions as any).scale ?? 1)))}</span>
          </div>
          <label className="inline-flex items-center gap-2 mb-4 text-sm">
            <input type="checkbox" checked={exportOptions.transparent} onChange={(e)=> setExportOptions(o=> ({...o, transparent: e.target.checked}))} />
            Sfondo trasparente (se disattivo, usa #0f162b)
          </label>
          <div className="flex justify-end gap-2">
            <button className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700" onClick={()=> setExportOpen(false)}>Annulla</button>
            <button className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white" onClick={exportPng}>Esporta</button>
          </div>
        </div>
      </div>
    ), document.getElementById('overlay-root')!)}

    {/* hidden file input for project load */}
    <input ref={projectInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={onProjectFile} />

    <div className="flex h-full w-full">{/* fill available height; page has overflow hidden */}
    <EditorUI
      assets={assets} setAssets={setAssets}
      folders={folders} setFolders={setFolders} selectedFolderId={selectedFolderId} setSelectedFolderId={setSelectedFolderId}
      sprites={sprites} setSprites={setSpritesWithHistory}
      setSpritesImmediate={setSpritesState}
      selectedId={selectedId} setSelectedId={setSelectedId}
      backgroundAssetId={backgroundAssetId} setBackgroundAssetId={setBackgroundAssetId}
      undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo}
      grid={grid} setGrid={setGrid} snap={snap} setSnap={setSnap} gridSize={gridSize} setGridSize={setGridSize}
      zoom={zoom} setZoom={setZoom} pan={pan} setPan={setPan}
      mapSize={mapSize} setMapSize={setMapSize}
      selectedSprite={selectedSprite} changeSelected={changeSelected}
      onSaveProject={saveProject}
      onLoadProject={requestLoadProject}
      loadingAssetsCount={loadingAssetsCount}
      onSpriteInteractStart={beginSpriteInteraction}
      onSpriteInteractEnd={commitSpriteInteraction}
    />
    </div>
    </>
  );
}

type EditorProps = {
  assets: Asset[]; setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
  folders: Folder[]; setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  selectedFolderId: string | null; setSelectedFolderId: (id: string | null)=>void;
  sprites: Sprite[]; setSprites: React.Dispatch<React.SetStateAction<Sprite[]>>; setSpritesImmediate: React.Dispatch<React.SetStateAction<Sprite[]>>;
  selectedId: string | null; setSelectedId: (id: string | null)=>void;
  backgroundAssetId?: string | null; setBackgroundAssetId?: (id: string | null)=>void;
  undo?: () => void; redo?: () => void; canUndo?: boolean; canRedo?: boolean;
  grid: boolean; setGrid: (v:boolean)=>void;
  snap: boolean; setSnap: (v:boolean)=>void;
  gridSize: number; setGridSize: (n:number)=>void;
  zoom: number; setZoom: (n:number)=>void;
  pan: {x:number;y:number}; setPan: (p:{x:number;y:number})=>void;
  mapSize: {w:number;h:number}; setMapSize: React.Dispatch<React.SetStateAction<{w:number;h:number}>>;
  selectedSprite: Sprite | null; changeSelected: (p: Partial<Sprite>)=>void;
  onSaveProject?: () => void;
  onLoadProject?: () => void;
  loadingAssetsCount?: number;
  onSpriteInteractStart?: () => void;
  onSpriteInteractEnd?: () => void;
};

function EditorUI(props: EditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedTool, setSelectedTool] = useState<Tool>('select');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const createFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    const id = uid('folder');
    props.setFolders(prev => [...prev, { id, name }]);
    try { props.setSelectedFolderId(id); } catch (e) {}
    setNewFolderName(""); setCreatingFolder(false);
  };

  // local state for which folders are collapsed
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleCollapsed = (id: string) => setCollapsed(c => ({ ...c, [id]: !c[id] }));

  // selected asset in UI (does not add to map) - just for highlighting
  const [selectedAssetUI, setSelectedAssetUI] = useState<string | null>(null);
  // which folder is currently highlighted as a drop target during drag
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);
  // context menu state
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; type: 'asset'|'folder'|'sprite'|'none'; id?: string | null; name?: string }>({ visible: false, x: 0, y: 0, type: 'none', id: null });
  // (moved refs to the top of component)

  const openContextMenu = (e: React.MouseEvent, type: 'asset'|'folder'|'sprite', id?: string) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, type, id });
  };
  const closeContextMenu = () => setContextMenu({ visible: false, x: 0, y: 0, type: 'none', id: null });

  // context menu actions
  const [confirmDelete, setConfirmDelete] = useState<{ visible: boolean; type: 'asset'|'folder'|'sprite'|null; id?: string | null; name?: string }>(
    { visible: false, type: null }
  );

  // hidden input for project load
  useEffect(() => {
    // ensure overlay root exists for portals
    let overlay = document.getElementById('overlay-root');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'overlay-root';
      document.body.appendChild(overlay);
    }
  }, []);

  // toolbar helpers
  const ToolbarButton = ({ title, onClick, children }: { title: string; onClick?: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm"
    >
      {children}
    </button>
  );

  // (duplicate project save/load handlers removed in EditorUI scope; use props.onSaveProject/onLoadProject instead)

  // skip confirmation preference (persisted)
  const [skipConfirm, setSkipConfirm] = useState<boolean>(() => {
    try { return localStorage.getItem('skipConfirmDelete') === '1'; } catch (e) { return false; }
  });

  const setSkipConfirmPersist = (v: boolean) => {
    try { if (v) localStorage.setItem('skipConfirmDelete', '1'); else localStorage.removeItem('skipConfirmDelete'); } catch (e) {}
    setSkipConfirm(v);
  };

  // centralized delete helper used by modal and direct actions
  const doDelete = (type: 'asset'|'folder'|'sprite'|null, id?: string | null) => {
    if (!type || !id) return;
    if (type === 'asset') {
      props.setAssets(prev => {
        const found = prev.find(a => a.id === id);
        if (found && found._objectUrl) {
          try { URL.revokeObjectURL(found._objectUrl); } catch {}
        }
        return prev.filter(a => a.id !== id);
      });
    } else if (type === 'folder') {
      props.setFolders(prev => prev.filter(f => f.id !== id));
      props.setAssets(prev => prev.map(a => a.folderId === id ? { ...a, folderId: null } : a));
      if (props.selectedFolderId === id) props.setSelectedFolderId(null);
    } else if (type === 'sprite') {
      props.setSprites(prev => prev.filter(s => s.id !== id));
      if (props.selectedId === id) props.setSelectedId(null);
    }
  };

  const deleteAsset = (id?: string | null) => {
    if (!id) return;
    if (skipConfirm) { doDelete('asset', id); closeContextMenu(); return; }
    setConfirmDelete({ visible: true, type: 'asset', id, name: props.assets.find(a=>a.id===id)?.name || 'asset' }); closeContextMenu();
  };
  const renameAsset = (id?: string | null) => {
    if (!id) return; const a = props.assets.find(x=>x.id===id); if (!a) return; const newName = prompt('Rinomina asset', a.name); if (newName && newName.trim()) props.setAssets(prev => prev.map(x=> x.id===id? {...x, name: newName.trim() }: x)); closeContextMenu();
  };
  const setAssetAsBackground = (id?: string | null) => { if (!id) return; props.setBackgroundAssetId && props.setBackgroundAssetId(id); try{ localStorage.setItem('backgroundAssetId', id); }catch(_){} closeContextMenu(); };

  const deleteFolder = (id?: string | null) => {
    if (!id) return;
    if (skipConfirm) { doDelete('folder', id); closeContextMenu(); return; }
    setConfirmDelete({ visible: true, type: 'folder', id, name: props.folders.find(f=>f.id===id)?.name || 'cartella' }); closeContextMenu();
  };
  const renameFolder = (id?: string | null) => { if (!id) return; const f = props.folders.find(x=>x.id===id); if (!f) return; const newName = prompt('Rinomina cartella', f.name); if (newName && newName.trim()) props.setFolders(prev => prev.map(x => x.id===id? {...x, name: newName.trim() }: x)); closeContextMenu(); };

  const uploadToFolder = (id?: string | null) => {
    // trigger hidden file input and store target folder in dataset
    if (!fileInputRef.current) return; (fileInputRef.current as any).dataset.targetFolder = id || '';
    fileInputRef.current.click(); closeContextMenu();
  };

  const onHiddenFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return; const targetFolder = (e.target as any).dataset.targetFolder || null;
    const list: Asset[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue;
      const url = URL.createObjectURL(f); const id = uid('asset');
      const a: Asset = { id, name: f.name, url, folderId: targetFolder || null, _objectUrl: url };
      const img = new Image(); img.onload = () => { a.img = img; a.w = img.width; a.h = img.height; props.setAssets(prev => [...prev]);
        // Revoke blob URL once decoded to avoid memory leaks
        if (a._objectUrl) { try { URL.revokeObjectURL(a._objectUrl); } catch {} (a as any)._objectUrl = undefined; }
      };
      img.onerror = (err) => { logger.error('Image load failed', { name: f.name, type: f.type, size: f.size, err: String(err) }); };
      img.src = url; list.push(a);
    }
    props.setAssets(prev => [...prev, ...list]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const performDelete = () => {
    const { type, id } = confirmDelete;
    if (!type || !id) { setConfirmDelete({ visible: false, type: null }); return; }
    doDelete(type, id);
    setConfirmDelete({ visible: false, type: null });
  };

  const cancelDelete = () => setConfirmDelete({ visible: false, type: null });

  // drag highlight helpers
  const onDragEnterFolder = (id: string) => { setHoveredFolderId(id); };
  const onDragLeaveFolder = (id: string) => { setHoveredFolderId(prev => (prev === id ? null : prev)); };

  useEffect(() => {
    const clear = () => setHoveredFolderId(null);
    window.addEventListener('dragend', clear);
    window.addEventListener('drop', clear);
    return () => {
      window.removeEventListener('dragend', clear);
      window.removeEventListener('drop', clear);
    };
  }, []);

  // close context menu when clicking outside
  useEffect(() => {
    if (!contextMenu.visible) return;
    const onDocClick = () => { closeContextMenu(); };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [contextMenu.visible]);

  // keyboard hotkeys when context menu is open (F2, Delete, B, U)
  useEffect(() => {
    if (!contextMenu.visible) return;
    const onKey = (e: KeyboardEvent) => {
      try {
        const key = e.key;
        // rename
        if (key === 'F2') {
          e.preventDefault();
          if (contextMenu.type === 'asset') renameAsset(contextMenu.id);
          if (contextMenu.type === 'folder') renameFolder(contextMenu.id);
          return;
        }
        // delete
        if (key === 'Delete') {
          e.preventDefault();
          if (contextMenu.type === 'asset') deleteAsset(contextMenu.id);
          if (contextMenu.type === 'folder') deleteFolder(contextMenu.id);
          return;
        }
        // set as background (asset only)
        if (key.toLowerCase() === 'b' && contextMenu.type === 'asset') {
          e.preventDefault();
          setAssetAsBackground(contextMenu.id);
          return;
        }
        // upload to folder (folder only)
        if (key.toLowerCase() === 'u' && contextMenu.type === 'folder') {
          e.preventDefault();
          uploadToFolder(contextMenu.id);
          return;
        }
      } catch (err) { /* swallow */ }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [contextMenu.visible, contextMenu.type, contextMenu.id]);

  function FolderSection({ folder, assets, props }: { folder: Folder; assets: Asset[]; props: EditorProps }) {
    const isCollapsed = !!collapsed[folder.id];
    const count = assets.length;
    return (
      <div>
  <div className={`flex items-center justify-between px-2 py-1 rounded text-sm bg-slate-800/30 border border-slate-700 cursor-pointer ${hoveredFolderId===folder.id? 'ring-2 ring-sky-400 bg-sky-400/6':''}`} onClick={() => toggleCollapsed(folder.id)} onDragOver={(e)=> e.preventDefault()} onDragEnter={(e)=> { e.preventDefault(); onDragEnterFolder(folder.id); }} onDragLeave={(e)=> { e.preventDefault(); onDragLeaveFolder(folder.id); }} onDrop={(e)=> { e.preventDefault(); const aid = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('assetId'); if (!aid) return; const fid = folder.id === '__nofolder' ? null : folder.id; props.setAssets(prev => prev.map(a => a.id===aid? {...a, folderId: fid }: a)); setHoveredFolderId(null); }} onContextMenu={(e)=> openContextMenu(e, 'folder', folder.id)}>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 grid place-items-center text-slate-300">{isCollapsed ? <ChevronRight className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}</div>
            <div className="truncate">{folder.name} <span className="text-xs text-slate-400">{count ? `(${count})` : ''}</span></div>
          </div>
          {/* removed drop hint */}
        </div>
        {!isCollapsed && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            {assets.map(a => (
              <div key={a.id} draggable={true} onDragStart={(e)=> { e.dataTransfer.setData('text/plain', a.id); setHoveredFolderId(null); }} onDragEnd={() => setHoveredFolderId(null)} onClick={(e)=> { e.stopPropagation(); setSelectedAssetUI(a.id); }} onContextMenu={(e)=> openContextMenu(e, 'asset', a.id)} className={`group rounded-xl overflow-hidden border ${selectedAssetUI===a.id? 'border-sky-400 bg-sky-400/6':'border-slate-800 hover:border-slate-600'}`}>
                <div className="aspect-square bg-slate-800/60 grid place-items-center">
                  {a.img?.src ? (
                    <img src={a.img.src} alt={a.name} className="max-w-full max-h-full object-contain"/>
                  ) : (a.url ? (
                    <img src={a.url} alt={a.name} className="max-w-full max-h-full object-contain"/>
                  ) : (
                    <ImagePlus/>
                  ))}
                </div>
                <div className="p-2 text-xs text-left truncate text-slate-300 group-hover:text-white">{a.name}</div>
                  <div className="p-2 flex items-center gap-2 text-xs">
                  <select className="bg-slate-800 rounded px-2 py-0.5 text-xs" value={a.folderId||""} onChange={(e)=> { e.stopPropagation(); const fid = e.target.value || null; props.setAssets(prev => prev.map(x => x.id===a.id? {...x, folderId: fid }: x)); }}>
                    <option value="">Nessun folder</option>
                    {props.folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <button title="Elimina asset" className="ml-auto text-red-400 hover:text-red-300 text-xs" onClick={(e)=>{ e.stopPropagation(); setConfirmDelete({ visible: true, type: 'asset', id: a.id, name: a.name }); }}>{/* small delete */}Elimina</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
    {/* Hidden file input for assets upload (handled by onHiddenFileChange) */}
    <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onHiddenFileChange} />
    <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-950 to-black text-slate-100 p-2 grid grid-cols-[280px_1fr_300px] gap-2 select-none">
      {/* Left: Assets */}
      <AssetsPanel
        assets={props.assets}
        setAssets={props.setAssets}
        folders={props.folders}
        setFolders={props.setFolders}
        selectedFolderId={props.selectedFolderId}
        setSelectedFolderId={props.setSelectedFolderId}
        onUploadClick={()=> { if (!fileInputRef.current) return; (fileInputRef.current as any).dataset.targetFolder = props.selectedFolderId || ''; fileInputRef.current.click(); }}
        onSetBackground={(id)=> props.setBackgroundAssetId && props.setBackgroundAssetId(id)}
        onUploadToFolder={(fid)=> { if (!fileInputRef.current) return; (fileInputRef.current as any).dataset.targetFolder = fid || ''; fileInputRef.current.click(); }}
      />

      {/* Center: Canvas & toolbar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-visible backdrop-blur-xl">
        <div className="px-3 py-1 border-b border-slate-800 flex items-center gap-2 relative z-20">
          <MousePointer2 className="w-4 h-4"/><span className="font-semibold">Editor</span>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative group">
              <button className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700" title="Scorciatoie">?</button>
              <div className="absolute right-0 mt-1 w-64 bg-slate-900 border border-slate-700 rounded shadow-lg text-xs p-2 hidden group-hover:block z-30">
                <div className="font-semibold mb-1">Scorciatoie</div>
                <ul className="space-y-0.5 text-slate-200">
                  <li>G: Toggle griglia</li>
                  <li>S: Toggle snap</li>
                  <li>Ctrl/Cmd + ]: Porta in alto</li>
                  <li>Ctrl/Cmd + [: Su di un livello</li>
                  <li>Ctrl/Cmd + Alt + ]: Porta in alto</li>
                  <li>Ctrl/Cmd + Alt + [: Porta in basso</li>
                  <li>Q/E: Ruota sprite selezionato</li>
                  <li>+/-: Scala sprite selezionato</li>
                  <li>,/.: Opacità sprite selezionato</li>
                  <li>Del/Backspace: Elimina sprite</li>
                </ul>
              </div>
            </div>
            <button title="Annulla (Ctrl/Cmd+Z)" className={`px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 ${props.canUndo? '':'opacity-50 cursor-not-allowed'}`} onClick={()=> { if (props.canUndo && props.undo) props.undo(); }}><CornerUpLeft className="w-4 h-4"/></button>
            <button title="Ripeti (Ctrl/Cmd+Y)" className={`px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 ${props.canRedo? '':'opacity-50 cursor-not-allowed'}`} onClick={()=> { if (props.canRedo && props.redo) props.redo(); }}><CornerDownRight className="w-4 h-4"/></button>
            <button className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700" onClick={()=> props.setZoom(Math.min(6, props.zoom * 1.1))}><ZoomIn className="w-4 h-4"/></button>
            <button className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700" onClick={()=> props.setZoom(Math.max(0.1, props.zoom / 1.1))}><ZoomOut className="w-4 h-4"/></button>
            <span className="text-xs text-slate-300 ml-1">{Math.round(props.zoom*100)}%</span>
            <button className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700" onClick={()=> props.setPan({x:40,y:40})}><Move className="w-4 h-4"/></button>
            <span className="mx-2 h-5 w-px bg-slate-700 inline-block" />
            <button className={`px-2 py-0.5 rounded-lg ${props.grid? "bg-sky-700/50":"bg-slate-800 hover:bg-slate-700"}`} onClick={()=> props.setGrid(!props.grid)}><Grid3X3 className="w-4 h-4"/></button>
            <button className={`px-2 py-0.5 rounded-lg ${props.snap? "bg-sky-700/50":"bg-slate-800 hover:bg-slate-700"}`} onClick={()=> props.setSnap(!props.snap)}><Maximize2 className="w-4 h-4"/></button>
            <div className="text-xs text-slate-300 px-1">Grid: {props.gridSize}px</div>
            <input type="range" min={8} max={256} step={8} value={props.gridSize} onChange={(e)=> props.setGridSize(parseInt(e.target.value))} />
            {/* Export buttons */}
            <div className="relative inline-block group">
            <button className="ml-2 px-2 py-0.5 rounded-lg bg-sky-600 hover:bg-sky-500 flex items-center gap-1" title="Esporta PNG" onClick={()=> {
              let scale = 1;
              try { const s = parseFloat(localStorage.getItem('lastExportScale')||''); if (s>0 && s<=1) scale = s; } catch {}
              const out = renderToCanvas({ assets: props.assets, sprites: props.sprites, backgroundAssetId: props.backgroundAssetId || null, mapSize: props.mapSize, scale, transparent: false });
              const label = scale === 1 ? '100' : String(Math.round(scale*100));
              out.toBlob((blob)=> { if (!blob) return; downloadBlob(blob, `map_${Date.now()}_${label}.png`); }, "image/png");
            }}><Download className="w-4 h-4"/>Esporta</button>
            <div className="absolute left-0 mt-1 w-40 bg-slate-900 border border-slate-700 rounded shadow hidden group-hover:block">
              {([1, 0.75, 0.5, 0.25] as number[]).map(scale => (
                <button key={scale}
                  className="w-full text-left px-3 py-1 hover:bg-slate-800 text-sm"
                   onClick={()=> {
                     try { localStorage.setItem('lastExportScale', String(scale)); } catch {}
                     const out = renderToCanvas({ assets: props.assets, sprites: props.sprites, backgroundAssetId: props.backgroundAssetId || null, mapSize: props.mapSize, scale, transparent: false });
                     const label = scale === 1 ? '100' : String(Math.round(scale*100));
                     out.toBlob((blob)=> { if (!blob) return; downloadBlob(blob, `map_${Date.now()}_${label}.png`); }, 'image/png');
                   }}>
                   Esporta {Math.round(scale*100)}%
                 </button>
              ))}
            </div>
            </div>
            <button title="Download logs" className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700" onClick={()=> { logger.download(); }}><Download className="w-4 h-4 inline mr-1"/>Log</button>
            <button title="Pulisci log" className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700" onClick={()=> { logger.clear(); alert('Log cancellati'); }}><Trash2 className="w-4 h-4 inline mr-1"/>Clear</button>
          </div>
        </div>
        <div className="relative h-full min-h-0 px-3 py-3">
          {(() => { const px = props.mapSize.w * props.mapSize.h; let thr = 20_000_000; try { const t = parseInt(localStorage.getItem('largeMapThresholdPx')||''); if (Number.isFinite(t) && t>0) thr = t; } catch {}; if (px > thr) {
            return (
              <div className="absolute right-3 top-3 z-10 text-xs text-amber-200 bg-amber-900/40 border border-amber-600 rounded px-2 py-1">
                Mappa molto grande ({(props.mapSize.w)}×{(props.mapSize.h)}). Suggerimento: usa export downscale.
                <button className="ml-2 underline hover:no-underline" onClick={()=> {
                  const scale = 0.5;
                  const out = renderToCanvas({ assets: props.assets, sprites: props.sprites, backgroundAssetId: props.backgroundAssetId || null, mapSize: props.mapSize, scale, transparent: false });
                  out.toBlob((blob)=> { if (!blob) return; downloadBlob(blob, `map_${Date.now()}_50.png`); }, 'image/png');
                }}>Esporta 50%</button>
              </div>
            );
          } return null; })()}
          <div className="flex gap-3 items-start">
            <ToolsBar selected={selectedTool} onChange={setSelectedTool} />
            <div className="relative flex-1 min-h-0">
              <MapCanvas
                sprites={props.sprites}
                setSprites={props.setSprites}
                setSpritesImmediate={props.setSpritesImmediate}
                selectedId={props.selectedId} setSelectedId={props.setSelectedId}
                tool={selectedTool}
                grid={props.grid} snap={props.snap} gridSize={props.gridSize}
                zoom={props.zoom} setZoom={props.setZoom} pan={props.pan} setPan={props.setPan}
                mapSize={props.mapSize}
                assets={props.assets}
                backgroundAssetId={props.backgroundAssetId}
                onRequestDelete={(id) => { if (!id) return; if (skipConfirm) { doDelete('sprite', id); } else { setConfirmDelete({ visible: true, type: 'sprite', id, name: props.sprites.find(s=>s.id===id)?.name || 'sprite' }); } }}
                onInteractStart={props.onSpriteInteractStart}
                onInteractEnd={props.onSpriteInteractEnd}
              />
              <TopStatus zoom={props.zoom} pan={props.pan} mapSize={props.mapSize} loadingAssetsCount={props.loadingAssetsCount}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right: Properties / Layers */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-visible backdrop-blur-xl">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2"><PanelRight className="w-4 h-4"/><span className="font-semibold">Proprietà</span></div>
        <div className="p-3 space-y-4">
          <div className="space-y-3">
            <Inspector
              selectedSprite={props.selectedSprite}
              changeSelected={props.changeSelected}
              setSprites={props.setSprites}
              selectedId={props.selectedId}
              grid={props.grid}
              snap={props.snap}
              gridSize={props.gridSize}
              setGrid={props.setGrid}
              setSnap={props.setSnap}
              setGridSize={props.setGridSize}
              mapSize={props.mapSize}
              setMapSize={props.setMapSize}
              assets={props.assets}
              backgroundAssetId={props.backgroundAssetId}
            />
          </div>

          <hr className="border-slate-800"/>
          <div className="space-y-2">
            <div className="text-xs text-slate-400">Layer (alto = sopra)</div>
            <div className="h-[50vh] overflow-auto flex flex-col gap-2">
              {[...props.sprites].sort((a,b)=> b.z - a.z).map(s => (
                <div key={s.id} className={`flex items-center justify-between gap-2 p-2 rounded-lg border ${s.id===props.selectedId? "border-sky-400 bg-sky-400/10":"border-slate-800 bg-slate-800/40"}`} onClick={()=> props.setSelectedId(s.id)} onContextMenu={(e)=> { e.preventDefault(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, type: 'sprite', id: s.id, name: s.name }); }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-md overflow-hidden bg-slate-900 grid place-items-center border border-slate-700">
                      <img src={(s.img && s.img.src) || (props.assets.find(a => a.name === s.name)?.img?.src || props.assets.find(a => a.name === s.name)?.url || '')} alt={s.name} className="max-w-full max-h-full object-contain"/>
                    </div>
                    <div className="truncate text-sm">{s.name}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="p-1 rounded hover:bg-slate-800" title="Blocca/Sblocca" onClick={(e)=> {e.stopPropagation(); props.setSprites(prev => prev.map(x => x.id===s.id? {...x, locked: !x.locked }: x));}}>{s.locked? <Lock className="w-4 h-4"/> : <LockOpen className="w-4 h-4"/>}</button>
                    <button className="p-1 rounded hover:bg-slate-800" title="Porta in alto" onClick={(e)=> {e.stopPropagation(); props.setSprites(prev => prev.map(x => x.id===s.id? {...x, z: Math.max(...prev.map(p=>p.z))+1 }: x));}}><Replace className="w-4 h-4"/></button>
                    <button className="p-1 rounded hover:bg-slate-800" title="Porta in basso" onClick={(e)=> {e.stopPropagation(); props.setSprites(prev => prev.map(x => x.id===s.id? {...x, z: Math.min(...prev.map(p=>p.z))-1 }: x));}}><Layers className="w-4 h-4"/></button>
                    <button className="p-1 rounded hover:bg-slate-800" title="Su (z+1)" onClick={(e)=> { e.stopPropagation(); props.setSprites(prev => {
                      const cur = prev.find(x=>x.id===s.id); if (!cur) return prev;
                      const higher = [...prev].filter(x=> x.z>cur.z).sort((a,b)=> a.z-b.z)[0];
                      if (!higher) return prev; const hz = higher.z; const cz = cur.z; return prev.map(x => x.id===s.id? {...x, z: hz }: (x.id===higher.id? {...x, z: cz }: x));
                    });}}><ChevronUp className="w-4 h-4"/></button>
                    <button className="p-1 rounded hover:bg-slate-800" title="Giu (z-1)" onClick={(e)=> { e.stopPropagation(); props.setSprites(prev => {
                      const cur = prev.find(x=>x.id===s.id); if (!cur) return prev;
                      const lower = [...prev].filter(x=> x.z<cur.z).sort((a,b)=> b.z-a.z)[0];
                      if (!lower) return prev; const lz = lower.z; const cz = cur.z; return prev.map(x => x.id===s.id? {...x, z: lz }: (x.id===lower.id? {...x, z: cz }: x));
                    });}}><ChevronDown className="w-4 h-4"/></button>
                    <button title="Elimina sprite" className="p-1 rounded hover:bg-red-700 text-red-400" onClick={(e)=> { e.stopPropagation(); setConfirmDelete({ visible: true, type: 'sprite', id: s.id, name: s.name }); }}><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <hr className="border-slate-800"/>
          <div className="space-y-2">
            <div className="text-xs text-slate-400">Dimensioni mappa (px)</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2"><span className="w-5 text-xs text-slate-400">W</span><input type="number" className="w-full bg-slate-800 rounded px-2 py-1" value={props.mapSize.w} onChange={(e)=> props.setMapSize(ms=>({ ...ms, w: Math.max(256, parseInt(e.target.value||"0")) }))}/></div>
              <div className="flex items-center gap-2"><span className="w-5 text-xs text-slate-400">H</span><input type="number" className="w-full bg-slate-800 rounded px-2 py-1" value={props.mapSize.h} onChange={(e)=> props.setMapSize(ms=>({ ...ms, h: Math.max(256, parseInt(e.target.value||"0")) }))}/></div>
            </div>
          </div>
        </div>
      </div>

      {/* Shortcuts hint */}
      {/* context menu */}
      {contextMenu.visible && (
        <div onClick={(e)=> e.stopPropagation()} style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 9999 }}>
          <div className="bg-slate-800 border border-slate-700 rounded shadow text-sm text-slate-100 w-44">
            {contextMenu.type === 'asset' && (
              <div>
                <div className="p-2 hover:bg-slate-700 cursor-pointer flex items-center justify-between" onClick={() => renameAsset(contextMenu.id)}>
                  <div className="flex items-center gap-2"><Replace className="w-4 h-4"/>Rinomina</div>
                  <div className="text-xs text-slate-400">F2</div>
                </div>
                <div className="p-2 hover:bg-slate-700 cursor-pointer flex items-center justify-between" onClick={() => deleteAsset(contextMenu.id)}>
                  <div className="flex items-center gap-2"><Trash2 className="w-4 h-4 text-red-400"/>Elimina</div>
                  <div className="text-xs text-slate-400">Del</div>
                </div>
                <div className="p-2 hover:bg-slate-700 cursor-pointer flex items-center justify-between" onClick={() => setAssetAsBackground(contextMenu.id)}>
                  <div className="flex items-center gap-2"><ImagePlus className="w-4 h-4"/>Imposta come background</div>
                  <div className="text-xs text-slate-400">B</div>
                </div>
              </div>
            )}
            {contextMenu.type === 'folder' && (
              <div>
                <div className="p-2 hover:bg-slate-700 cursor-pointer flex items-center justify-between" onClick={() => renameFolder(contextMenu.id)}>
                  <div className="flex items-center gap-2"><Replace className="w-4 h-4"/>Rinomina</div>
                  <div className="text-xs text-slate-400">F2</div>
                </div>
                <div className="p-2 hover:bg-slate-700 cursor-pointer flex items-center justify-between" onClick={() => deleteFolder(contextMenu.id)}>
                  <div className="flex items-center gap-2"><Trash2 className="w-4 h-4 text-red-400"/>Elimina</div>
                  <div className="text-xs text-slate-400">Del</div>
                </div>
                <div className="p-2 hover:bg-slate-700 cursor-pointer flex items-center justify-between" onClick={() => uploadToFolder(contextMenu.id)}>
                  <div className="flex items-center gap-2"><Upload className="w-4 h-4"/>Carica in cartella</div>
                  <div className="text-xs text-slate-400">U</div>
                </div>
              </div>
            )}
            {contextMenu.type === 'sprite' && (
              <div>
                <div className="p-2 hover:bg-slate-700 cursor-pointer" onClick={() => { const id = contextMenu.id!; const s = props.sprites.find(x=>x.id===id); if (!s) return; const name = prompt('Rinomina sprite', s.name); if (name && name.trim()) props.setSprites(prev => prev.map(x => x.id===id? {...x, name: name.trim() }: x)); closeContextMenu(); }}>Rinomina</div>
                <div className="p-2 hover:bg-slate-700 cursor-pointer" onClick={() => { const id = contextMenu.id!; setConfirmDelete({ visible: true, type: 'sprite', id, name: props.sprites.find(x=>x.id===id)?.name }); closeContextMenu(); }}>Elimina</div>
                <div className="h-px bg-slate-700 mx-2"/>
                <div className="p-2 hover:bg-slate-700 cursor-pointer" onClick={() => { const id = contextMenu.id!; props.setSprites(prev => prev.map(x => x.id===id? {...x, z: Math.max(...prev.map(p=>p.z))+1 }: x)); closeContextMenu(); }}>Porta in alto</div>
                <div className="p-2 hover:bg-slate-700 cursor-pointer" onClick={() => { const id = contextMenu.id!; props.setSprites(prev => prev.map(x => x.id===id? {...x, z: Math.min(...prev.map(p=>p.z))-1 }: x)); closeContextMenu(); }}>Porta in basso</div>
                <div className="p-2 hover:bg-slate-700 cursor-pointer" onClick={() => { const id = contextMenu.id!; props.setSprites(prev => { const cur = prev.find(x=>x.id===id); if (!cur) return prev; const higher = [...prev].filter(x=> x.z>cur.z).sort((a,b)=> a.z-b.z)[0]; if (!higher) return prev; const hz=higher.z, cz=cur.z; return prev.map(x=> x.id===id? {...x,z:hz}: (x.id===higher.id? {...x,z:cz}:x)); }); closeContextMenu(); }}>Su (z+1)</div>
                <div className="p-2 hover:bg-slate-700 cursor-pointer" onClick={() => { const id = contextMenu.id!; props.setSprites(prev => { const cur = prev.find(x=>x.id===id); if (!cur) return prev; const lower = [...prev].filter(x=> x.z<cur.z).sort((a,b)=> b.z-a.z)[0]; if (!lower) return prev; const lz=lower.z, cz=cur.z; return prev.map(x=> x.id===id? {...x,z:lz}: (x.id===lower.id? {...x,z:cz}:x)); }); closeContextMenu(); }}>Giù (z-1)</div>
                <div className="h-px bg-slate-700 mx-2"/>
                <div className="p-2 hover:bg-slate-700 cursor-pointer" onClick={() => { const id = contextMenu.id!; props.setSprites(prev => prev.map(x => x.id===id? {...x, locked: !x.locked }: x)); closeContextMenu(); }}>{(() => { const id = contextMenu.id!; const s = props.sprites.find(x=>x.id===id); return s?.locked? 'Sblocca' : 'Blocca'; })()}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 text-[11px] text-slate-300 bg-black/50 backdrop-blur px-3 py-1 rounded-lg border border-slate-800 shadow">
        CTRL/CMD + rotellina = Zoom • Rotellina = Pan • Shift + Rotellina = Pan orizzontale • Frecce = muovi (Shift = scatto) • Del = elimina • +/- = zoom
      </div>
    </div>

      {/* Confirm delete modal */}
      {confirmDelete.visible && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={cancelDelete}>
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 w-80 text-slate-100" onClick={(e)=> e.stopPropagation()}>
            <div className="text-lg font-semibold mb-2">Conferma eliminazione</div>
            <div className="text-sm text-slate-300 mb-4">Sei sicuro di voler eliminare <strong className="text-white">{confirmDelete.name}</strong>? Questa azione è irreversibile.</div>
            <div className="mb-3 flex items-center gap-2 text-sm">
              <input id="skipConfirm" type="checkbox" className="mr-2" checked={skipConfirm} onChange={(e)=> setSkipConfirmPersist(e.target.checked)} />
              <label htmlFor="skipConfirm" className="text-slate-300">Non chiedere più</label>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700" onClick={cancelDelete}>Annulla</button>
              <button className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white" onClick={performDelete}>Elimina</button>
            </div>
          </div>
        </div>
      )}
      </>
  );
}







