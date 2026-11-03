import React, { useState, useEffect } from 'react';
import {
  X,
  Receipt,
  Calendar,
  Tag,
  Trash2,
  Edit3,
  Save,
  AlertTriangle,
  RotateCcw,
  Clock,
  Sparkles
} from 'lucide-react';
import { updateExpense, deleteExpense } from '../services/api';

const EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Transit',
  'Shopping',
  'Entertainment',
  'Software',
  'Health',
  'Bills',
  'General'
];

export default function ExpenseDetailModal({
  expense,
  isOpen,
  onClose,
  onExpenseUpdated,
  onExpenseDeleted
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');

  // Form edit state
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [date, setDate] = useState('');

  useEffect(() => {
    if (expense) {
      setAmount(String(expense.amount || ''));
      setDescription(expense.description || '');
      setCategory(expense.category || 'General');
      setDate(expense.date || '');
      setIsEditing(false);
      setShowDeleteConfirm(false);
      setError('');
    }
  }, [expense, isOpen]);

  if (!isOpen || !expense) return null;

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

  const handleSaveEdits = async (e) => {
    e?.preventDefault();
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Expense amount must be a positive number greater than 0.');
      return;
    }
    if (!description.trim()) {
      setError('Expense description is required.');
      return;
    }
    if (!date.trim()) {
      setError('Expense date is required.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const payload = {
        amount: numAmount,
        description: description.trim(),
        category: category.trim() || 'General',
        date: date.trim(),
        currency: expense.currency || '₹'
      };

      const updated = await updateExpense(expense.id, payload);
      setIsEditing(false);
      if (typeof onExpenseUpdated === 'function') {
        onExpenseUpdated(updated);
      }
    } catch (err) {
      setError(err.message || 'Failed to save expense changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setError('');
    try {
      await deleteExpense(expense.id);
      setShowDeleteConfirm(false);
      onClose();
      if (typeof onExpenseDeleted === 'function') {
        onExpenseDeleted(expense.id);
      }
    } catch (err) {
      setError(err.message || 'Failed to delete expense.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#101726] border border-[#1E2A3E] rounded-2xl shadow-2xl p-6 sm:p-7 flex flex-col text-left space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#1A2538]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center text-[#CCFF00] shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#7A88A1]">
                Expense Details · ID: {expense.id}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#1C273B] text-[#9AA6BC] border border-[#2A3B54]">
                  {isEditing ? category : expense.category}
                </span>
                <span className="text-[10px] font-mono text-[#5B6B82]">
                  {isEditing ? date : expense.date}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-2.5 py-1.5 rounded-lg bg-[#141E30] hover:bg-[#1A273D] border border-[#223147] text-xs font-medium text-[#9AA6BC] hover:text-[#CCFF00] transition flex items-center gap-1"
                title="Edit expense"
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
                <h4 className="text-xs font-bold text-rose-200">Confirm Expense Deletion</h4>
                <p className="text-xs text-rose-300/80 mt-0.5">
                  Are you sure you want to delete this expense of <span className="font-semibold text-[#CCFF00] font-mono">₹{expense.amount}</span> for <span className="font-semibold text-white">"{expense.description}"</span> on {expense.date}? This will permanently remove it from storage.
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
                {isDeleting ? 'Deleting...' : 'Yes, Delete Expense'}
              </button>
            </div>
          </div>
        )}

        {/* View Mode vs Edit Mode */}
        {!isEditing ? (
          /* ================= VIEW MODE ================= */
          <div className="space-y-4">
            {/* Amount Banner */}
            <div className="p-4 rounded-xl bg-[#141E30] border border-[#1F2E47] flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#9AA6BC]">
                  Total Recorded Amount
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-3xl font-extrabold font-mono text-[#CCFF00]">
                    {expense.currency || '₹'}{Number(expense.amount).toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-[#5B6B82] ml-1">INR</span>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-lg bg-[#1C273B] text-[#9AA6BC] font-medium border border-[#2A3B54]">
                {expense.category}
              </span>
            </div>

            {/* Description Card */}
            <div className="p-4 rounded-xl bg-[#0D1322] border border-[#192538] space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B5CF6]">
                Description / Purpose
              </span>
              <p className="text-sm font-semibold text-[#F7F7F2]">
                {expense.description}
              </p>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#141E30]/70 border border-[#1F2E47]">
                <span className="text-[10px] uppercase text-[#7A88A1] font-medium block mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#CCFF00]" /> Transaction Date
                </span>
                <span className="font-mono text-[#F7F7F2] font-semibold">
                  {expense.date}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[#141E30]/70 border border-[#1F2E47]">
                <span className="text-[10px] uppercase text-[#7A88A1] font-medium block mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#A78BFA]" /> Logged At
                </span>
                <span className="font-mono text-[#9AA6BC]">
                  {formatDate(expense.createdAt)}
                </span>
              </div>
            </div>

            {expense.updatedAt && expense.updatedAt !== expense.createdAt && (
              <div className="text-[10px] text-[#5B6B82] font-mono px-1">
                Last modified: {formatDate(expense.updatedAt)}
              </div>
            )}
          </div>
        ) : (
          /* ================= EDIT MODE ================= */
          <form onSubmit={handleSaveEdits} className="space-y-4">
            {/* Amount Input */}
            <div>
              <label className="text-xs font-semibold text-[#9AA6BC] block mb-1">
                Amount (₹ INR) <span className="text-[#CCFF00]">*</span>
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 450"
                className="w-full px-3.5 py-2 rounded-lg bg-[#0D1322] border border-[#223147] focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] text-sm font-mono text-[#F7F7F2] outline-none transition"
                required
              />
            </div>

            {/* Description Input */}
            <div>
              <label className="text-xs font-semibold text-[#9AA6BC] block mb-1">
                Description <span className="text-[#CCFF00]">*</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. dinner at restaurant"
                className="w-full px-3.5 py-2 rounded-lg bg-[#0D1322] border border-[#223147] focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] text-xs text-[#F7F7F2] outline-none transition"
                required
              />
            </div>

            {/* Category Select */}
            <div>
              <label className="text-xs font-semibold text-[#9AA6BC] block mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0D1322] border border-[#223147] focus:border-[#CCFF00] text-xs text-[#F7F7F2] outline-none"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Date Input */}
            <div>
              <label className="text-xs font-semibold text-[#9AA6BC] block mb-1">
                Transaction Date <span className="text-[#CCFF00]">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-[#0D1322] border border-[#223147] focus:border-[#CCFF00] text-xs font-mono text-[#F7F7F2] outline-none"
                required
              />
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
              <span>Delete Expense</span>
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
