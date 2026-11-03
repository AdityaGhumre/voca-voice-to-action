import React from 'react';
import { Sparkles, Calendar, RotateCw, Mic, Volume2 } from 'lucide-react';

export default function Header({ onRefresh, isRefreshing, backendStatus }) {
  const today = new Date();
  const dateFormatted = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <header className="border-b border-[#1C2638] bg-[#0B0F17]/80 backdrop-blur-md sticky top-0 z-20 px-8 py-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#9AA6BC] mb-1">
            <Calendar className="w-3.5 h-3.5 text-[#5B6B82]" />
            <span>{dateFormatted}</span>
            <span className="text-[#324057]">·</span>
            <span className="text-[#CCFF00] font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00]"></span>
              Voice AI Engine Ready
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#F7F7F2] tracking-tight">
            Voca Workspace
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141C2B] border border-[#1E2A3E] text-xs text-[#9AA6BC]">
            <Mic className="w-3.5 h-3.5 text-[#CCFF00]" />
            <span>Voice In Ready</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141C2B] border border-[#1E2A3E] text-xs text-[#9AA6BC]">
            <Volume2 className="w-3.5 h-3.5 text-[#A78BFA]" />
            <span>Voice Out Ready</span>
          </div>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141C2B] hover:bg-[#1A2538] border border-[#1E2A3E] text-xs font-medium text-[#F7F7F2] transition disabled:opacity-50"
            title="Sync with backend"
          >
            <RotateCw className={`w-3.5 h-3.5 text-[#9AA6BC] ${isRefreshing ? 'animate-spin text-[#CCFF00]' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>
    </header>
  );
}
