import React from 'react';
import { Activity, Mic, CheckCircle, Clock } from 'lucide-react';

export default function ActivityCard({ activities = [] }) {
  return (
    <div className="bg-[#101726] border border-[#1E2A3E] rounded-2xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center text-[#CCFF00]">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#F7F7F2]">Recent Activity</h2>
            <p className="text-xs text-[#9AA6BC]">Audit log of voice-driven executions</p>
          </div>
        </div>
        <span className="text-[11px] font-mono text-[#5B6B82] bg-[#141D2D] px-2 py-0.5 rounded border border-[#1F2C40]">
          Live Event Stream
        </span>
      </div>

      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
        {activities.length === 0 ? (
          <div className="text-center py-6 text-xs text-[#5B6B82]">
            No recent activity recorded yet.
          </div>
        ) : (
          activities.slice(0, 6).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-xl bg-[#141D2D]/40 border border-[#1C283C]"
            >
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  item.type === 'voice_command'
                    ? 'bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/20'
                    : 'bg-[#8B5CF6]/10 text-[#A78BFA] border border-[#8B5CF6]/20'
                }`}>
                  {item.type === 'voice_command' ? (
                    <Mic className="w-3.5 h-3.5" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-[#F7F7F2]">{item.summary}</p>
                  <span className="text-[10px] text-[#5B6B82] font-mono">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {item.actionsCount && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#1A2538] text-[#CCFF00] border border-[#273752]">
                  {item.actionsCount} {item.actionsCount === 1 ? 'action' : 'actions'}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
