import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  LineChart,
  Briefcase,
  Settings,
  Plus,
  ChevronDown,
  LogOut,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { cn, formatPeriodKey, getCurrentPeriodKey, getAllPeriodsForYear } from '../lib/utils';
import { usePeriods, useDashboard } from '../hooks/useQueries';
import { usePeriodStore } from '../hooks/usePeriod';
import { QuickAddModal } from './QuickAddModal';
import { useAuthStore } from '../stores/authStore';

export function Layout() {
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isPeriodSelectorOpen, setIsPeriodSelectorOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const location = useLocation();
  const { periodKey, setPeriodKey } = usePeriodStore();
  const { data: periods } = usePeriods();
  const { data: dashboard } = useDashboard(periodKey);
  const { user, logout } = useAuthStore();
  const isCashFlowPage = location.pathname.startsWith('/cash-flow');
  const isPortfolioPage = location.pathname.startsWith('/portfolio');
  const showBudgetContext = !isCashFlowPage && !isPortfolioPage;
  const appTitle = isCashFlowPage ? 'Net Worth' : isPortfolioPage ? 'Portafoglio' : 'Budget';

  const budgetRule = dashboard?.budgetRule || { needsPct: 65, wantsPct: 25, savingsPct: 10 };

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/expenses', icon: Receipt, label: 'Spese' },
    { to: '/cash-flow', icon: LineChart, label: 'Cash Flow' },
    { to: '/portfolio', icon: Briefcase, label: 'Portafoglio' },
    { to: '/settings', icon: Settings, label: 'Impostazioni' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 md:h-screen md:overflow-hidden md:flex md:flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="px-4 sm:px-6 lg:px-8 sm:ml-16">
          <div className="flex items-center justify-between h-16">
            {/* Logo, Budget Rule & Period Selector */}
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold bg-gradient-to-r from-sky-500 via-blue-600 to-fuchsia-500 bg-clip-text text-transparent">
                {appTitle}
              </h1>
              {showBudgetContext && (
                <span className="text-xl font-bold text-slate-900">
                  {budgetRule.needsPct}/{budgetRule.wantsPct}/{budgetRule.savingsPct}
                </span>
              )}

              {/* Period Selector */}
              {showBudgetContext && (
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
                      <div className="absolute left-0 mt-2 w-52 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20 max-h-80 overflow-y-auto">
                        {/* All months of current year */}
                        {getAllPeriodsForYear(new Date().getFullYear()).map((period) => {
                          const isCurrentMonth = period.periodKey === getCurrentPeriodKey();
                          const hasData = periods?.some((p) => p.periodKey === period.periodKey);

                          return (
                            <button
                              key={period.periodKey}
                              onClick={() => {
                                setPeriodKey(period.periodKey);
                                setIsPeriodSelectorOpen(false);
                              }}
                              className={cn(
                                'w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center justify-between',
                                periodKey === period.periodKey && 'bg-slate-100 font-medium'
                              )}
                            >
                              <span className="capitalize">
                                {formatPeriodKey(period.periodKey)}
                              </span>
                              <span className="flex items-center gap-1">
                                {isCurrentMonth && (
                                  <span className="text-xs text-slate-500">(corrente)</span>
                                )}
                                {hasData && (
                                  <span className="w-2 h-2 rounded-full bg-green-500" title="Ha dati" />
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Today's Date */}
              <div className="text-sm text-slate-500">
                <span className="hidden sm:inline">Oggi: </span>
                <span className="font-medium text-slate-700">
                  {new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Quick Add Button (Desktop) */}
              {showBudgetContext && (
                <button
                  onClick={() => setIsQuickAddOpen(true)}
                  className="hidden sm:flex items-center gap-2 btn btn-primary"
                >
                  <Plus className="w-4 h-4" />
                  <span>Aggiungi spesa</span>
                </button>
              )}

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  {user?.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name || 'User'}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                      <User className="w-4 h-4 text-slate-500" />
                    </div>
                  )}
                </button>

                {isUserMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {user?.name || 'Utente'}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                      </div>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        Esci
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 sm:px-6 lg:px-8 py-6 pb-24 sm:pb-6 md:flex-1 md:overflow-auto">
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
      {showBudgetContext && (
        <button
          onClick={() => setIsQuickAddOpen(true)}
          className="sm:hidden fixed bottom-20 right-4 z-50 w-14 h-14 bg-slate-900 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-slate-800 transition-colors"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Quick Add Modal */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        periodKey={periodKey}
      />
    </div>
  );
}
