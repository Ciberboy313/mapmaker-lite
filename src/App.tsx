import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, EyeOff, Grid3X3, ImagePlus, Layers, Lock, LockOpen, MousePointer2, Move, Replace, RotateCw, Trash2, Upload, ZoomIn, ZoomOut, Maximize2, PanelLeft, PanelRight } from "lucide-react";

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
};

function MapCanvas({ sprites, setSprites, selectedId, setSelectedId, grid, snap, gridSize, zoom, setZoom, pan, setPan, mapSize }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hoveringRef = useRef<string | null>(null);
  const draggingRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
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
      ctx.fillStyle = "#0f162b"; ctx.fillRect(0,0,mapSize.w,mapSize.h);
      const ordered = [...sprites].sort((a,b)=> a.z - b.z);
      for (const s of ordered) {
        if (!s.visible) continue;
        const img = s.img; if (!img || !img.complete) continue;
        ctx.save(); ctx.globalAlpha = s.opacity;
        ctx.translate(s.x, s.y); ctx.rotate((s.rotation * Math.PI)/180); ctx.scale(s.scale, s.scale);
        ctx.drawImage(img, 0, 0);
        if (s.id === selectedId) { ctx.lineWidth = 2/zoom; ctx.strokeStyle = "#7dd3fc"; ctx.strokeRect(0,0,img.width,img.height); }
        else if (hoveringRef.current === s.id) { ctx.lineWidth = 1/zoom; ctx.strokeStyle = "#a78bfa"; ctx.strokeRect(0,0,img.width,img.height); }
        ctx.restore();
      }
      ctx.restore(); ctx.restore();
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [sprites, selectedId, grid, zoom, pan, gridSize, mapSize]);

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (clientX - rect.left - pan.x) / zoom;
    const y = (clientY - rect.top - pan.y) / zoom;
    return { x, y };
  }, [pan.x, pan.y, zoom]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const { x, y } = toWorld(e.clientX, e.clientY);
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(6, Math.max(0.1, zoom * factor));
      const wx = x * newZoom + pan.x, wy = y * newZoom + pan.y;
      const nx = e.clientX - canvasRef.current!.getBoundingClientRect().left;
      const ny = e.clientY - canvasRef.current!.getBoundingClientRect().top;
      setPan({ x: nx - wx, y: ny - wy }); setZoom(newZoom);
    } else if (e.shiftKey) {
      setPan({ x: pan.x - e.deltaY, y: pan.y });
    } else {
      setPan({ x: pan.x - e.deltaX, y: pan.y - e.deltaY });
    }
  }, [zoom, pan, setZoom, setPan, toWorld]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const { x, y } = toWorld(e.clientX, e.clientY);
    if (panningRef.current) return;
    if (draggingRef.current) {
      setSprites(prev => prev.map(s => {
        if (s.id !== draggingRef.current!.id) return s;
        let nx = x - draggingRef.current!.offsetX;
        let ny = y - draggingRef.current!.offsetY;
        return { ...s, x: nx, y: ny };
      }));
      return;
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
      const img = picked.img!;
      const cos = Math.cos(degToRad(picked.rotation));
      const sin = Math.sin(degToRad(picked.rotation));
      const dx = x - picked.x; const dy = y - picked.y;
      const lx = (dx * cos + dy * sin) / picked.scale;
      const ly = (-dx * sin + dy * cos) / picked.scale;
      draggingRef.current = { id: picked.id, offsetX: lx, offsetY: ly };
    } else {
      setSelectedId(null);
    }
  }, [sprites, setSelectedId, toWorld]);

  const onMouseUp = useCallback(() => { draggingRef.current = null; panningRef.current = false; }, []);
  const onContextMenu = useCallback((e: React.MouseEvent) => { e.preventDefault(); }, []);
  const onMouseLeave = useCallback(() => { draggingRef.current = null; panningRef.current = false; }, []);
  const onMouseMovePan = useCallback((e: React.MouseEvent) => { if (!panningRef.current) return; setPan({ x: pan.x + e.movementX, y: pan.y + e.movementY }); }, [pan, setPan]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "+") setZoom(Math.min(6, zoom * 1.1));
      if (e.key === "-") setZoom(Math.max(0.1, zoom / 1.1));
      if (!selectedId) return;
      if (["Delete","Backspace"].includes(e.key)) {
        setSprites(prev => prev.filter(s => s.id !== selectedId));
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
    <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black text-slate-100 p-3 grid grid-cols-[300px_1fr_320px] gap-3 select-none">
      {/* Left: Assets */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-xl">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2"><PanelLeft className="w-4 h-4"/><span className="font-semibold">Assets</span></div>
        <div className="p-3 space-y-3">
          <label className="flex items-center gap-2 rounded-xl border border-dashed border-slate-700 p-3 hover:border-slate-500 transition cursor-pointer">
            <Upload className="w-4 h-4"/>
            <span>Carica PNG / WEBP / JPG</span>
            <input multiple type="file" accept="image/*" className="hidden" onChange={(e)=> {
              const files = e.target.files; if (!files) return;
              const list: Asset[] = []; 
              for (const f of Array.from(files)) {
                if (!f.type.startsWith("image/")) continue;
                const url = URL.createObjectURL(f); const id = uid("asset");
                const a: Asset = { id, name: f.name, url };
                const img = new Image();
                img.onload = () => { a.img = img; a.w = img.width; a.h = img.height; setAssets(prev => [...prev]); };
                img.src = url; list.push(a);
              }
              setAssets(prev => [...prev, ...list]);
            }} />
          </label>
          <div className="h-[70vh] pr-1 overflow-auto">
            <div className="grid grid-cols-2 gap-2">
              {assets.map(a => (
                <button key={a.id} onClick={()=> {
                  if (!a.img) return;
                  const s: Sprite = {
                    id: uid("sprite"),
                    name: a.name,
                    img: a.img,
                    x: 100, y: 100, scale: 1, rotation: 0, opacity: 1,
                    visible: true, locked: false,
                    z: sprites.length ? Math.max(...sprites.map(s => s.z)) + 1 : 1
                  };
                  setSprites(prev => [...prev, s]); setSelectedId(s.id);
                }} className="group rounded-xl overflow-hidden border border-slate-800 hover:border-slate-600">
                  <div className="aspect-square bg-slate-800/60 grid place-items-center">
                    {a.url ? <img src={a.url} alt={a.name} className="max-w-full max-h-full object-contain"/> : <ImagePlus/>}
                  </div>
                  <div className="p-2 text-xs text-left truncate text-slate-300 group-hover:text-white">{a.name}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Center: Canvas & toolbar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-xl">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
          <MousePointer2 className="w-4 h-4"/><span className="font-semibold">Editor</span>
          <div className="ml-auto flex items-center gap-2">
            <button className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700" onClick={()=> setZoom(Math.min(6, zoom * 1.1))}><ZoomIn className="w-4 h-4"/></button>
            <button className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700" onClick={()=> setZoom(Math.max(0.1, zoom / 1.1))}><ZoomOut className="w-4 h-4"/></button>
            <button className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700" onClick={()=> setPan({x:40,y:40})}><Move className="w-4 h-4"/></button>
            <span className="mx-2 h-5 w-px bg-slate-700 inline-block" />
            <button className={`px-2 py-1 rounded-lg ${grid? "bg-sky-700/50":"bg-slate-800 hover:bg-slate-700"}`} onClick={()=> setGrid(!grid)}><Grid3X3 className="w-4 h-4"/></button>
            <button className={`px-2 py-1 rounded-lg ${snap? "bg-sky-700/50":"bg-slate-800 hover:bg-slate-700"}`} onClick={()=> setSnap(!snap)}><Maximize2 className="w-4 h-4"/></button>
            <div className="text-xs text-slate-300 px-2">Grid: {gridSize}px</div>
            <input type="range" min={8} max={256} step={8} value={gridSize} onChange={(e)=> setGridSize(parseInt(e.target.value))} />
            <button className="ml-2 px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 flex items-center gap-1" onClick={()=> {
              const dpr = 1;
              const out = document.createElement("canvas");
              out.width = mapSize.w * dpr; out.height = mapSize.h * dpr;
              const ctx = out.getContext("2d")!;
              ctx.fillStyle = "#0f162b"; ctx.fillRect(0,0,out.width,out.height);
              const ordered = [...sprites].sort((a,b)=> a.z - b.z);
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
          </div>
        </div>
        <div className="h-[72vh] relative">
          <MapCanvas
            sprites={sprites} setSprites={setSprites}
            selectedId={selectedId} setSelectedId={setSelectedId}
            grid={grid} snap={snap} gridSize={gridSize}
            zoom={zoom} setZoom={setZoom} pan={pan} setPan={setPan}
            mapSize={mapSize}
          />
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-xl bg-black/50 backdrop-blur px-2 py-1 text-xs text-white">
            <span className="px-2 py-0.5 rounded bg-white/10">Zoom {zoom.toFixed(2)}x</span>
            <span className="px-2 py-0.5 rounded bg-white/10">Pan {Math.round(pan.x)}, {Math.round(pan.y)}</span>
            <span className="px-2 py-0.5 rounded bg-white/10">Map {mapSize.w}×{mapSize.h}px</span>
          </div>
        </div>
      </div>

      {/* Right: Properties / Layers */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-xl">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2"><PanelRight className="w-4 h-4"/><span className="font-semibold">Proprietà</span></div>
        <div className="p-3 space-y-4">
          <div className="space-y-3">
            {selectedSprite ? (
              <div className="space-y-3">
                <div className="text-sm text-slate-300 truncate">{selectedSprite.name}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><div className="text-xs text-slate-400">X</div><input type="number" className="w-full bg-slate-800 rounded px-2 py-1" value={Math.round(selectedSprite.x)} onChange={(e)=> changeSelected({ x: parseFloat(e.target.value) })}/></div>
                  <div><div className="text-xs text-slate-400">Y</div><input type="number" className="w-full bg-slate-800 rounded px-2 py-1" value={Math.round(selectedSprite.y)} onChange={(e)=> changeSelected({ y: parseFloat(e.target.value) })}/></div>
                  <div className="col-span-2"><div className="text-xs text-slate-400">Scala</div><input type="range" min={0.1} max={4} step={0.05} value={selectedSprite.scale} onChange={(e)=> changeSelected({ scale: parseFloat(e.target.value) })}/></div>
                  <div className="col-span-2">
                    <div className="text-xs text-slate-400">Rotazione</div>
                    <div className="flex items-center gap-2">
                      <input type="range" min={-180} max={180} step={1} value={selectedSprite.rotation} onChange={(e)=> changeSelected({ rotation: parseFloat(e.target.value) })}/>
                      <button className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700" onClick={()=> changeSelected({ rotation: 0 })}><RotateCw className="w-4 h-4"/></button>
                    </div>
                  </div>
                  <div className="col-span-2"><div className="text-xs text-slate-400">Opacità</div><input type="range" min={0} max={1} step={0.01} value={selectedSprite.opacity} onChange={(e)=> changeSelected({ opacity: parseFloat(e.target.value) })}/></div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700" onClick={()=> changeSelected({ visible: !selectedSprite.visible })}>{selectedSprite.visible ? <Eye className="w-4 h-4 inline mr-1"/> : <EyeOff className="w-4 h-4 inline mr-1"/>}{selectedSprite.visible ? "Visibile" : "Nascosto"}</button>
                  <button className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700" onClick={()=> changeSelected({ locked: !selectedSprite.locked })}>{selectedSprite.locked ? <Lock className="w-4 h-4 inline mr-1"/> : <LockOpen className="w-4 h-4 inline mr-1"/>}{selectedSprite.locked ? "Bloccato" : "Sbloccato"}</button>
                  <button className="px-2 py-1 rounded bg-red-700 hover:bg-red-600" onClick={()=> setSprites(prev => prev.filter(s => s.id !== selectedSprite.id))}><Trash2 className="w-4 h-4 inline mr-1"/>Elimina</button>
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
              {[...sprites].sort((a,b)=> b.z - a.z).map(s => (
                <div key={s.id} className={`flex items-center justify-between gap-2 p-2 rounded-lg border ${s.id===selectedId? "border-sky-400 bg-sky-400/10":"border-slate-800 bg-slate-800/40"}`} onClick={()=> setSelectedId(s.id)}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-md overflow-hidden bg-slate-900 grid place-items-center border border-slate-700">
                      <img src={s.img.src} alt={s.name} className="max-w-full max-h-full object-contain"/>
                    </div>
                    <div className="truncate text-sm">{s.name}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="p-1 rounded hover:bg-slate-800" onClick={(e)=> {e.stopPropagation(); setSprites(prev => prev.map(x => x.id===s.id? {...x, visible: !x.visible }: x));}}>{s.visible? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}</button>
                    <button className="p-1 rounded hover:bg-slate-800" onClick={(e)=> {e.stopPropagation(); setSprites(prev => prev.map(x => x.id===s.id? {...x, locked: !x.locked }: x));}}>{s.locked? <Lock className="w-4 h-4"/> : <LockOpen className="w-4 h-4"/>}</button>
                    <button className="p-1 rounded hover:bg-slate-800" onClick={(e)=> {e.stopPropagation(); setSprites(prev => prev.map(x => x.id===s.id? {...x, z: Math.max(...prev.map(p=>p.z))+1 }: x));}}><Replace className="w-4 h-4"/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <hr className="border-slate-800"/>
          <div className="space-y-2">
            <div className="text-xs text-slate-400">Dimensioni mappa (px)</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2"><span className="w-5 text-xs text-slate-400">W</span><input type="number" className="w-full bg-slate-800 rounded px-2 py-1" value={mapSize.w} onChange={(e)=> setMapSize(ms=>({ ...ms, w: Math.max(256, parseInt(e.target.value||\"0\")) }))}/></div>
              <div className="flex items-center gap-2"><span className="w-5 text-xs text-slate-400">H</span><input type="number" className="w-full bg-slate-800 rounded px-2 py-1" value={mapSize.h} onChange={(e)=> setMapSize(ms=>({ ...ms, h: Math.max(256, parseInt(e.target.value||\"0\")) }))}/></div>
            </div>
          </div>
        </div>
      </div>

      {/* Shortcuts hint */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 text-[11px] text-slate-300 bg-black/50 backdrop-blur px-3 py-1 rounded-lg border border-slate-800 shadow">
        CTRL/CMD + rotellina = Zoom • Rotellina = Pan • Shift + Rotellina = Pan orizzontale • Frecce = muovi (Shift = scatto) • Del = elimina • +/- = zoom
      </div>
    </div>
  );
}

export default function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [sprites, setSprites] = useState<Sprite[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [grid, setGrid] = useState(true);
  const [snap, setSnap] = useState(true);
  const [gridSize, setGridSize] = useState(64);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [mapSize, setMapSize] = useState({ w: 4096, h: 3072 });

  const selectedSprite = useMemo(() => sprites.find(s => s.id === selectedId) || null, [sprites, selectedId]);
  const changeSelected = useCallback((patch: Partial<Sprite>) => {
    if (!selectedId) return;
    setSprites(prev => prev.map(s => s.id === selectedId ? { ...s, ...patch } : s));
  }, [selectedId]);

  return (
    <EditorUI
      assets={assets} setAssets={setAssets}
      sprites={sprites} setSprites={setSprites}
      selectedId={selectedId} setSelectedId={setSelectedId}
      grid={grid} setGrid={setGrid} snap={snap} setSnap={setSnap} gridSize={gridSize} setGridSize={setGridSize}
      zoom={zoom} setZoom={setZoom} pan={pan} setPan={setPan}
      mapSize={mapSize} setMapSize={setMapSize}
      selectedSprite={selectedSprite} changeSelected={changeSelected}
    />
  );
}

type EditorProps = {
  assets: Asset[]; setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
  sprites: Sprite[]; setSprites: React.Dispatch<React.SetStateAction<Sprite[]>>;
  selectedId: string | null; setSelectedId: (id: string | null)=>void;
  grid: boolean; setGrid: (v:boolean)=>void;
  snap: boolean; setSnap: (v:boolean)=>void;
  gridSize: number; setGridSize: (n:number)=>void;
  zoom: number; setZoom: (n:number)=>void;
  pan: {x:number;y:number}; setPan: (p:{x:number;y:number})=>void;
  mapSize: {w:number;h:number}; setMapSize: (p:{w:number;h:number})=>void;
  selectedSprite: Sprite | null; changeSelected: (p: Partial<Sprite>)=>void;
};

function EditorUI(props: EditorProps) { return <>{/* Placeholder to satisfy TSX split; real UI is in default export above */}</>; }
