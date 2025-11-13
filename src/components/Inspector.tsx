import React from 'react';
import type { Sprite, Asset, Folder } from '../types';
import { Eye, EyeOff, Lock, LockOpen, Replace, RotateCw, Trash2, PanelRight } from 'lucide-react';

type InspectorProps = {
  selectedSprite: Sprite | null;
  changeSelected: (p: Partial<Sprite>) => void;
  setSprites: React.Dispatch<React.SetStateAction<Sprite[]>>;
  selectedId: string | null;
  grid: boolean; snap: boolean; gridSize: number; setGrid: (v:boolean)=>void; setSnap: (v:boolean)=>void; setGridSize: (n:number)=>void;
  mapSize: { w:number; h:number }; setMapSize: React.Dispatch<React.SetStateAction<{w:number;h:number}>>;
  assets: Asset[];
  backgroundAssetId?: string | null;
};

export default function Inspector(props: InspectorProps) {
  const skipConfirm = false;
  const doDelete = (_type: any, _id?: string|null) => {};
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-visible backdrop-blur-xl h-full">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2"><PanelRight className="w-4 h-4"/><span className="font-semibold">Proprietà</span></div>
      <div className="p-3 space-y-4">
        <div className="space-y-3">
          {props.selectedSprite ? (
            <div className="space-y-3">
              <div className="text-sm text-slate-300 truncate">{props.selectedSprite.name}</div>
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-xs text-slate-400">X</div><input type="number" className="w-full bg-slate-800 rounded px-2 py-1" value={Math.round(props.selectedSprite.x)} onChange={(e)=> props.changeSelected({ x: parseFloat(e.target.value) })}/></div>
                <div><div className="text-xs text-slate-400">Y</div><input type="number" className="w-full bg-slate-800 rounded px-2 py-1" value={Math.round(props.selectedSprite.y)} onChange={(e)=> props.changeSelected({ y: parseFloat(e.target.value) })}/></div>
                <div className="col-span-2"><div className="text-xs text-slate-400">Scala</div><input type="range" min={0.1} max={2} step={0.05} value={props.selectedSprite.scale} onChange={(e)=> props.changeSelected({ scale: parseFloat(e.target.value) })}/></div>
                <div className="col-span-2">
                  <div className="text-xs text-slate-400">Rotazione</div>
                  <div className="flex items-center gap-2">
                    <input type="range" min={-360} max={360} step={1} value={props.selectedSprite.rotation} onChange={(e)=> props.changeSelected({ rotation: parseFloat(e.target.value) })}/>
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
      </div>
    </div>
  );
}

