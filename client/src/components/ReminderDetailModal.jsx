import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  CalendarClock,
  Clock,
  Calendar,
  AlignLeft,
  FileText,
  Trash2,
  Edit3,
  Save,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  Check,
  Tag
} from 'lucide-react';
import { updateReminder, deleteReminder } from '../services/api';

function isScheduleInPast(dateStr, timeStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const now = new Date();
  const trimmedDate = dateStr.trim().toLowerCase();

  if (trimmedDate === 'yesterday') return true;
  if (trimmedDate === 'tomorrow') return false;

  let year, month, day;
  const isoMatch = trimmedDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10) - 1;
    day = parseInt(isoMatch[3], 10);
  } else if (trimmedDate === 'today') {
    year = now.getFullYear();
    month = now.getMonth();
    day = now.getDate();
  } else {
    const parsed = new Date(trimmedDate);
    if (isNaN(parsed.getTime())) return false;
    year = parsed.getFullYear();
    month = parsed.getMonth();
    day = parsed.getDate();
  }

  // Parse time if provided
  if (timeStr && typeof timeStr === 'string' && timeStr.trim()) {
    const trimmedTime = timeStr.trim().toLowerCase();
    const match12 = trimmedTime.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)$/i);
    let hours = null, minutes = 0, seconds = 0;
    if (match12) {
      hours = parseInt(match12[1], 10);
      minutes = match12[2] ? parseInt(match12[2], 10) : 0;
      seconds = match12[3] ? parseInt(match12[3], 10) : 0;
      const meridiem = match12[4].toLowerCase();
      if (meridiem === 'pm' && hours < 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;
    } else {
      const match24 = trimmedTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (match24) {
        hours = parseInt(match24[1], 10);
        minutes = parseInt(match24[2], 10);
        seconds = match24[3] ? parseInt(match24[3], 10) : 0;
      }
    }

    if (hours !== null) {
      const scheduled = new Date(year, month, day, hours, minutes, seconds, 0);
      return scheduled.getTime() < now.getTime();
    }
  }

  // No time provided: check end of day
  const endOfDay = new Date(year, month, day, 23, 59, 59, 999);
  return endOfDay.getTime() < now.getTime();
}

export default function ReminderDetailModal({
  reminder,
  isOpen,
  onClose,
  onReminderUpdated,
  onReminderDeleted
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
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [status, setStatus] = useState('upcoming');

  useEffect(() => {
    if (reminder) {
      setTitle(reminder.title || '');
      setDescription(reminder.description || '');
      setNotes(reminder.notes || '');
      setDate(reminder.date || '');
      setTime(reminder.time || '');
      setStatus(reminder.status || 'upcoming');
      setIsEditing(false);
      setShowDeleteConfirm(false);
      setError('');
    }
  }, [reminder, isOpen]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else if (isEditing) {
          setIsEditing(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showDeleteConfirm, isEditing, onClose]);

  if (!isOpen || !reminder) return null;

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
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

  const handleToggleStatus = async () => {
    setIsSaving(true);
    setError('');
    const newStatus = status === 'upcoming' ? 'completed' : 'upcoming';
    try {
      const updated = await updateReminder(reminder.id, { status: newStatus });
      setStatus(updated.status);
      if (typeof onReminderUpdated === 'function') {
        onReminderUpdated(updated);
      }
    } catch (err) {
      setError(err.message || 'Failed to update reminder status.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEdits = async (e) => {
    e?.preventDefault();
    if (!title.trim()) {
      setError('Reminder title is required.');
      return;
    }

    const cleanDate = date.trim() || 'Upcoming';
    const cleanTime = time.trim() || null;

    // Frontend validation: reject past dates/times
    if (isScheduleInPast(cleanDate, cleanTime)) {
      setError('This reminder time has already passed. Please choose a future time.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const cleanDateTime = cleanTime ? `${cleanDate}, ${cleanTime}` : cleanDate;

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        notes: notes.trim() || null,
        date: cleanDate,
        time: cleanTime,
        dateTime: cleanDateTime,
        status: status.trim().toLowerCase()
      };

      const updated = await updateReminder(reminder.id, payload);
      setIsEditing(false);
      if (typeof onReminderUpdated === 'function') {
        onReminderUpdated(updated);
      }
    } catch (err) {
      setError(err.message || 'Failed to save reminder changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setError('');
    try {
      await deleteReminder(reminder.id);
      setShowDeleteConfirm(false);
      onClose();
      if (typeof onReminderDeleted === 'function') {
        onReminderDeleted(reminder.id);
      }
    } catch (err) {
      setError(err.message || 'Failed to delete reminder.');
      setIsDeleting(false);
    }
  };

  const isCompleted = (isEditing ? status : reminder.status) === 'completed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-[#101726] border border-[#1E2A3E] rounded-2xl shadow-2xl p-6 sm:p-7 flex flex-col text-left space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#1A2538]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center text-[#A78BFA] shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#7A88A1]">
                Reminder Details · ID: {reminder.id}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
                  isCompleted
                    ? 'bg-[#8B5CF6]/15 text-[#A78BFA] border-[#8B5CF6]/30'
                    : 'bg-[#CCFF00]/15 text-[#CCFF00] border-[#CCFF00]/30'
                }`}>
                  {isEditing ? status : reminder.status}
                </span>
                <span className="text-[10px] font-mono text-[#5B6B82] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#A78BFA]" />
                  {isEditing ? (time ? `${date}, ${time}` : date) : reminder.dateTime}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-2.5 py-1.5 rounded-lg bg-[#141E30] hover:bg-[#1A273D] border border-[#223147] text-xs font-medium text-[#9AA6BC] hover:text-[#CCFF00] transition flex items-center gap-1"
                title="Edit reminder"
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
                <h4 className="text-xs font-bold text-rose-200">Confirm Reminder Deletion</h4>
                <p className="text-xs text-rose-300/80 mt-0.5">
                  Are you sure you want to delete <span className="font-semibold text-white">"{reminder.title}"</span> scheduled for <span className="font-semibold text-[#CCFF00] font-mono">{reminder.dateTime}</span>? This will permanently remove it from storage.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg bg-[#141E30] hover:bg-[#1B273E] text-xs font-medium text-[#9AA6BC] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-lg shadow-rose-900/30"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Modal Body: VIEW MODE */}
        {!isEditing && (
          <div className="space-y-5">
            {/* Title & Status Quick Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#141D2D]/70 border border-[#1C283C]">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#7A88A1]">Reminder Title</span>
                <h3 className={`text-lg font-bold text-[#F7F7F2] break-words mt-0.5 ${reminder.status === 'completed' ? 'line-through opacity-70' : ''}`}>
                  {reminder.title}
                </h3>
              </div>
              <button
                onClick={handleToggleStatus}
                disabled={isSaving}
                className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
                  reminder.status === 'completed'
                    ? 'bg-[#172235] hover:bg-[#1E2C42] border-[#2A3B54] text-[#9AA6BC] hover:text-[#F7F7F2]'
                    : 'bg-[#CCFF00]/15 hover:bg-[#CCFF00]/25 border-[#CCFF00]/30 text-[#CCFF00]'
                }`}
                title={reminder.status === 'completed' ? 'Reopen reminder' : 'Mark reminder completed'}
              >
                {reminder.status === 'completed' ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reopen</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Mark Done</span>
                  </>
                )}
              </button>
            </div>

            {/* Time & Trigger Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-[#141C2B] border border-[#1E2A3E]">
                <div className="flex items-center gap-2 text-xs text-[#9AA6BC]">
                  <Calendar className="w-3.5 h-3.5 text-[#A78BFA]" />
                  <span>Scheduled Date</span>
                </div>
                <p className="text-sm font-semibold font-mono text-[#F7F7F2] mt-1">
                  {reminder.date || 'Upcoming'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#141C2B] border border-[#1E2A3E]">
                <div className="flex items-center gap-2 text-xs text-[#9AA6BC]">
                  <Clock className="w-3.5 h-3.5 text-[#CCFF00]" />
                  <span>Scheduled Time</span>
                </div>
                <p className="text-sm font-semibold font-mono text-[#CCFF00] mt-1">
                  {reminder.time || 'All Day / Any Time'}
                </p>
              </div>
            </div>

            {/* Complete DateTime String Callout */}
            <div className="p-3 rounded-xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 flex items-center justify-between text-xs">
              <span className="text-[#9AA6BC] flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4 text-[#A78BFA]" />
                Trigger Schedule
              </span>
              <span className="font-mono font-semibold text-[#A78BFA]">
                {reminder.dateTime || 'Upcoming'}
              </span>
            </div>

            {/* Description Section */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#9AA6BC]">
                <AlignLeft className="w-3.5 h-3.5 text-[#A78BFA]" />
                <span>Description</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#141C2B] border border-[#1E2A3E] text-xs text-[#E2E8F0] whitespace-pre-wrap min-h-[60px] leading-relaxed">
                {reminder.description ? (
                  reminder.description
                ) : (
                  <span className="text-[#5B6B82] italic">No detailed description attached.</span>
                )}
              </div>
            </div>

            {/* Notes Section */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#9AA6BC]">
                <FileText className="w-3.5 h-3.5 text-[#CCFF00]" />
                <span>Additional Notes</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#141C2B] border border-[#1E2A3E] text-xs text-[#E2E8F0] whitespace-pre-wrap min-h-[60px] leading-relaxed">
                {reminder.notes ? (
                  reminder.notes
                ) : (
                  <span className="text-[#5B6B82] italic">No additional notes attached.</span>
                )}
              </div>
            </div>

            {/* Audit Timestamps */}
            <div className="pt-2 border-t border-[#1A2538] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5B6B82]">
              <div className="flex items-center gap-1.5 font-mono">
                <Clock className="w-3 h-3 text-[#7A88A1]" />
                <span>Created: {formatDate(reminder.createdAt)}</span>
              </div>
              {reminder.updatedAt && (
                <div className="font-mono text-[#7A88A1]">
                  Updated: {formatDate(reminder.updatedAt)}
                </div>
              )}
            </div>

            {/* Action Bar: Delete / Edit */}
            <div className="pt-3 border-t border-[#1A2538] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={showDeleteConfirm}
                className="px-3.5 py-2 rounded-xl bg-rose-950/20 hover:bg-rose-950/40 border border-rose-500/25 hover:border-rose-500/40 text-rose-300 text-xs font-medium transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Reminder</span>
              </button>

              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 rounded-xl bg-[#CCFF00] hover:bg-[#b8e600] text-[#0B0F17] font-bold text-xs transition flex items-center gap-1.5 shadow-lg shadow-[#CCFF00]/20"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Reminder</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Body: EDIT MODE */}
        {isEditing && (
          <form onSubmit={handleSaveEdits} className="space-y-4">
            <div className="p-3 rounded-xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 flex items-center justify-between text-xs">
              <span className="text-[#A78BFA] font-medium flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5" />
                Editing Reminder
              </span>
              <span className="text-[10px] font-mono text-[#5B6B82]">ID: {reminder.id}</span>
            </div>

            {/* Title field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#9AA6BC]">
                Reminder Title <span className="text-[#CCFF00]">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Submit project draft on Hackathon portal"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#141C2B] border border-[#223147] focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] text-[#F7F7F2] text-sm placeholder-[#5B6B82] outline-none transition"
              />
            </div>

            {/* Date and Time Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#9AA6BC]">
                  Scheduled Date <span className="text-[#CCFF00]">*</span>
                </label>
                <input
                  type="text"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder="e.g. 2026-11-06 or Friday"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#141C2B] border border-[#223147] focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] text-[#F7F7F2] text-xs font-mono placeholder-[#5B6B82] outline-none transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#9AA6BC]">
                  Scheduled Time <span className="text-[#5B6B82]">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  placeholder="e.g. 05:00 PM or 17:00"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#141C2B] border border-[#223147] focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] text-[#F7F7F2] text-xs font-mono placeholder-[#5B6B82] outline-none transition"
                />
              </div>
            </div>

            {/* Status Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#9AA6BC]">Status</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('upcoming')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    status === 'upcoming'
                      ? 'bg-[#CCFF00]/15 border-[#CCFF00] text-[#CCFF00]'
                      : 'bg-[#141C2B] border-[#223147] text-[#9AA6BC] hover:text-[#F7F7F2]'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Upcoming</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('completed')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    status === 'completed'
                      ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-[#A78BFA]'
                      : 'bg-[#141C2B] border-[#223147] text-[#9AA6BC] hover:text-[#F7F7F2]'
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Completed</span>
                </button>
              </div>
            </div>

            {/* Description textarea */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#9AA6BC]">
                Description <span className="text-[#5B6B82]">(Optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Detailed context or instructions..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#141C2B] border border-[#223147] focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] text-[#F7F7F2] text-xs placeholder-[#5B6B82] outline-none transition resize-none"
              />
            </div>

            {/* Notes textarea */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#9AA6BC]">
                Notes <span className="text-[#5B6B82]">(Optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Additional notes, links, or follow-up points..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#141C2B] border border-[#223147] focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] text-[#F7F7F2] text-xs placeholder-[#5B6B82] outline-none transition resize-none"
              />
            </div>

            {/* Form Action Buttons */}
            <div className="pt-3 border-t border-[#1A2538] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setError('');
                }}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-[#141E30] hover:bg-[#1B273E] text-xs font-medium text-[#9AA6BC] hover:text-[#F7F7F2] transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-[#CCFF00] hover:bg-[#b8e600] text-[#0B0F17] font-bold text-xs transition flex items-center gap-1.5 shadow-lg shadow-[#CCFF00]/20"
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[#0B0F17]/30 border-t-[#0B0F17] rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
