import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import VoiceCenterpiece from './components/VoiceCenterpiece';
import ExpenseCard from './components/ExpenseCard';
import TasksCard from './components/TasksCard';
import RemindersCard from './components/RemindersCard';
import ActivityCard from './components/ActivityCard';
import { fetchDashboard, fetchHealth, toggleTask } from './services/api';
import {
  AlertCircle,
  Sparkles,
  Server,
  Layers,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState({
    expenses: [],
    tasks: [],
    reminders: [],
    activities: [],
    summary: {}
  });
  const [backendStatus, setBackendStatus] = useState({
    connected: false,
    checked: false,
    details: null
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Load dashboard data and health check
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
    try {
      // Check health
      try {
        const health = await fetchHealth();
        setBackendStatus({ connected: true, checked: true, details: health });
      } catch (healthErr) {
        console.warn('Backend health check error:', healthErr);
        setBackendStatus({ connected: false, checked: true, details: null });
      }

      // Fetch dashboard
      const data = await fetchDashboard();
      setDashboardData(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError('Could not connect to Voca backend. Ensure Express server is running on port 5000.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Poll backend health every 15s to maintain live status
    const interval = setInterval(() => {
      loadData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleToggleTask = async (taskId) => {
    // Optimistic update
    setDashboardData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t)
    }));

    try {
      await toggleTask(taskId);
      // Refresh to sync latest server activity
      loadData(true);
    } catch (err) {
      console.error('Error toggling task:', err);
      // Revert on failure
      loadData(true);
    }
  };

  const counts = {
    expenses: dashboardData.expenses?.length || 0,
    pendingTasks: dashboardData.tasks?.filter(t => !t.completed).length || 0,
    upcomingReminders: dashboardData.reminders?.filter(r => r.status === 'upcoming').length || 0,
  };

  return (
    <div className="flex min-h-screen bg-[#0B0F17] text-[#F7F7F2]">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        backendStatus={backendStatus}
        counts={counts}
        onDataReset={() => loadData(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onRefresh={() => loadData(false)}
          isRefreshing={isRefreshing}
          backendStatus={backendStatus}
        />

        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto space-y-8">
          {/* Connection Error Banner if backend is disconnected */}
          {!backendStatus.connected && backendStatus.checked && (
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/30 flex items-center justify-between text-amber-200 text-xs">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Backend connection offline. Run <code className="bg-[#182030] px-1.5 py-0.5 rounded font-mono text-[#CCFF00]">npm run dev:server</code> to activate the Node.js Express API.
                </span>
              </div>
              <button
                onClick={() => loadData(false)}
                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 rounded text-amber-300 font-semibold"
              >
                Retry
              </button>
            </div>
          )}

          {/* Central Voice Interaction Area */}
          <section>
            <VoiceCenterpiece onActionsExecuted={() => loadData(true)} />
          </section>

          {/* Tab Content Display */}
          {currentTab === 'overview' && (
            <div className="space-y-8">
              {/* Top Stats Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#101726] border border-[#1E2A3E] p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#9AA6BC]">Total Expenses</p>
                    <p className="text-xl font-bold font-mono text-[#F7F7F2] mt-0.5">
                      ₹{dashboardData.summary?.totalExpenses?.toLocaleString('en-IN') || 0}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-[#CCFF00] bg-[#CCFF00]/10 px-2 py-1 rounded border border-[#CCFF00]/20">
                    {dashboardData.expenses?.length || 0} items
                  </span>
                </div>

                <div className="bg-[#101726] border border-[#1E2A3E] p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#9AA6BC]">Active Tasks</p>
                    <p className="text-xl font-bold font-mono text-[#F7F7F2] mt-0.5">
                      {counts.pendingTasks} Pending
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-[#A78BFA] bg-[#8B5CF6]/10 px-2 py-1 rounded border border-[#8B5CF6]/20">
                    {dashboardData.tasks?.length || 0} total
                  </span>
                </div>

                <div className="bg-[#101726] border border-[#1E2A3E] p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#9AA6BC]">Upcoming Reminders</p>
                    <p className="text-xl font-bold font-mono text-[#F7F7F2] mt-0.5">
                      {counts.upcomingReminders} Scheduled
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-[#CCFF00] bg-[#CCFF00]/10 px-2 py-1 rounded border border-[#CCFF00]/20">
                    Synced
                  </span>
                </div>
              </div>

              {/* Core Cards Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ExpenseCard
                  expenses={dashboardData.expenses}
                  summary={dashboardData.summary}
                  onExpenseUpdated={() => loadData(true)}
                  onExpenseDeleted={() => loadData(true)}
                />
                <TasksCard
                  tasks={dashboardData.tasks}
                  onToggleTask={handleToggleTask}
                  onTaskUpdated={() => loadData(true)}
                  onTaskDeleted={() => loadData(true)}
                />
                <RemindersCard
                  reminders={dashboardData.reminders}
                  onReminderUpdated={() => loadData(true)}
                  onReminderDeleted={() => loadData(true)}
                />
              </div>

              {/* Recent Activity Audit */}
              <ActivityCard
                activities={dashboardData.activities}
              />
            </div>
          )}

          {currentTab === 'expenses' && (
            <div className="space-y-6">
              <ExpenseCard
                expenses={dashboardData.expenses}
                summary={dashboardData.summary}
                onExpenseUpdated={() => loadData(true)}
                onExpenseDeleted={() => loadData(true)}
                isFullView={true}
              />
            </div>
          )}

          {currentTab === 'tasks' && (
            <div className="space-y-6">
              <TasksCard
                tasks={dashboardData.tasks}
                onToggleTask={handleToggleTask}
                onTaskUpdated={() => loadData(true)}
                onTaskDeleted={() => loadData(true)}
                isFullView={true}
              />
            </div>
          )}

          {currentTab === 'reminders' && (
            <div className="space-y-6">
              <RemindersCard
                reminders={dashboardData.reminders}
                onReminderUpdated={() => loadData(true)}
                onReminderDeleted={() => loadData(true)}
                isFullView={true}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
