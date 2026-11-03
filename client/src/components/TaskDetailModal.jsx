import React, { useState, useEffect } from 'react';
import {
  X,
  CheckSquare,
  Check,
  Clock,
  Calendar,
  AlignLeft,
  FileText,
  Trash2,
  Edit3,
  Save,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';
import { updateTask, deleteTask } from '../services/api';

export default function TaskDetailModal({
  task,
  isOpen,
  onClose,
  onTaskUpdated,
  onTaskDeleted
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');

  // Form edit state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [completed, setCompleted] = useState(false);

  // Sync state whenever task changes or modal opens
  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setNotes(task.notes || '');
      setPriority(task.priority?.toLowerCase() || 'medium');
      setDueDate(task.dueDate || '');
      setCompleted(Boolean(task.completed));
      setIsEditing(false);
      setShowDeleteConfirm(false);
      setError('');
    }
  }, [task, isOpen]);

  if (!isOpen || !task) return null;

  const getPriorityBadgeStyle = (prio) => {
    switch (prio?.toLowerCase()) {
      case 'high':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'medium':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'low':
      default:
        return 'bg-[#1F2C40] text-[#9AA6BC] border-[#2A3B54]';
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  // Toggle completed directly from modal
  const handleToggleComplete = async () => {
    setIsSaving(true);
    setError('');
    try {
      const updated = await updateTask(task.id, { completed: !completed });
      setCompleted(updated.completed);
      if (typeof onTaskUpdated === 'function') {
        onTaskUpdated(updated);
      }
    } catch (err) {
      setError(err.message || 'Failed to update completion status.');
    } finally {
      setIsSaving(false);
    }
  };

  // Save full edits
  const handleSaveEdits = async (e) => {
    e?.preventDefault();
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        notes: notes.trim() || null,
        priority,
        dueDate: dueDate.trim() || null,
        completed
      };

      const updated = await updateTask(task.id, payload);
      setIsEditing(false);
      if (typeof onTaskUpdated === 'function') {
        onTaskUpdated(updated);
      }
    } catch (err) {
      setError(err.message || 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete task after confirmation
  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setError('');
    try {
      await deleteTask(task.id);
      setShowDeleteConfirm(false);
      onClose();
      if (typeof onTaskDeleted === 'function') {
        onTaskDeleted(task.id);
      }
    } catch (err) {
      setError(err.message || 'Failed to delete task.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-[#101726] border border-[#1E2A3E] rounded-2xl shadow-2xl p-6 sm:p-7 flex flex-col text-left space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#1A2538]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center text-[#CCFF00] shrink-0">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#7A88A1]">
                Task Details · ID: {task.id}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${getPriorityBadgeStyle(isEditing ? priority : task.priority)}`}>
                  {(isEditing ? priority : task.priority) || 'medium'} priority
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                  (isEditing ? completed : task.completed)
                    ? 'bg-[#CCFF00]/15 text-[#CCFF00] border-[#CCFF00]/30'
                    : 'bg-[#172235] text-[#9AA6BC] border-[#25354F]'
                }`}>
                  {(isEditing ? completed : task.completed) ? 'Completed' : 'Pending'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-2.5 py-1.5 rounded-lg bg-[#141E30] hover:bg-[#1A273D] border border-[#223147] text-xs font-medium text-[#9AA6BC] hover:text-[#CCFF00] transition flex items-center gap-1"
                title="Edit task"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#7A88A1] hover:text-[#F7F7F2] hover:bg-[#151F32] transition"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error notification banner */}
        {error && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Delete Confirmation Box */}
        {showDeleteConfirm && (
          <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 space-y-3 animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-rose-200">Confirm Task Deletion</h4>
                <p className="text-xs text-rose-300/80 mt-0.5">
                  Are you sure you want to delete <span className="font-semibold text-white">"{task.title}"</span>? This will permanently remove it from storage.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg bg-[#141C2B] hover:bg-[#1A2538] border border-[#273752] text-xs font-medium text-[#9AA6BC] hover:text-[#F7F7F2] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-rose-900/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? 'Deleting...' : 'Yes, Delete Task'}
              </button>
            </div>
          </div>
        )}

        {/* Content Body: Viewing Mode vs Editing Mode */}
        {!isEditing ? (
          /* ================= VIEW MODE ================= */
          <div className="space-y-4">
            {/* Title & Quick Status Toggle */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#141E30] border border-[#1F2E47]">
              <button
                onClick={handleToggleComplete}
                disabled={isSaving}
                className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition shrink-0 ${
                  completed
                    ? 'bg-[#CCFF00] border-[#CCFF00] text-[#0B0F17]'
                    : 'border-[#334460] hover:border-[#CCFF00] bg-[#0E1522]'
                }`}
                title={completed ? 'Mark task pending' : 'Mark task completed'}
              >
                {completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </button>
              <div className="flex-1 min-w-0">
                <h3 className={`text-base font-semibold leading-snug ${
                  completed ? 'line-through text-[#62738A]' : 'text-[#F7F7F2]'
                }`}>
                  {task.title}
                </h3>
                <span className="text-[11px] text-[#7A88A1] mt-0.5 block">
                  Click checkbox to toggle completion
                </span>
              </div>
            </div>

            {/* Description Section */}
            <div className="p-4 rounded-xl bg-[#0D1322] border border-[#192538] space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B5CF6] flex items-center gap-1.5">
                <AlignLeft className="w-3.5 h-3.5 text-[#A78BFA]" />
                Description
              </span>
              {task.description ? (
                <p className="text-xs text-[#F7F7F2] leading-relaxed whitespace-pre-wrap">
                  {task.description}
                </p>
              ) : (
                <p className="text-xs text-[#5B6B82] italic">
                  No detailed description provided.
                </p>
              )}
            </div>

            {/* Notes Section */}
            <div className="p-4 rounded-xl bg-[#0D1322] border border-[#192538] space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#CCFF00] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#CCFF00]" />
                Additional Notes
              </span>
              {task.notes ? (
                <p className="text-xs text-[#E2E8F0] leading-relaxed whitespace-pre-wrap">
                  {task.notes}
                </p>
              ) : (
                <p className="text-xs text-[#5B6B82] italic">
                  No additional notes or instructions logged.
                </p>
              )}
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#141E30]/70 border border-[#1F2E47]">
                <span className="text-[10px] uppercase text-[#7A88A1] font-medium block mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#CCFF00]" /> Due Date
                </span>
                <span className="font-mono text-[#F7F7F2] font-semibold">
                  {task.dueDate || 'Not set'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[#141E30]/70 border border-[#1F2E47]">
                <span className="text-[10px] uppercase text-[#7A88A1] font-medium block mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#A78BFA]" /> Created At
                </span>
                <span className="font-mono text-[#9AA6BC]">
                  {formatDate(task.createdAt)}
                </span>
              </div>
            </div>

            {task.updatedAt && task.updatedAt !== task.createdAt && (
              <div className="text-[10px] text-[#5B6B82] font-mono px-1">
                Last modified: {formatDate(task.updatedAt)}
              </div>
            )}
          </div>
        ) : (
          /* ================= EDIT MODE ================= */
          <form onSubmit={handleSaveEdits} className="space-y-4">
            {/* Title Input */}
            <div>
              <label className="text-xs font-semibold text-[#9AA6BC] block mb-1">
                Task Title <span className="text-[#CCFF00]">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Prepare the hackathon demo"
                className="w-full px-3.5 py-2 rounded-lg bg-[#0D1322] border border-[#223147] focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] text-xs text-[#F7F7F2] outline-none transition"
                required
              />
            </div>

            {/* Description Textarea */}
            <div>
              <label className="text-xs font-semibold text-[#9AA6BC] block mb-1">
                Full Description (Optional)
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add sub-steps, agenda, or detailed instructions..."
                className="w-full px-3.5 py-2 rounded-lg bg-[#0D1322] border border-[#223147] focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] text-xs text-[#F7F7F2] outline-none transition resize-y"
              />
            </div>

            {/* Notes Textarea */}
            <div>
              <label className="text-xs font-semibold text-[#9AA6BC] block mb-1">
                Notes & Context (Optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add quick reference notes, links, or context..."
                className="w-full px-3.5 py-2 rounded-lg bg-[#0D1322] border border-[#223147] focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] text-xs text-[#F7F7F2] outline-none transition resize-y"
              />
            </div>

            {/* Priority & Due Date Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#9AA6BC] block mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0D1322] border border-[#223147] focus:border-[#CCFF00] text-xs text-[#F7F7F2] outline-none"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#9AA6BC] block mb-1">
                  Due Date
                </label>
                <input
                  type="text"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  placeholder="e.g. 2026-11-04 or Tomorrow"
                  className="w-full px-3.5 py-2 rounded-lg bg-[#0D1322] border border-[#223147] focus:border-[#CCFF00] text-xs text-[#F7F7F2] outline-none"
                />
              </div>
            </div>

            {/* Completed Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="editCompleted"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
                className="w-4 h-4 rounded border-[#223147] bg-[#0D1322] text-[#CCFF00] focus:ring-0 cursor-pointer"
              />
              <label htmlFor="editCompleted" className="text-xs text-[#9AA6BC] cursor-pointer">
                Mark task as completed
              </label>
            </div>

            {/* Edit Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#1A2538]">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setError('');
                }}
                disabled={isSaving}
                className="px-3.5 py-2 rounded-lg bg-[#141C2B] hover:bg-[#1A2538] border border-[#273752] text-xs font-medium text-[#9AA6BC] hover:text-[#F7F7F2] transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 rounded-lg bg-[#CCFF00] hover:bg-[#D4FF1A] text-[#0B0F17] text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-[#CCFF00]/20"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {/* Modal Bottom Bar: Delete Option */}
        {!isEditing && !showDeleteConfirm && (
          <div className="pt-3 border-t border-[#1A2538] flex items-center justify-between">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-xs text-rose-400 hover:text-rose-300 transition flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-rose-950/30"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Task</span>
            </button>

            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-[#141C2B] hover:bg-[#1A2538] border border-[#273752] text-xs font-medium text-[#9AA6BC] hover:text-[#F7F7F2] transition"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
