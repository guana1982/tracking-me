import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Loader2, AlertCircle } from 'lucide-react';

export function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      return;
    }

    if (!token) {
      setError('Token non ricevuto');
      return;
    }

    // Decode JWT to get user info (basic decode, not validation)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));

      setAuth(
        {
          id: payload.sub || payload.id,
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
        },
        token
      );

      // Redirect to dashboard
      navigate('/dashboard', { replace: true });
    } catch (e) {
      console.error('Failed to decode token:', e);
      setError('Token non valido');
    }
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
