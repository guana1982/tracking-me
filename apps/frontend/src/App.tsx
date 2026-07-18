import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Dashboard } from './pages/Dashboard';
import { Expenses } from './pages/Expenses';
import { CashFlow } from './pages/CashFlow';
import { Portfolio } from './pages/Portfolio';
import { Settings } from './pages/Settings';
import { FoodDiary } from './pages/FoodDiary';
import { FoodTrends } from './pages/FoodTrends';
import { HomeGate } from './pages/MobileHome';
import { Login } from './pages/Login';
import { AuthCallback } from './pages/AuthCallback';

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Mobile: mode chooser; desktop: straight to the dashboard */}
        <Route index element={<HomeGate />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="cash-flow" element={<CashFlow />} />
        <Route path="portfolio" element={<Portfolio />} />
        <Route path="food" element={<FoodDiary />} />
        <Route path="food/trends" element={<FoodTrends />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
