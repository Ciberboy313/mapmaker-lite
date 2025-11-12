import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { logger, initGlobalErrorHandlers } from './logger';
import { Download, Eye, EyeOff, Grid3X3, ImagePlus, Layers, Lock, LockOpen, MousePointer2, Move, Replace, RotateCw, Trash2, Upload, ZoomIn, ZoomOut, Maximize2, PanelLeft, PanelRight, Check, X, ChevronDown, ChevronRight, CornerUpLeft, CornerDownRight } from "lucide-react";

type Sprite = {
  id: string;
  name: string;
  img: HTMLImageElement;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  z: number;
};

type Asset = {
  id: string;
  name: string;
  url: string;
  img?: HTMLImageElement;
  w?: number;
  h?: number;
  folderId?: string | null;
};

type Folder = {
  id: string;
  name: string;
};

function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
function degToRad(d: number) { return (d * Math.PI) / 180; }
function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function pointInSprite(px: number, py: number, s: Sprite, imgw: number, imgh: number) {
  const cx = s.x, cy = s.y;
  const cos = Math.cos(degToRad(s.rotation));
  const sin = Math.sin(degToRad(s.rotation));
  const dx = px - cx, dy = py - cy;
  const lx = (dx * cos + dy * sin) / s.scale;
  const ly = (-dx * sin + dy * cos) / s.scale;
  return lx >= 0 && ly >= 0 && lx <= imgw && ly <= imgh;
}

type CanvasProps = {
  sprites: Sprite[];
  setSprites: React.Dispatch<React.SetStateAction<Sprite[]>>;
  selectedId?: string | null;
  setSelectedId: (id: string | null) => void;
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
};

function MapCanvas({ sprites, setSprites, selectedId, setSelectedId, grid, snap, gridSize, zoom, setZoom, pan, setPan, mapSize, assets, backgroundAssetId, onRequestDelete }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hoveringRef = useRef<string | null>(null);
  const draggingRef = useRef<{ id: string; offsetX: number; offsetY: number; startScale?: number; startRotation?: number } | null>(null);
  const rotatingRef = useRef<{ id: string; startX: number; startRotation: number } | null>(null);
  const panningRef = useRef<boolean>(false);

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
      // draw background image if set
      if (backgroundAssetId) {
        const bg = assets.find(a => a.id === backgroundAssetId);
        if (bg && bg.img && bg.img.complete) {
          try {
            ctx.drawImage(bg.img, 0, 0, mapSize.w, mapSize.h);
          } catch (e) {
            // draw fallback fill if drawImage fails
            ctx.fillStyle = "#0f162b"; ctx.fillRect(0,0,mapSize.w,mapSize.h);
          }
        } else {
          ctx.fillStyle = "#0f162b"; ctx.fillRect(0,0,mapSize.w,mapSize.h);
        }
      } else {
        ctx.fillStyle = "#0f162b"; ctx.fillRect(0,0,mapSize.w,mapSize.h);
      }
      const ordered = [...sprites].sort((a,b)=> a.z - b.z);
      for (const s of ordered) {
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
  }, [sprites, selectedId, grid, zoom, pan, gridSize, mapSize, assets, backgroundAssetId]);

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (clientX - rect.left - pan.x) / zoom;
    const y = (clientY - rect.top - pan.y) / zoom;
    return { x, y };
  }, [pan.x, pan.y, zoom]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    // If a sprite is hovered and selected, allow sprite transforms via modifiers
    const hovered = hoveringRef.current;
    // If there is a selected sprite, allow modifier+wheel to transform it even if cursor is not hovering
    // Priority: Alt = rotate (when pressed), Ctrl/Cmd = scale (preferred by user), Shift = scale as legacy
    if (selectedId) {
      // Alt + wheel => rotate selected sprite
      if (e.altKey) {
        e.preventDefault();
        setSprites(prev => prev.map(s => s.id === selectedId ? { ...s, rotation: s.rotation + (e.deltaY > 0 ? 2 : -2) } : s));
        return;
      }
      // Ctrl/Cmd + wheel => scale selected sprite (user expectation)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setSprites(prev => prev.map(s => s.id === selectedId ? { ...s, scale: Math.max(0.01, s.scale * (e.deltaY > 0 ? 0.95 : 1.05)) } : s));
        return;
      }
      // Shift + wheel => scale selected sprite (legacy alternate)
      if (e.shiftKey) {
        e.preventDefault();
        setSprites(prev => prev.map(s => s.id === selectedId ? { ...s, scale: Math.max(0.01, s.scale * (e.deltaY > 0 ? 0.95 : 1.05)) } : s));
        return;
      }
    }

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      // compute client coords relative to canvas
      const rect = canvasRef.current!.getBoundingClientRect();
      const nx = e.clientX - rect.left;
      const ny = e.clientY - rect.top;
      // current world coordinates under cursor
      const { x, y } = toWorld(e.clientX, e.clientY);
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(6, Math.max(0.1, zoom * factor));
      // set pan so that the world point (x,y) remains under the same canvas pixel (nx,ny)
      setPan({ x: nx - x * newZoom, y: ny - y * newZoom });
      setZoom(newZoom);
    } else if (e.shiftKey) {
      setPan({ x: pan.x - e.deltaY, y: pan.y });
    } else {
      setPan({ x: pan.x - e.deltaX, y: pan.y - e.deltaY });
    }
  }, [zoom, pan, setZoom, setPan, toWorld]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const { x, y } = toWorld(e.clientX, e.clientY);
    if (panningRef.current) return;
    if (rotatingRef.current) {
      // perform rotation while holding Alt and dragging
      const r = rotatingRef.current;
      const dx = e.clientX - r.startX;
      const angle = r.startRotation + dx * 0.3; // sensitivity
      setSprites(prev => prev.map(s => s.id === r.id ? { ...s, rotation: angle } : s));
      return;
    }
    try {
      const dr = draggingRef.current;
      if (dr) {
        setSprites(prev => prev.map(s => {
          if (s.id !== dr.id) return s;
          // convert stored local offsets (lx,ly) back to world-space using startRotation/startScale
          const r = (dr.startRotation ?? s.rotation);
          const sc = (dr.startScale ?? s.scale);
          const rad = degToRad(r);
          const cosR = Math.cos(rad);
          const sinR = Math.sin(rad);
          // inverse transform: worldDx = sc * (lx * cosR - ly * sinR)
          const worldDx = sc * (dr.offsetX * cosR - dr.offsetY * sinR);
          const worldDy = sc * (dr.offsetX * sinR + dr.offsetY * cosR);
          const nx = x - worldDx;
          const ny = y - worldDy;
          return { ...s, x: nx, y: ny };
        }));
        return;
      }
    } catch (err) {
      logger.error('onMouseMove drag handling failed', { err: String(err) });
    }
    const ordered = [...sprites].sort((a,b)=> b.z - a.z);
    hoveringRef.current = null;
    for (const s of ordered) {
      if (!s.visible) continue;
      const img = s.img; if (!img) continue;
      if (pointInSprite(x, y, s, img.width, img.height)) { hoveringRef.current = s.id; break; }
    }
  }, [sprites, toWorld, setSprites]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 2 || (e.nativeEvent as any).altKey || (e.shiftKey && e.button === 0)) {
      panningRef.current = true; return;
    }
    const { x, y } = toWorld(e.clientX, e.clientY);
    const ordered = [...sprites].sort((a,b)=> b.z - a.z);
    let picked: Sprite | null = null;
    for (const s of ordered) {
      if (!s.visible || s.locked) continue;
      const img = s.img; if (!img) continue;
      if (pointInSprite(x, y, s, img.width, img.height)) { picked = s; break; }
    }
    if (picked) {
      setSelectedId(picked.id);
      // if Alt is pressed, start rotation mode instead of dragging
      if (e.altKey) {
        rotatingRef.current = { id: picked.id, startX: e.clientX, startRotation: picked.rotation };
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
  }, [sprites, setSelectedId, toWorld]);

  const onMouseUp = useCallback(() => { draggingRef.current = null; rotatingRef.current = null; panningRef.current = false; }, []);
  const onContextMenu = useCallback((e: React.MouseEvent) => { e.preventDefault(); }, []);
  const onMouseLeave = useCallback(() => { draggingRef.current = null; panningRef.current = false; }, []);
  const onMouseMovePan = useCallback((e: React.MouseEvent) => { if (!panningRef.current) return; setPan({ x: pan.x + e.movementX, y: pan.y + e.movementY }); }, [pan, setPan]);

  // handle drop of asset onto canvas to create a new sprite
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const assetId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('assetId');
    if (!assetId) return;
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;
    const { x, y } = toWorld(e.clientX, e.clientY);
    const img = asset.img ?? (() => { const im = new Image(); im.src = asset.url; return im; })();
    const s: Sprite = {
      id: uid('sprite'), name: asset.name, img: img as HTMLImageElement,
      x, y, scale: 1, rotation: 0, opacity: 1, visible: true, locked: false,
      z: sprites.length ? Math.max(...sprites.map(s => s.z)) + 1 : 1
    };
    setSprites(prev => [...prev, s]);
    setSelectedId(s.id);
  }, [assets, sprites, setSprites, setSelectedId, toWorld]);

  const onDragOverCanvas = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "+") setZoom(Math.min(6, zoom * 1.1));
      if (e.key === "-") setZoom(Math.max(0.1, zoom / 1.1));
      if (!selectedId) return;
      if (["Delete","Backspace"].includes(e.key)) {
        if (onRequestDelete) onRequestDelete(selectedId);
        else setSprites(prev => prev.filter(s => s.id !== selectedId));
      }
      const delta = e.shiftKey ? 16 : 1;
      if (e.key === "ArrowLeft") setSprites(prev => prev.map(s => s.id === selectedId ? { ...s, x: s.x - delta } : s));
      if (e.key === "ArrowRight") setSprites(prev => prev.map(s => s.id === selectedId ? { ...s, x: s.x + delta } : s));
      if (e.key === "ArrowUp") setSprites(prev => prev.map(s => s.id === selectedId ? { ...s, y: s.y - delta } : s));
      if (e.key === "ArrowDown") setSprites(prev => prev.map(s => s.id === selectedId ? { ...s, y: s.y + delta } : s));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, setSprites, setZoom, zoom]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
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
  const [assets, setAssets] = useState<Asset[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [sprites, setSpritesState] = useState<Sprite[]>([]);
  // undo/redo stacks for sprites
  const [undoStack, setUndoStack] = useState<Sprite[][]>([]);
  const [redoStack, setRedoStack] = useState<Sprite[][]>([]);
  const spritesRef = useRef<Sprite[]>(sprites);
  useEffect(() => { spritesRef.current = sprites; }, [sprites]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [backgroundAssetId, setBackgroundAssetId] = useState<string | null>(() => {
    try { return localStorage.getItem("backgroundAssetId"); } catch (e) { return null; }
  });
  useEffect(() => {
    try { if (backgroundAssetId) localStorage.setItem('backgroundAssetId', backgroundAssetId); else localStorage.removeItem('backgroundAssetId'); } catch (e) {}
  }, [backgroundAssetId]);

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
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
      if (key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const [grid, setGrid] = useState(true);
  const [snap, setSnap] = useState(true);
  const [gridSize, setGridSize] = useState(64);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [mapSize, setMapSize] = useState({ w: 4096, h: 3072 });

  const selectedSprite = useMemo(() => sprites.find(s => s.id === selectedId) || null, [sprites, selectedId]);
  const changeSelected = useCallback((patch: Partial<Sprite>) => {
    if (!selectedId) return;
    setSpritesWithHistory(prev => prev.map(s => s.id === selectedId ? { ...s, ...patch } : s));
  }, [selectedId]);

  return (
    <EditorUI
      assets={assets} setAssets={setAssets}
      folders={folders} setFolders={setFolders} selectedFolderId={selectedFolderId} setSelectedFolderId={setSelectedFolderId}
      sprites={sprites} setSprites={setSpritesWithHistory}
      selectedId={selectedId} setSelectedId={setSelectedId}
      backgroundAssetId={backgroundAssetId} setBackgroundAssetId={setBackgroundAssetId}
      undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo}
      grid={grid} setGrid={setGrid} snap={snap} setSnap={setSnap} gridSize={gridSize} setGridSize={setGridSize}
      zoom={zoom} setZoom={setZoom} pan={pan} setPan={setPan}
      mapSize={mapSize} setMapSize={setMapSize}
      selectedSprite={selectedSprite} changeSelected={changeSelected}
    />
  );
}

type EditorProps = {
  assets: Asset[]; setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
  folders: Folder[]; setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  selectedFolderId: string | null; setSelectedFolderId: (id: string | null)=>void;
  sprites: Sprite[]; setSprites: React.Dispatch<React.SetStateAction<Sprite[]>>;
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
};

function EditorUI(props: EditorProps) {
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
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; type: 'asset'|'folder'|'none'; id?: string | null }>({ visible: false, x: 0, y: 0, type: 'none', id: null });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const openContextMenu = (e: React.MouseEvent, type: 'asset'|'folder', id?: string) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, type, id });
  };
  const closeContextMenu = () => setContextMenu({ visible: false, x: 0, y: 0, type: 'none', id: null });

  // context menu actions
  const [confirmDelete, setConfirmDelete] = useState<{ visible: boolean; type: 'asset'|'folder'|'sprite'|null; id?: string | null; name?: string }>(
    { visible: false, type: null }
  );

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
      props.setAssets(prev => prev.filter(a => a.id !== id));
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
      const a: Asset = { id, name: f.name, url, folderId: targetFolder || null };
      const img = new Image(); img.onload = () => { a.img = img; a.w = img.width; a.h = img.height; props.setAssets(prev => [...prev]); };
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
          <div className="text-xs text-slate-400">Drop qui</div>
        </div>
        {!isCollapsed && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            {assets.map(a => (
              <div key={a.id} draggable={true} onDragStart={(e)=> { e.dataTransfer.setData('text/plain', a.id); setHoveredFolderId(null); }} onDragEnd={() => setHoveredFolderId(null)} onClick={(e)=> { e.stopPropagation(); setSelectedAssetUI(a.id); }} onContextMenu={(e)=> openContextMenu(e, 'asset', a.id)} className={`group rounded-xl overflow-hidden border ${selectedAssetUI===a.id? 'border-sky-400 bg-sky-400/6':'border-slate-800 hover:border-slate-600'}`}>
                <div className="aspect-square bg-slate-800/60 grid place-items-center">
                  {a.url ? <img src={a.url} alt={a.name} className="max-w-full max-h-full object-contain"/> : <ImagePlus/>}
                </div>
                <div className="p-2 text-xs text-left truncate text-slate-300 group-hover:text-white">{a.name}</div>
                  <div className="p-2 flex items-center gap-2 text-xs">
                  {props.backgroundAssetId === a.id ? <span className="px-2 py-0.5 rounded bg-sky-600 text-white">Background</span> : (
                    <button className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700" onClick={(e)=>{e.stopPropagation(); props.setBackgroundAssetId && props.setBackgroundAssetId(a.id); try{ localStorage.setItem('backgroundAssetId', a.id); }catch(_){} }}>Imposta BG</button>
                  )}
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
    <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black text-slate-100 p-3 grid grid-cols-[300px_1fr_320px] gap-3 select-none">
      {/* Left: Assets */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-xl">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2"><PanelLeft className="w-4 h-4"/><span className="font-semibold">Assets</span></div>
        <div className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            <select className="bg-slate-800 rounded px-2 py-1 text-sm w-36 shrink-0" value={props.selectedFolderId || ""} onChange={(e)=> props.setSelectedFolderId(e.target.value || null)}>
              <option value="">Tutti i folder</option>
              {props.folders.map(f=> <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <button type="button" className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sm" onClick={()=> setCreatingFolder(true)}>Nuova cartella</button>
          </div>
          {/* Inline new-folder input + folder drop targets */}
          <div className="mt-2">
            {creatingFolder && (
              <div className="flex items-center gap-2 px-2 py-1 bg-slate-800/60 border border-slate-700 rounded mb-2">
                <input autoFocus value={newFolderName} onChange={(e)=> setNewFolderName(e.target.value)} onKeyDown={(e)=> { if (e.key === 'Enter') { createFolder(); } if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName(''); } }} className="bg-transparent outline-none text-sm flex-1" placeholder="Nome cartella" />
                <button className="p-1 rounded hover:bg-slate-700" onClick={createFolder} title="Crea"><Check className="w-4 h-4"/></button>
                <button className="p-1 rounded hover:bg-slate-700" onClick={()=> { setCreatingFolder(false); setNewFolderName(''); }} title="Annulla"><X className="w-4 h-4"/></button>
              </div>
            )}
            <div className="flex flex-col gap-1 max-h-28 overflow-auto pr-1">
              {props.folders.map(folder => (
                <div key={folder.id}
                  className={`px-2 py-1 rounded text-sm bg-slate-800/40 border border-slate-700 flex items-center justify-between ${props.selectedFolderId===folder.id? 'ring-2 ring-sky-600':''} ${hoveredFolderId===folder.id? 'ring-2 ring-sky-400 bg-sky-400/6':''}`}
                  onDragOver={(e)=> e.preventDefault()}
                  onDragEnter={(e)=> { e.preventDefault(); onDragEnterFolder(folder.id); }}
                  onDragLeave={(e)=> { e.preventDefault(); onDragLeaveFolder(folder.id); }}
                  onDrop={(e)=> { e.preventDefault(); const aid = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('assetId'); if (!aid) return; props.setAssets(prev => prev.map(a => a.id===aid? {...a, folderId: folder.id }: a)); setHoveredFolderId(null); }}
                  onContextMenu={(e)=> openContextMenu(e, 'folder', folder.id)}
                >
                  <div className="truncate">{folder.name}</div>
                  <div className="text-xs text-slate-400">Drop qui</div>
                </div>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-dashed border-slate-700 p-3 hover:border-slate-500 transition cursor-pointer">
            <Upload className="w-4 h-4"/>
            <span>Carica PNG / WEBP / JPG</span>
            <input multiple type="file" accept="image/*" className="hidden" onChange={(e)=> {
              const files = e.target.files; if (!files) return;
              const list: Asset[] = []; 
              for (const f of Array.from(files)) {
                if (!f.type.startsWith("image/")) continue;
                const url = URL.createObjectURL(f); const id = uid("asset");
                const a: Asset = { id, name: f.name, url, folderId: props.selectedFolderId || null };
                const img = new Image();
                img.onload = () => { a.img = img; a.w = img.width; a.h = img.height; props.setAssets(prev => [...prev]); };
                img.src = url; list.push(a);
              }
              props.setAssets(prev => [...prev, ...list]);
            }} />
            {/* hidden input used by context-menu uploads */}
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onHiddenFileChange} />
          </label>
          <div className="h-[70vh] pr-1 overflow-auto">
            {/* Collapsible folder sections (VS Code style) */}
            <div className="space-y-2">
              {props.folders.map(folder => {
                const assetsIn = props.assets.filter(a => a.folderId === folder.id);
                return (
                  <FolderSection
                    key={folder.id}
                    folder={folder}
                    assets={assetsIn}
                    props={props}
                  />
                );
              })}

              {/* Unassigned assets */}
              <FolderSection
                key="__nofolder"
                folder={{ id: '__nofolder', name: 'Senza folder' }}
                assets={props.assets.filter(a => !a.folderId)}
                props={props}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Center: Canvas & toolbar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-xl">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
          <MousePointer2 className="w-4 h-4"/><span className="font-semibold">Editor</span>
          <div className="ml-auto flex items-center gap-2">
            <button title="Annulla (Ctrl/Cmd+Z)" className={`px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 ${props.canUndo? '':'opacity-50 cursor-not-allowed'}`} onClick={()=> { if (props.canUndo && props.undo) props.undo(); }}><CornerUpLeft className="w-4 h-4"/></button>
            <button title="Ripeti (Ctrl/Cmd+Y)" className={`px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 ${props.canRedo? '':'opacity-50 cursor-not-allowed'}`} onClick={()=> { if (props.canRedo && props.redo) props.redo(); }}><CornerDownRight className="w-4 h-4"/></button>
            <button className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700" onClick={()=> props.setZoom(Math.min(6, props.zoom * 1.1))}><ZoomIn className="w-4 h-4"/></button>
            <button className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700" onClick={()=> props.setZoom(Math.max(0.1, props.zoom / 1.1))}><ZoomOut className="w-4 h-4"/></button>
            <button className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700" onClick={()=> props.setPan({x:40,y:40})}><Move className="w-4 h-4"/></button>
            <span className="mx-2 h-5 w-px bg-slate-700 inline-block" />
            <button className={`px-2 py-1 rounded-lg ${props.grid? "bg-sky-700/50":"bg-slate-800 hover:bg-slate-700"}`} onClick={()=> props.setGrid(!props.grid)}><Grid3X3 className="w-4 h-4"/></button>
            <button className={`px-2 py-1 rounded-lg ${props.snap? "bg-sky-700/50":"bg-slate-800 hover:bg-slate-700"}`} onClick={()=> props.setSnap(!props.snap)}><Maximize2 className="w-4 h-4"/></button>
            <div className="text-xs text-slate-300 px-2">Grid: {props.gridSize}px</div>
            <input type="range" min={8} max={256} step={8} value={props.gridSize} onChange={(e)=> props.setGridSize(parseInt(e.target.value))} />
            <button className="ml-2 px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 flex items-center gap-1" onClick={()=> {
              const dpr = 1;
              const out = document.createElement("canvas");
              out.width = props.mapSize.w * dpr; out.height = props.mapSize.h * dpr;
              const ctx = out.getContext("2d")!;
              const bg = props.assets.find(a => a.id === props.backgroundAssetId);
              if (bg && bg.img && bg.img.complete) {
                try { ctx.drawImage(bg.img, 0, 0, out.width, out.height); } catch (e) { ctx.fillStyle = "#0f162b"; ctx.fillRect(0,0,out.width,out.height); }
              } else {
                ctx.fillStyle = "#0f162b"; ctx.fillRect(0,0,out.width,out.height);
              }
              const ordered = [...props.sprites].sort((a,b)=> a.z - b.z);
              for (const s of ordered) {
                if (!s.visible) continue; const img = s.img; if (!img) continue;
                ctx.save(); ctx.globalAlpha = s.opacity;
                ctx.translate(s.x * dpr, s.y * dpr);
                ctx.rotate((s.rotation * Math.PI)/180);
                ctx.scale(s.scale * dpr, s.scale * dpr);
                ctx.drawImage(img,0,0);
                ctx.restore();
              }
              out.toBlob((blob)=> { if (!blob) return; downloadBlob(blob, `map_${Date.now()}.png`); }, "image/png");
            }}><Download className="w-4 h-4"/>Esporta PNG</button>
            <button title="Download logs" className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700" onClick={()=> { logger.download(); }}><Download className="w-4 h-4 inline mr-1"/>Log</button>
            <button title="Pulisci log" className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700" onClick={()=> { logger.clear(); alert('Log cancellati'); }}><Trash2 className="w-4 h-4 inline mr-1"/>Clear</button>
          </div>
        </div>
        <div className="h-[72vh] relative">
          <MapCanvas
            sprites={props.sprites} setSprites={props.setSprites}
            selectedId={props.selectedId} setSelectedId={props.setSelectedId}
            grid={props.grid} snap={props.snap} gridSize={props.gridSize}
            zoom={props.zoom} setZoom={props.setZoom} pan={props.pan} setPan={props.setPan}
            mapSize={props.mapSize}
            assets={props.assets}
            backgroundAssetId={props.backgroundAssetId}
            onRequestDelete={(id) => { if (!id) return; if (skipConfirm) { doDelete('sprite', id); } else { setConfirmDelete({ visible: true, type: 'sprite', id, name: props.sprites.find(s=>s.id===id)?.name || 'sprite' }); } }}
          />
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-xl bg-black/50 backdrop-blur px-2 py-1 text-xs text-white">
            <span className="px-2 py-0.5 rounded bg-white/10">Zoom {props.zoom.toFixed(2)}x</span>
            <span className="px-2 py-0.5 rounded bg-white/10">Pan {Math.round(props.pan.x)}, {Math.round(props.pan.y)}</span>
            <span className="px-2 py-0.5 rounded bg-white/10">Map {props.mapSize.w}×{props.mapSize.h}px</span>
          </div>
        </div>
      </div>

      {/* Right: Properties / Layers */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-xl">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2"><PanelRight className="w-4 h-4"/><span className="font-semibold">Proprietà</span></div>
        <div className="p-3 space-y-4">
          <div className="space-y-3">
            {props.selectedSprite ? (
              <div className="space-y-3">
                <div className="text-sm text-slate-300 truncate">{props.selectedSprite.name}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><div className="text-xs text-slate-400">X</div><input type="number" className="w-full bg-slate-800 rounded px-2 py-1" value={Math.round(props.selectedSprite.x)} onChange={(e)=> props.changeSelected({ x: parseFloat(e.target.value) })}/></div>
                  <div><div className="text-xs text-slate-400">Y</div><input type="number" className="w-full bg-slate-800 rounded px-2 py-1" value={Math.round(props.selectedSprite.y)} onChange={(e)=> props.changeSelected({ y: parseFloat(e.target.value) })}/></div>
                  <div className="col-span-2"><div className="text-xs text-slate-400">Scala</div><input type="range" min={0.1} max={4} step={0.05} value={props.selectedSprite.scale} onChange={(e)=> props.changeSelected({ scale: parseFloat(e.target.value) })}/></div>
                  <div className="col-span-2">
                    <div className="text-xs text-slate-400">Rotazione</div>
                    <div className="flex items-center gap-2">
                      <input type="range" min={-180} max={180} step={1} value={props.selectedSprite.rotation} onChange={(e)=> props.changeSelected({ rotation: parseFloat(e.target.value) })}/>
                      <button className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700" onClick={()=> props.changeSelected({ rotation: 0 })}><RotateCw className="w-4 h-4"/></button>
                    </div>
                  </div>
                  <div className="col-span-2"><div className="text-xs text-slate-400">Opacità</div><input type="range" min={0} max={1} step={0.01} value={props.selectedSprite.opacity} onChange={(e)=> props.changeSelected({ opacity: parseFloat(e.target.value) })}/></div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700" onClick={()=> props.changeSelected({ visible: !props.selectedSprite!.visible })}>{props.selectedSprite!.visible ? <Eye className="w-4 h-4 inline mr-1"/> : <EyeOff className="w-4 h-4 inline mr-1"/>}{props.selectedSprite!.visible ? "Visibile" : "Nascosto"}</button>
                  <button className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700" onClick={()=> props.changeSelected({ locked: !props.selectedSprite!.locked })}>{props.selectedSprite!.locked ? <Lock className="w-4 h-4 inline mr-1"/> : <LockOpen className="w-4 h-4 inline mr-1"/>}{props.selectedSprite!.locked ? "Bloccato" : "Sbloccato"}</button>
                  <button className="px-2 py-1 rounded bg-red-700 hover:bg-red-600" onClick={()=> props.setSprites(prev => prev.filter(s => s.id !== props.selectedSprite!.id))}><Trash2 className="w-4 h-4 inline mr-1"/>Elimina</button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-400">Seleziona un oggetto nell'editor per modificarne le proprietà.</div>
            )}
          </div>

          <hr className="border-slate-800"/>
          <div className="space-y-2">
            <div className="text-xs text-slate-400">Layer (alto = sopra)</div>
            <div className="h-[40vh] overflow-auto flex flex-col gap-2">
              {[...props.sprites].sort((a,b)=> b.z - a.z).map(s => (
                <div key={s.id} className={`flex items-center justify-between gap-2 p-2 rounded-lg border ${s.id===props.selectedId? "border-sky-400 bg-sky-400/10":"border-slate-800 bg-slate-800/40"}`} onClick={()=> props.setSelectedId(s.id)}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-md overflow-hidden bg-slate-900 grid place-items-center border border-slate-700">
                      <img src={s.img.src} alt={s.name} className="max-w-full max-h-full object-contain"/>
                    </div>
                    <div className="truncate text-sm">{s.name}</div>
                  </div>
                  <div className="flex items-center gap-1">
              <button className="px-2 py-1 rounded bg-red-700 hover:bg-red-600" onClick={()=> { const id = props.selectedSprite!.id; if (skipConfirm) { doDelete('sprite', id); } else { setConfirmDelete({ visible: true, type: 'sprite', id, name: props.selectedSprite!.name }); } }}><Trash2 className="w-4 h-4 inline mr-1"/>Elimina</button>
                    <button className="p-1 rounded hover:bg-slate-800" onClick={(e)=> {e.stopPropagation(); props.setSprites(prev => prev.map(x => x.id===s.id? {...x, locked: !x.locked }: x));}}>{s.locked? <Lock className="w-4 h-4"/> : <LockOpen className="w-4 h-4"/>}</button>
                    <button className="p-1 rounded hover:bg-slate-800" onClick={(e)=> {e.stopPropagation(); props.setSprites(prev => prev.map(x => x.id===s.id? {...x, z: Math.max(...prev.map(p=>p.z))+1 }: x));}}><Replace className="w-4 h-4"/></button>
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
