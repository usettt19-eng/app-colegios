import React, { useState } from 'react';
import { GraduationCap, Loader2, LogIn, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const LoginPage: React.FC = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const result = await signIn(email, password);
    if (!result.success) setError(result.error || 'No se pudo iniciar sesión.');
    setSubmitting(false);
  };

  return (
    <div className="min-h-[600px] flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-slate-200 p-8 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-black text-slate-800">SIS & ERP Académico</h1>
          <p className="text-xs text-slate-500">Inicia sesión con tu cuenta</p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-sm flex items-start">
            <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Correo electrónico</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="padre.demo@colegiodemo.edu"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Contraseña</label>
            <input
              type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit" disabled={submitting}
            className="w-full flex items-center justify-center px-4 py-2.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 font-semibold text-sm"
          >
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
            Iniciar Sesión
          </button>
        </form>

        <p className="text-[11px] text-slate-400 text-center">
          Cuenta demo (padre): padre.demo@colegiodemo.edu / Demo1234!<br />
          Cuenta demo (super admin): superadmin.demo@plataforma.edu / Demo1234!
        </p>
      </div>
    </div>
  );
};
