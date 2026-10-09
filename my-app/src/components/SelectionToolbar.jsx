import React from 'react';
import { CheckSquare, Square, X, Trash2, Share2, Layers, ArrowRight } from 'lucide-react';
import { triggerHaptic } from '../utils/feedback';

/**
 * Universal Floating Selection Toolbar for Mobile & Desktop
 * Renders an elevated bar when items are selected with count and contextual actions.
 */
export default function SelectionToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onCancel,
  actions = []
}) {
  if (selectedCount === 0) return null;

  const isAllSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="fixed bottom-20 inset-x-3 sm:inset-x-6 z-40 max-w-lg mx-auto animate-in slide-in-from-bottom-4 duration-200">
      <div className="bg-slate-900 text-white rounded-2xl p-3 shadow-2xl border border-slate-700/80 flex items-center justify-between gap-2">
        {/* Selection Count & Select All Toggle */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => {
              triggerHaptic('light');
              if (isAllSelected) onDeselectAll();
              else onSelectAll();
            }}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 transition text-xs font-bold text-slate-200 cursor-pointer"
          >
            {isAllSelected ? (
              <CheckSquare size={16} className="text-blue-400" />
            ) : (
              <Square size={16} className="text-slate-400" />
            )}
            <span>{isAllSelected ? 'All' : 'All'}</span>
          </button>

          <span className="text-xs font-black bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-1 rounded-lg">
            {selectedCount} selected
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          {actions.map((act, idx) => {
            const Icon = act.icon;
            const isDanger = act.variant === 'danger';
            const isPrimary = act.variant === 'primary';

            return (
              <button
                key={idx}
                onClick={async () => {
                  triggerHaptic(isDanger ? 'heavy' : 'medium');
                  if (act.onClick) await act.onClick();
                }}
                className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition whitespace-nowrap cursor-pointer ${
                  isDanger
                    ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30'
                    : isPrimary
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
                title={act.label}
              >
                {Icon && <Icon size={14} />}
                <span>{act.label}</span>
              </button>
            );
          })}

          <button
            onClick={() => {
              triggerHaptic('light');
              if (onCancel) onCancel();
              else onDeselectAll();
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition active:scale-95 cursor-pointer ml-1"
            title="Clear Selection"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
