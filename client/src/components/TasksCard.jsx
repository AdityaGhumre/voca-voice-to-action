import React, { useState } from 'react';
import {
  CheckSquare,
  Check,
  Clock,
  AlignLeft,
  FileText,
  ChevronRight,
  Sparkles,
  Layers
} from 'lucide-react';
import TaskDetailModal from './TaskDetailModal';

export default function TasksCard({
  tasks = [],
  onToggleTask,
  onTaskUpdated,
  onTaskDeleted,
  isFullView = false
}) {
  const [selectedTask, setSelectedTask] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const pendingCount = tasks.filter(t => !t.completed).length;

  const getPriorityBadge = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'medium':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'low':
      default:
        return 'bg-[#1F2C40] text-[#9AA6BC] border-[#2A3B54]';
    }
  };

  const handleOpenDetails = (task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleCloseDetails = () => {
    setIsModalOpen(false);
    setSelectedTask(null);
  };

  const displayedTasks = isFullView ? tasks : tasks.slice(0, 8);

  return (
    <>
      <div className="bg-[#101726] border border-[#1E2A3E] rounded-2xl p-6 flex flex-col justify-between shadow-lg">
        <div>
          {/* Card Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center text-[#CCFF00]">
                <CheckSquare className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#F7F7F2]">Action Tasks</h2>
                <p className="text-xs text-[#9AA6BC]">Parsed to-dos & rich details</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-[#CCFF00] bg-[#CCFF00]/10 px-2 py-0.5 rounded border border-[#CCFF00]/20 font-semibold">
                {pendingCount} pending
              </span>
            </div>
          </div>

          {/* Task List */}
          <div className={`space-y-2.5 overflow-y-auto pr-1 ${isFullView ? 'max-h-[600px]' : 'max-h-[380px]'}`}>
            {tasks.length === 0 ? (
              <div className="text-center py-8 text-[#5B6B82] text-xs">
                No tasks logged. Speak: <br />
                <span className="text-[#9AA6BC] font-mono mt-1 inline-block">
                  "Create a task to prepare hackathon demo with description..."
                </span>
              </div>
            ) : (
              displayedTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => handleOpenDetails(task)}
                  className={`group flex items-start gap-3 p-3.5 rounded-xl border transition cursor-pointer select-none ${
                    task.completed
                      ? 'bg-[#111927]/40 border-[#192233] opacity-65 hover:opacity-90'
                      : 'bg-[#141D2D]/60 hover:bg-[#162235] hover:border-[#CCFF00]/30 border-[#1C283C]'
                  }`}
                >
                  {/* Custom Checkbox (Stops propagation so modal doesn't open when toggling) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (typeof onToggleTask === 'function') {
                        onToggleTask(task.id);
                      }
                    }}
                    className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition shrink-0 ${
                      task.completed
                        ? 'bg-[#CCFF00] border-[#CCFF00] text-[#0B0F17]'
                        : 'border-[#334460] hover:border-[#CCFF00] bg-[#0E1522]'
                    }`}
                    title={task.completed ? 'Mark pending' : 'Mark completed'}
                  >
                    {task.completed && <Check className="w-3 h-3 stroke-[3]" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs font-semibold leading-snug ${
                        task.completed ? 'line-through text-[#62738A]' : 'text-[#F7F7F2]'
                      }`}>
                        {task.title}
                      </p>
                      <ChevronRight className="w-3.5 h-3.5 text-[#5B6B82] group-hover:text-[#CCFF00] group-hover:translate-x-0.5 transition shrink-0 mt-0.5" />
                    </div>

                    {/* Truncated description preview if available */}
                    {task.description && (
                      <p className="text-[11px] text-[#9AA6BC] line-clamp-1 mt-1 leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    {/* Metadata & Tag row */}
                    <div className="flex items-center flex-wrap gap-2 mt-2">
                      {task.priority && (
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded border ${getPriorityBadge(task.priority)}`}>
                          {task.priority}
                        </span>
                      )}

                      {task.dueDate && (
                        <span className="text-[10px] text-[#7A88A1] flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-[#CCFF00]" />
                          {task.dueDate}
                        </span>
                      )}

                      {task.description && (
                        <span className="text-[10px] text-[#8B5CF6] flex items-center gap-1 font-mono" title="Has detailed description">
                          <AlignLeft className="w-3 h-3" />
                          Details
                        </span>
                      )}

                      {task.notes && (
                        <span className="text-[10px] text-[#CCFF00] flex items-center gap-1 font-mono" title="Has notes">
                          <FileText className="w-3 h-3" />
                          Notes
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-4 mt-4 border-t border-[#1A2538] flex items-center justify-between text-[11px] text-[#5B6B82]">
          <span>Click task card to view & edit details</span>
          <span className="text-[#9AA6BC]">{tasks.length} total</span>
        </div>
      </div>

      {/* Rich Task Details & Edit Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={isModalOpen}
        onClose={handleCloseDetails}
        onTaskUpdated={(updatedTask) => {
          setSelectedTask(updatedTask);
          if (typeof onTaskUpdated === 'function') {
            onTaskUpdated(updatedTask);
          }
        }}
        onTaskDeleted={(deletedTaskId) => {
          handleCloseDetails();
          if (typeof onTaskDeleted === 'function') {
            onTaskDeleted(deletedTaskId);
          }
        }}
      />
    </>
  );
}
