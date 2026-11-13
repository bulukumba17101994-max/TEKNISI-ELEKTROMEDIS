import React, { useState, useMemo } from 'react';
import { Search, X, Check, Building2, Tag, ShieldCheck, AlertTriangle, ArrowRight } from 'lucide-react';
import { AlkesItem, RuanganType } from '../types';

interface AlkesPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventaris: AlkesItem[];
  currentRuangan: RuanganType;
  selectedAlkesId: string;
  onSelectAlkes: (alkesId: string) => void;
  accentColor?: 'emerald' | 'orange' | 'red' | 'blue';
}

export const AlkesPickerModal: React.FC<AlkesPickerModalProps> = ({
  isOpen,
  onClose,
  inventaris,
  currentRuangan,
  selectedAlkesId,
  onSelectAlkes,
  accentColor = 'emerald',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'current' | 'other' | 'all'>('current');

  const alkesInCurrentRuangan = useMemo(() => {
    return inventaris.filter((i) => i.ruangan === currentRuangan);
  }, [inventaris, currentRuangan]);

  const alkesInOtherRuangan = useMemo(() => {
    return inventaris.filter((i) => i.ruangan !== currentRuangan);
  }, [inventaris, currentRuangan]);

  const filteredList = useMemo(() => {
    let base = inventaris;
    if (filterTab === 'current') {
      base = alkesInCurrentRuangan;
    } else if (filterTab === 'other') {
      base = alkesInOtherRuangan;
    }

    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase();
    return base.filter(
      (item) =>
        item.namaAlat.toLowerCase().includes(q) ||
        item.merk.toLowerCase().includes(q) ||
        item.serialNumber.toLowerCase().includes(q) ||
        item.ruangan.toLowerCase().includes(q) ||
        (item.modelType && item.modelType.toLowerCase().includes(q))
    );
  }, [inventaris, filterTab, alkesInCurrentRuangan, alkesInOtherRuangan, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-2xl max-h-[90vh] rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 border border-zinc-700 text-white">
              <Building2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white">
                Pilih Alat Kesehatan dari Database
              </h3>
              <p className="text-xs text-zinc-400">
                Ruangan terpilih saat ini: <strong className="text-emerald-400">{currentRuangan}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="grid grid-cols-3 gap-2 border-b border-zinc-800 bg-zinc-900/50 p-3 text-xs font-bold">
          <button
            type="button"
            onClick={() => setFilterTab('current')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 transition-all ${
              filterTab === 'current'
                ? 'bg-emerald-950 border border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/40'
                : 'bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="truncate">Ruang {currentRuangan}</span>
            <span className="rounded-full bg-emerald-900/80 px-1.5 py-0.2 text-[10px] text-emerald-300">
              {alkesInCurrentRuangan.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('other')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 transition-all ${
              filterTab === 'other'
                ? 'bg-amber-950 border border-amber-500 text-amber-300 shadow-md shadow-amber-950/40'
                : 'bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-amber-400"></span>
            <span className="truncate">Ruangan Lain</span>
            <span className="rounded-full bg-amber-900/80 px-1.5 py-0.2 text-[10px] text-amber-300">
              {alkesInOtherRuangan.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 transition-all ${
              filterTab === 'all'
                ? 'bg-blue-950 border border-blue-500 text-blue-300 shadow-md shadow-blue-950/40'
                : 'bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Semua Alat</span>
            <span className="rounded-full bg-blue-900/80 px-1.5 py-0.2 text-[10px] text-blue-300">
              {inventaris.length}
            </span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-zinc-800 bg-zinc-950">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Cari nama alat, merk, SN, atau ruangan...`}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 pl-9 pr-8 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* List of Alkes */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[50vh]">
          {filteredList.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-xs">
              Tidak ada alat kesehatan yang sesuai kriteria pencarian.
            </div>
          ) : (
            filteredList.map((item) => {
              const isCurrentRoom = item.ruangan === currentRuangan;
              const isSelected = item.id === selectedAlkesId;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectAlkes(item.id);
                    onClose();
                  }}
                  className={`cursor-pointer rounded-xl border p-3 transition-all flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-950/40 ring-1 ring-emerald-500'
                      : isCurrentRoom
                      ? 'border-emerald-900/60 bg-emerald-950/15 hover:border-emerald-500/80 hover:bg-emerald-950/30'
                      : 'border-amber-900/60 bg-amber-950/15 hover:border-amber-500/80 hover:bg-amber-950/30'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {/* Room Badge with prominent color */}
                      {isCurrentRoom ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/50 bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                          {item.ruangan} (Ruang Ini)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/60 bg-amber-950 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                          <AlertTriangle className="h-3 w-3 text-amber-400" />
                          Dari Ruang: {item.ruangan}
                        </span>
                      )}

                      {/* Kondisi Badge */}
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
                        {item.kondisi}
                      </span>
                    </div>

                    <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                      {item.namaAlat}
                    </h4>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-zinc-400">
                      <span>Merk: <strong className="text-zinc-200">{item.merk}</strong></span>
                      {item.modelType && <span>Tipe: <strong className="text-zinc-200">{item.modelType}</strong></span>}
                      <span>SN: <strong className="text-zinc-300 font-mono">{item.serialNumber}</strong></span>
                    </div>

                    {!isCurrentRoom && (
                      <p className="mt-1 text-[10px] text-amber-400/90 flex items-center gap-1 font-medium">
                        <ArrowRight className="h-3 w-3" />
                        Memilih alat ini akan otomatis mengubah form ke Ruang {item.ruangan}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center self-center">
                    {isSelected ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-black">
                        <Check className="h-4 w-4 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="h-5 w-5 rounded-full border border-zinc-700 hover:border-white"></div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-900/90 px-4 py-2.5 text-xs text-zinc-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              <strong className="text-emerald-300">Hijau</strong>: Ruang {currentRuangan}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
              <strong className="text-amber-300">Oranye</strong>: Ruangan Lain
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-white transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
