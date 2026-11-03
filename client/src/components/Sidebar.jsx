import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  CheckSquare,
  Bell,
  Mic2,
  Server,
  Trash2
} from 'lucide-react';
import { resetDevData } from '../services/api';

export default function Sidebar({ currentTab, setCurrentTab, backendStatus, counts, onDataReset }) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'expenses', label: 'Expenses', icon: Receipt, count: counts?.expenses },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, count: counts?.pendingTasks },
    { id: 'reminders', label: 'Reminders', icon: Bell, count: counts?.upcomingReminders },
  ];

  const handleDevReset = async () => {
    const confirmed = window.confirm(
      '⚠️ Reset Test Data\n\nAre you sure you want to clear all test expenses, tasks, reminders, and activities to an empty state?\n\nExisting records will be permanently erased. (Development only)'
    );

    if (!confirmed) return;

    try {
      await resetDevData('empty');
      if (typeof onDataReset === 'function') {
        onDataReset();
      }
    } catch (err) {
      alert(`Reset failed: ${err.message}`);
    }
  };

  return (
    <aside className="w-64 border-r border-[#1C2638] bg-[#0E1420]/90 backdrop-blur-md flex flex-col justify-between shrink-0 h-screen sticky top-0">
      {/* Brand Section */}
      <div>
        <div className="p-6 pb-8 border-b border-[#1C2638]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#CCFF00] flex items-center justify-center text-[#0B0F17] shadow-[0_0_20px_rgba(204,255,0,0.25)]">
              <Mic2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-extrabold tracking-tight text-[#F7F7F2]">Voca</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-[#8B5CF6]/20 text-[#A78BFA] border border-[#8B5CF6]/30">AI</span>
              </div>
              <p className="text-xs text-[#9AA6BC]">Voice to Action</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="px-3 py-6">
          <p className="text-[11px] font-semibold tracking-wider uppercase text-[#5B6B82] px-3 mb-3">
            Workspace
          </p>
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-[#182337] text-[#CCFF00] border border-[#273752] shadow-sm'
                      : 'text-[#9AA6BC] hover:text-[#F7F7F2] hover:bg-[#141C2B]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#CCFF00]' : 'text-[#7A88A1]'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-semibold ${
                      isActive
                        ? 'bg-[#CCFF00]/15 text-[#CCFF00]'
                        : 'bg-[#1E293B] text-[#8695AB]'
                    }`}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Backend Status & Footer */}
      <div className="p-4 border-t border-[#1C2638] space-y-3">
        <div className="bg-[#121A28] border border-[#1E293D] rounded-xl p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[#9AA6BC] font-medium flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-[#5B6B82]" />
              Backend Engine
            </span>
            <span className="flex h-2 w-2 relative">
              {backendStatus.connected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#CCFF00] opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                backendStatus.connected ? 'bg-[#CCFF00]' : 'bg-rose-500'
              }`}></span>
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#5B6B82]">
            <span className="font-mono">Port 5000</span>
            <span className={backendStatus.connected ? 'text-[#CCFF00]' : 'text-rose-400'}>
              {backendStatus.connected ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Development-only Reset Option with Explicit Confirmation */}
        {import.meta.env.DEV && (
          <button
            onClick={handleDevReset}
            className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] text-[#5B6B82] hover:text-amber-300 hover:bg-[#141C2B] transition flex items-center justify-between border border-transparent hover:border-[#24334A]"
            title="Development-only test data reset with confirmation"
          >
            <span className="flex items-center gap-1.5">
              <Trash2 className="w-3 h-3 text-[#5B6B82]" />
              Reset Test Data
            </span>
            <span className="text-[9px] font-mono uppercase bg-[#182337] px-1 py-0.5 rounded text-[#7B8B9E]">Dev</span>
          </button>
        )}

        <div className="px-2 py-1 flex items-center justify-between text-[11px] text-[#5B6B82]">
          <span>Sprint 1 · Ready</span>
          <span className="text-[10px] text-[#CCFF00]/80 font-mono">v1.1.0</span>
        </div>
      </div>
    </aside>
  );
}
