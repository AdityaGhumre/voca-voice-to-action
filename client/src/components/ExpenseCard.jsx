import React, { useState } from 'react';
import { Receipt, TrendingUp, Tag, Plus, ChevronRight } from 'lucide-react';
import ExpenseDetailModal from './ExpenseDetailModal';

export default function ExpenseCard({
  expenses = [],
  summary,
  onExpenseUpdated,
  onExpenseDeleted,
  isFullView = false
}) {
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const total = summary?.totalExpenses ?? expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const currency = summary?.expensesCurrency || '₹';

  const handleOpenDetails = (exp) => {
    setSelectedExpense(exp);
    setIsModalOpen(true);
  };

  const handleCloseDetails = () => {
    setIsModalOpen(false);
    setSelectedExpense(null);
  };

  const displayedExpenses = isFullView ? expenses : expenses.slice(0, 8);

  return (
    <>
      <div className="bg-[#101726] border border-[#1E2A3E] rounded-2xl p-6 flex flex-col justify-between shadow-lg">
        <div>
          {/* Card Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center text-[#CCFF00]">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#F7F7F2]">Expenses</h2>
                <p className="text-xs text-[#9AA6BC]">Tracked from speech</p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-[#5B6B82] bg-[#141D2D] px-2 py-0.5 rounded border border-[#1F2C40]">
              {expenses.length} entries
            </span>
          </div>

          {/* Total Spend Callout */}
          <div className="bg-[#141C2B] border border-[#1E2A3E] rounded-xl p-4 mb-5">
            <span className="text-xs text-[#9AA6BC] font-medium">Total Recorded</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold text-[#F7F7F2] font-mono">
                {currency}{total.toLocaleString('en-IN')}
              </span>
              <span className="text-xs text-[#5B6B82] ml-1">total spend</span>
            </div>
          </div>

          {/* Expenses List */}
          <div className={`space-y-2.5 overflow-y-auto pr-1 ${isFullView ? 'max-h-[580px]' : 'max-h-[300px]'}`}>
            {expenses.length === 0 ? (
              <div className="text-center py-8 text-[#5B6B82] text-xs">
                No expenses recorded yet. Speak a phrase like <br />
                <span className="text-[#9AA6BC] font-mono mt-1 inline-block">"I spent ₹250 on lunch"</span>
              </div>
            ) : (
              displayedExpenses.map((exp) => (
                <div
                  key={exp.id}
                  onClick={() => handleOpenDetails(exp)}
                  className="group flex items-center justify-between p-3.5 rounded-xl bg-[#141D2D]/60 hover:bg-[#162235] border border-[#1C283C] hover:border-[#CCFF00]/30 transition cursor-pointer select-none"
                >
                  <div className="min-w-0 pr-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#F7F7F2] truncate group-hover:text-[#CCFF00] transition">
                        {exp.description}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1C273B] text-[#9AA6BC] font-medium shrink-0">
                        {exp.category}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#5B6B82] mt-0.5 block font-mono">
                      {exp.date}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold font-mono text-[#CCFF00]">
                      {exp.currency || '₹'}{Number(exp.amount).toLocaleString('en-IN')}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#5B6B82] group-hover:text-[#CCFF00] group-hover:translate-x-0.5 transition" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-4 mt-4 border-t border-[#1A2538] flex items-center justify-between text-[11px] text-[#5B6B82]">
          <span>Click expense card to view & edit details</span>
          <span className="text-[#CCFF00] font-mono">{currency}{total.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Expense Detail & Edit Modal */}
      <ExpenseDetailModal
        expense={selectedExpense}
        isOpen={isModalOpen}
        onClose={handleCloseDetails}
        onExpenseUpdated={(updatedExp) => {
          setSelectedExpense(updatedExp);
          if (typeof onExpenseUpdated === 'function') {
            onExpenseUpdated(updatedExp);
          }
        }}
        onExpenseDeleted={(deletedExpId) => {
          handleCloseDetails();
          if (typeof onExpenseDeleted === 'function') {
            onExpenseDeleted(deletedExpId);
          }
        }}
      />
    </>
  );
}
