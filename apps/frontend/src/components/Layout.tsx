import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  LineChart,
  Briefcase,
  Settings,
  Plus,
  Lock,
  ChevronDown,
  LogOut,
  User,
  UtensilsCrossed,
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
  const isFoodPage = location.pathname.startsWith('/food');
  const showBudgetContext = !isCashFlowPage && !isPortfolioPage && !isFoodPage;
  const appTitle = isCashFlowPage
    ? 'Net Worth'
    : isPortfolioPage
      ? 'Portafoglio'
      : isFoodPage
        ? 'Diario Alimentare'
        : 'Budget';

  const budgetRule = dashboard?.budgetRule || { needsPct: 65, wantsPct: 25, savingsPct: 10 };
  const isMonthClosed = dashboard?.monthPeriod?.isClosed ?? false;

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/expenses', icon: Receipt, label: 'Spese' },
    { to: '/cash-flow', icon: LineChart, label: 'Cash Flow' },
    { to: '/portfolio', icon: Briefcase, label: 'Portafoglio' },
    { to: '/food', icon: UtensilsCrossed, label: 'Diario' },
    { to: '/settings', icon: Settings, label: 'Impostazioni' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 md:h-screen md:overflow-hidden md:flex md:flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="px-3 sm:px-4 lg:px-6 xl:px-8 sm:ml-44 md:ml-48 lg:ml-52 2xl:ml-56">
          <div className="flex items-center justify-between h-14 xl:h-16">
            {/* Logo, Budget Rule & Period Selector */}
            <div className="flex items-center gap-3 xl:gap-4">
              <h1 className="text-lg xl:text-xl font-bold bg-gradient-to-r from-sky-500 via-blue-600 to-fuchsia-500 bg-clip-text text-transparent">
                {appTitle}
              </h1>
              {showBudgetContext && (
                <span className="text-lg xl:text-xl font-bold text-slate-900">
                  {budgetRule.needsPct}/{budgetRule.wantsPct}/{budgetRule.savingsPct}
                </span>
              )}

              {/* Period Selector */}
              {showBudgetContext && (
                <div className="relative">
                  <button
                    onClick={() => setIsPeriodSelectorOpen(!isPeriodSelectorOpen)}
                    className="flex items-center gap-2 px-2.5 xl:px-3 py-1.5 text-xs xl:text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
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
              <div className="text-xs xl:text-sm text-slate-500">
                <span className="hidden sm:inline">Oggi: </span>
                <span className="font-medium text-slate-700">
                  {new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 xl:gap-3">
              {/* Quick Add Button (Desktop) - disabled while the month is closed */}
              {showBudgetContext && (
                <button
                  onClick={() => setIsQuickAddOpen(true)}
                  disabled={isMonthClosed}
                  title={isMonthClosed ? 'Mese chiuso: sblocca il mese per aggiungere spese' : undefined}
                  className="hidden sm:flex items-center gap-2 btn btn-primary text-xs xl:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isMonthClosed ? <Lock className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
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
                      className="w-7 h-7 xl:w-8 xl:h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-7 h-7 xl:w-8 xl:h-8 rounded-full bg-slate-200 flex items-center justify-center">
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
      {/* No sidebar margin here: by repo convention every page offsets itself
          on its root wrapper (the sidebar is fixed) */}
      <main className="px-3 sm:px-4 lg:px-6 xl:px-8 py-4 lg:py-5 pb-24 sm:pb-6 md:flex-1 md:overflow-auto">
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

      {/* Desktop Navigation */}
      <nav className="hidden sm:flex fixed left-0 top-14 xl:top-16 bottom-0 sm:w-44 md:w-48 lg:w-52 2xl:w-56 flex-col bg-slate-50 border-r border-slate-200 px-2.5 lg:px-3 py-3 lg:py-4">
        <div className="px-2.5 lg:px-3 pb-3 lg:pb-4 border-b border-slate-200/80">
          <p className="text-2xl lg:text-[26px] leading-none font-bold text-slate-900">Q</p>
          <p className="mt-2 text-base lg:text-lg font-semibold text-slate-900 truncate">{user?.name || 'Utente'}</p>
        </div>
        <div className="mt-3 lg:mt-4 flex-1 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-2.5 rounded-xl px-2.5 lg:px-3 py-2 text-[13px] lg:text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-600 border border-blue-100'
                    : 'text-slate-500 hover:bg-white hover:text-slate-700'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn('w-4 h-4 lg:w-5 lg:h-5', isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600')} />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Floating Action Button (Mobile) - disabled while the month is closed */}
      {showBudgetContext && (
        <button
          onClick={() => setIsQuickAddOpen(true)}
          disabled={isMonthClosed}
          className="sm:hidden fixed bottom-20 right-4 z-50 w-14 h-14 bg-slate-900 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          {isMonthClosed ? <Lock className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
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
