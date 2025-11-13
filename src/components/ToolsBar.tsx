import React from 'react';
import { MousePointer2, Move, RotateCw, Maximize2, Trash2 } from 'lucide-react';

export type Tool = 'select' | 'pan' | 'rotate' | 'scale' | 'delete';

export type ToolsBarProps = {
  selected: Tool;
  onChange: (t: Tool) => void;
};

const tools: { id: Tool; label: string; Icon: React.FC<any> }[] = [
  { id: 'select', label: 'Seleziona', Icon: MousePointer2 },
  { id: 'pan', label: 'Pan', Icon: Move },
  { id: 'rotate', label: 'Ruota', Icon: RotateCw },
  { id: 'scale', label: 'Scala', Icon: Maximize2 },
  { id: 'delete', label: 'Elimina', Icon: Trash2 },
];

export default function ToolsBar({ selected, onChange }: ToolsBarProps) {
  return (
    <div className="sticky top-0 flex flex-col gap-2 p-2 bg-slate-900/60 border border-slate-800 rounded-2xl shadow-sm">
      {tools.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={selected === id}
          className={`w-9 h-9 grid place-items-center rounded-lg transition-colors ${selected === id ? 'bg-sky-700/60 text-sky-100 ring-1 ring-sky-500/50' : 'bg-slate-800 hover:bg-slate-700 text-slate-100'}`}
          onClick={() => onChange(id)}
        >
          <Icon className="w-5 h-5" />
        </button>
      ))}
    </div>
  );
}
