import React, { useState } from 'react';
import { Bell, CalendarClock, Clock, CheckCircle, ChevronRight, Check } from 'lucide-react';
import ReminderDetailModal from './ReminderDetailModal';

export default function RemindersCard({
  reminders = [],
  onReminderUpdated,
  onReminderDeleted,
  isFullView = false
}) {
  const [selectedReminder, setSelectedReminder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const upcomingCount = reminders.filter(r => r.status === 'upcoming').length;

  const handleOpenDetails = (rem) => {
    setSelectedReminder(rem);
    setIsModalOpen(true);
  };

  const handleCloseDetails = () => {
    setIsModalOpen(false);
    setSelectedReminder(null);
  };

  const displayedReminders = isFullView ? reminders : reminders.slice(0, 8);

  return (
    <>
      <div className="bg-[#101726] border border-[#1E2A3E] rounded-2xl p-6 flex flex-col justify-between shadow-lg">
        <div>
          {/* Card Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center text-[#A78BFA]">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#F7F7F2]">Reminders</h2>
                <p className="text-xs text-[#9AA6BC]">Time-based triggers</p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-[#A78BFA] bg-[#8B5CF6]/10 px-2 py-0.5 rounded border border-[#8B5CF6]/20 font-semibold">
              {upcomingCount} active
            </span>
          </div>

          {/* Reminders List */}
          <div className={`space-y-2.5 overflow-y-auto pr-1 ${isFullView ? 'max-h-[600px]' : 'max-h-[360px]'}`}>
            {reminders.length === 0 ? (
              <div className="text-center py-8 text-[#5B6B82] text-xs">
                No reminders scheduled. Speak: <br />
                <span className="text-[#9AA6BC] font-mono mt-1 inline-block">
                  "Remind me to submit assignment on Friday"
                </span>
              </div>
            ) : (
              displayedReminders.map((rem) => {
                const isCompleted = rem.status === 'completed';

                return (
                  <div
                    key={rem.id}
                    onClick={() => handleOpenDetails(rem)}
                    className={`group flex items-start justify-between gap-3 p-3.5 rounded-xl border transition cursor-pointer select-none ${
                      isCompleted
                        ? 'bg-[#111927]/40 border-[#192233] opacity-65 hover:opacity-90'
                        : 'bg-[#141D2D]/60 hover:bg-[#162235] hover:border-[#8B5CF6]/35 border-[#1C283C]'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center mt-0.5 shrink-0 ${
                        isCompleted
                          ? 'bg-[#192437] text-[#5B6B82] border border-[#24354D]'
                          : 'bg-[#8B5CF6]/10 border border-[#8B5CF6]/25 text-[#A78BFA]'
                      }`}>
                        {isCompleted ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <CalendarClock className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-semibold text-[#F7F7F2] leading-snug group-hover:text-[#A78BFA] transition truncate ${
                          isCompleted ? 'line-through text-[#7A88A1]' : ''
                        }`}>
                          {rem.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[11px] font-mono text-[#CCFF00] flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#CCFF00]" />
                            {rem.dateTime}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded uppercase font-semibold ${
                            isCompleted
                              ? 'bg-[#1A2538] text-[#64748B]'
                              : 'bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/20'
                          }`}>
                            {rem.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center self-center pl-1">
                      <ChevronRight className="w-3.5 h-3.5 text-[#5B6B82] group-hover:text-[#A78BFA] group-hover:translate-x-0.5 transition" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="pt-4 mt-4 border-t border-[#1A2538] flex items-center justify-between text-[11px] text-[#5B6B82]">
          <span>Click reminder for details & edits</span>
          <span className="text-[#A78BFA] font-mono">{upcomingCount} Upcoming</span>
        </div>
      </div>

      {/* Reminder Detail / Edit / Delete Modal */}
      <ReminderDetailModal
        reminder={selectedReminder}
        isOpen={isModalOpen}
        onClose={handleCloseDetails}
        onReminderUpdated={(updated) => {
          setSelectedReminder(updated);
          if (typeof onReminderUpdated === 'function') {
            onReminderUpdated(updated);
          }
        }}
        onReminderDeleted={(id) => {
          handleCloseDetails();
          if (typeof onReminderDeleted === 'function') {
            onReminderDeleted(id);
          }
        }}
      />
    </>
  );
}
