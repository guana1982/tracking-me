import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Loader2, AlertCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';
const AUTH_BASE = API_BASE.replace(/\/api\/?$/, '');

export function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(
        errorParam === 'auth_failed'
          ? 'Accesso con Google non riuscito. Riprova.'
          : errorParam
      );
      return;
    }

    if (!token) {
      setError('Token non ricevuto');
      return;
    }

    const completeAuth = async () => {
      try {
        const response = await fetch(`${AUTH_BASE}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Auth check failed: ${response.status}`);
        }

        const data = await response.json();
        if (!data.success || !data.data) {
          throw new Error('Missing user payload');
        }

        setAuth(data.data, token);
        // Root gate: desktop redirects to /dashboard, mobile shows the mode chooser
        navigate('/', { replace: true });
      } catch (e) {
        console.error('Failed to complete auth callback:', e);
        setError('Autenticazione non riuscita. Riprova.');
      }
    };

    completeAuth();
  }, [searchParams, setAuth, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-sm w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Errore di autenticazione</h1>
          <p className="text-slate-500 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="btn btn-primary"
          >
            Torna al login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      <p className="mt-4 text-slate-500">Accesso in corso...</p>
    </div>
  );
}
