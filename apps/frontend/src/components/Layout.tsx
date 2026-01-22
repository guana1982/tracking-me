import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Receipt, Settings, Plus, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn, formatPeriodKey, getCurrentPeriodKey } from '../lib/utils';
import { usePeriods, useDashboard } from '../hooks/useQueries';
import { usePeriodStore } from '../hooks/usePeriod';
import { QuickAddModal } from './QuickAddModal';

export function Layout() {
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isPeriodSelectorOpen, setIsPeriodSelectorOpen] = useState(false);
  const { periodKey, setPeriodKey } = usePeriodStore();
  const { data: periods } = usePeriods();
  const { data: dashboard } = useDashboard(periodKey);

  const budgetRule = dashboard?.budgetRule || { needsPct: 65, wantsPct: 25, savingsPct: 10 };

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/expenses', icon: Receipt, label: 'Spese' },
    { to: '/settings', icon: Settings, label: 'Impostazioni' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="px-4 sm:px-6 lg:px-8 sm:ml-16">
          <div className="flex items-center justify-between h-16">
            {/* Logo, Budget Rule & Period Selector */}
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-slate-900">Budget</h1>
              <span className="text-sm font-medium text-slate-500">
                {budgetRule.needsPct}/{budgetRule.wantsPct}/{budgetRule.savingsPct}
              </span>

              {/* Period Selector */}
              <div className="relative">
                <button
                  onClick={() => setIsPeriodSelectorOpen(!isPeriodSelectorOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <span className="capitalize">{formatPeriodKey(periodKey)}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>

                {isPeriodSelectorOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsPeriodSelectorOpen(false)}
                    />
                    <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20 max-h-64 overflow-y-auto">
                      {/* Current month option */}
                      <button
                        onClick={() => {
                          setPeriodKey(getCurrentPeriodKey());
                          setIsPeriodSelectorOpen(false);
                        }}
                        className={cn(
                          'w-full px-4 py-2 text-left text-sm hover:bg-slate-50',
                          periodKey === getCurrentPeriodKey() &&
                            'bg-slate-100 font-medium'
                        )}
                      >
                        <span className="capitalize">
                          {formatPeriodKey(getCurrentPeriodKey())}
                        </span>
                        <span className="ml-2 text-xs text-slate-500">(corrente)</span>
                      </button>

                      {periods
                        ?.filter((p) => p.periodKey !== getCurrentPeriodKey())
                        .map((period) => (
                          <button
                            key={period.periodKey}
                            onClick={() => {
                              setPeriodKey(period.periodKey);
                              setIsPeriodSelectorOpen(false);
                            }}
                            className={cn(
                              'w-full px-4 py-2 text-left text-sm hover:bg-slate-50 capitalize',
                              periodKey === period.periodKey &&
                                'bg-slate-100 font-medium'
                            )}
                          >
                            {formatPeriodKey(period.periodKey)}
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Quick Add Button (Desktop) */}
            <button
              onClick={() => setIsQuickAddOpen(true)}
              className="hidden sm:flex items-center gap-2 btn btn-primary"
            >
              <Plus className="w-4 h-4" />
              <span>Aggiungi spesa</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 sm:px-6 lg:px-8 py-6 pb-24 sm:pb-6">
        <Outlet />
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 sm:hidden">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center flex-1 h-full text-xs font-medium transition-colors',
                  isActive ? 'text-slate-900' : 'text-slate-500'
                )
              }
            >
              <item.icon className="w-5 h-5 mb-1" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Desktop Navigation (Sidebar could be added here) */}
      <nav className="hidden sm:flex fixed left-0 top-16 bottom-0 w-16 flex-col items-center py-4 bg-white border-r border-slate-200">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center w-12 h-12 rounded-lg mb-2 transition-colors',
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              )
            }
            title={item.label}
          >
            <item.icon className="w-5 h-5" />
          </NavLink>
        ))}
      </nav>

      {/* Floating Action Button (Mobile) */}
      <button
        onClick={() => setIsQuickAddOpen(true)}
        className="sm:hidden fixed bottom-20 right-4 z-50 w-14 h-14 bg-slate-900 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-slate-800 transition-colors"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Quick Add Modal */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        periodKey={periodKey}
      />
    </div>
  );
}
