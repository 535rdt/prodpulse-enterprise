import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Boxes, MapPin, Tag, AlertTriangle } from 'lucide-react';
import { triggerHaptic } from '../utils/feedback';

export default function SearchableMaterialSelect({
  value,
  onChange,
  materials = [],
  placeholder = '-- Search & Choose Material --',
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const inputRef = useRef(null);

  const selectedMat = useMemo(() => {
    return materials.find(m => String(m.id) === String(value));
  }, [materials, value]);

  // Extract unique categories from registered materials
  const categories = useMemo(() => {
    const set = new Set();
    materials.forEach(m => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set);
  }, [materials]);

  // Filter materials based on search query and category
  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      if (selectedCategory !== 'ALL' && m.category !== selectedCategory) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const name = (m.name || '').toLowerCase();
      const sku = (m.sku || '').toLowerCase();
      const cat = (m.category || '').toLowerCase();
      const loc = (m.location || '').toLowerCase();
      return name.includes(q) || sku.includes(q) || cat.includes(q) || loc.includes(q);
    });
  }, [materials, searchQuery, selectedCategory]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
      setSelectedCategory('ALL');
    }
  }, [isOpen]);

  const handleSelect = (matId) => {
    triggerHaptic('light');
    onChange(matId);
    setIsOpen(false);
  };

  const getStockStatus = (mat) => {
    const qty = Number(mat.quantity) || 0;
    const min = Number(mat.minThreshold) || 50;
    if (qty <= 0) return { label: 'Out of Stock', color: 'rose', icon: '🔴', isOut: true };
    if (qty <= min) return { label: 'Low Stock', color: 'amber', icon: '⚠️', isLow: true };
    return { label: 'In Stock', color: 'emerald', icon: '🟢', isGood: true };
  };

  return (
    <div className="relative flex-1">
      {/* Selected Material Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            triggerHaptic('light');
            setIsOpen(!isOpen);
          }
        }}
        className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
          isOpen
            ? 'border-indigo-600 bg-white ring-2 ring-indigo-500/20 shadow-sm'
            : selectedMat
              ? 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
              : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500'
        }`}
      >
        {selectedMat ? (
          <div className="flex items-center space-x-2 min-w-0 pr-2">
            <span className="text-sm shrink-0">{getStockStatus(selectedMat).icon}</span>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 truncate">
                <span className="text-xs font-bold text-slate-900 truncate">{selectedMat.name}</span>
                {selectedMat.sku && (
                  <span className="text-[10px] font-mono font-semibold px-1 py-0.2 rounded bg-slate-100 text-slate-600 shrink-0">
                    {selectedMat.sku}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2 text-[10px] text-slate-500">
                <span>Stock: <strong className="text-slate-800">{Number(selectedMat.quantity || 0).toLocaleString()} {selectedMat.unit}</strong></span>
                {selectedMat.category && <span className="opacity-75">• {selectedMat.category}</span>}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500">
            <Search size={14} className="text-slate-400" />
            <span>{placeholder}</span>
          </div>
        )}

        <div className="flex items-center space-x-1 text-slate-400 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
            Search
          </span>
          <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`} />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 top-full mt-1.5 w-full min-w-[290px] sm:min-w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-2.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
            {/* Search Input Bar */}
            <div className="px-3 pb-2 border-b border-slate-100">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Type to search material, SKU, bay..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Category Quick Filter Chips */}
              {categories.length > 0 && (
                <div className="flex items-center space-x-1 overflow-x-auto pt-2 pb-0.5 scrollbar-none text-[10px]">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('ALL')}
                    className={`px-2 py-0.5 rounded-lg font-bold whitespace-nowrap transition cursor-pointer ${
                      selectedCategory === 'ALL'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All ({materials.length})
                  </button>
                  {categories.map(cat => {
                    const count = materials.filter(m => m.category === cat).length;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2 py-0.5 rounded-lg font-bold whitespace-nowrap transition cursor-pointer ${
                          selectedCategory === cat
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Scrollable Materials List */}
            <div className="max-h-60 overflow-y-auto px-1.5 py-1 space-y-1">
              {filteredMaterials.map(mat => {
                const isSelected = String(mat.id) === String(value);
                const status = getStockStatus(mat);
                const stockQty = Number(mat.quantity || 0);

                return (
                  <button
                    key={mat.id}
                    type="button"
                    onClick={() => handleSelect(mat.id)}
                    className={`w-full p-2.5 rounded-xl text-left transition flex items-center justify-between cursor-pointer group ${
                      isSelected
                        ? 'bg-indigo-50/80 border border-indigo-200 text-indigo-950 font-bold ring-1 ring-indigo-500/30'
                        : 'hover:bg-slate-50 border border-transparent hover:border-slate-200/60 text-slate-800'
                    }`}
                  >
                    <div className="flex items-start space-x-2.5 min-w-0 pr-2">
                      <span className="text-sm shrink-0 mt-0.5">{status.icon}</span>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-xs truncate text-slate-900 group-hover:text-indigo-600 transition">
                            {mat.name}
                          </span>
                          {mat.sku && (
                            <span className="text-[10px] font-mono font-semibold px-1 py-0.2 rounded bg-slate-100 text-slate-600 shrink-0">
                              {mat.sku}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
                          {mat.category && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold">
                              {mat.category}
                            </span>
                          )}
                          {mat.location && (
                            <span className="flex items-center">
                              <MapPin size={10} className="mr-0.5 text-slate-400" /> {mat.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-center space-x-1 justify-end">
                        <span className={`text-xs font-black ${
                          status.isOut ? 'text-rose-600' : status.isLow ? 'text-amber-600' : 'text-slate-800'
                        }`}>
                          {stockQty.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{mat.unit}</span>
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider block ${
                        status.isOut ? 'text-rose-600' : status.isLow ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        {status.label}
                      </span>
                      {isSelected && (
                        <div className="flex items-center justify-end text-indigo-600 mt-0.5">
                          <Check size={13} className="stroke-[2.5]" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}

              {filteredMaterials.length === 0 && (
                <div className="py-6 px-4 text-center space-y-2">
                  <Boxes size={28} className="mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-700">No Raw Materials Found</p>
                  <p className="text-[11px] text-slate-400">
                    {searchQuery ? `No materials matching "${searchQuery}"` : 'No materials registered in warehouse'}
                  </p>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      Clear search filter
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer Summary */}
            <div className="px-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
              <span>Showing {filteredMaterials.length} of {materials.length} raw materials</span>
              {selectedMat && (
                <button
                  type="button"
                  onClick={() => handleSelect('')}
                  className="text-rose-500 hover:text-rose-700 font-bold hover:underline cursor-pointer"
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
