import React, { useEffect, useState } from 'react';
import { ShieldCheck, Building2, Plus, Loader2, CheckCircle, UserPlus, School } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LoginPage } from './LoginPage';

interface Tenant {
  id: string;
  name: string;
  domain: string | null;
  subscription_plan: string;
  default_language: string;
  created_at?: string;
}

const SuperAdminPortalInner: React.FC = () => {
  const { session, signOut } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);

  const [tenantForm, setTenantForm] = useState({ name: '', domain: '', subscription_plan: 'basic', default_language: 'es' });
  const [adminTenantId, setAdminTenantId] = useState('');
  const [adminForm, setAdminForm] = useState({ first_name: '', last_name: '', email: '', password: '' });

  const authHeaders = () => ({ Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' });

  const loadTenants = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/tenants', { headers: authHeaders() });
      const data = await response.json();
      if (data.success) {
        setTenants(data.tenants || []);
      } else {
        setMessage('❌ ' + (data.error || 'No se pudieron cargar los colegios.'));
      }
    } catch {
      setMessage('❌ No se pudo conectar con el servidor SIS.');
    }
    setLoading(false);
  };

  useEffect(() => { loadTenants(); }, []);

  const handleCreateTenant = async () => {
    if (!tenantForm.name) {
      setMessage('❌ El nombre del colegio es requerido.');
      return;
    }
    setCreating(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/tenants', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(tenantForm),
      });
      const data = await response.json();
      if (data.success) {
        setMessage(`✅ Colegio "${data.tenant.name}" registrado en la plataforma.`);
        setTenantForm({ name: '', domain: '', subscription_plan: 'basic', default_language: 'es' });
        loadTenants();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo crear el colegio.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setCreating(false);
  };

  const handleCreateAdmin = async () => {
    if (!adminTenantId || !adminForm.first_name || !adminForm.last_name || !adminForm.email || !adminForm.password) {
      setMessage('❌ Selecciona el colegio y completa todos los campos del administrador.');
      return;
    }
    setCreating(true);
    setMessage('');
    try {
      const response = await fetch(`/api/v1/tenants/${adminTenantId}/admins`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(adminForm),
      });
      const data = await response.json();
      if (data.success) {
        setMessage(`✅ Administrador ${data.profile.first_name} ${data.profile.last_name} creado para el colegio.`);
        setAdminForm({ first_name: '', last_name: '', email: '', password: '' });
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo crear el administrador.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setCreating(false);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-slate-800">
      <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-800 rounded-lg text-white">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">Super Administración de la Plataforma</h1>
            <p className="text-sm text-slate-500">Alta de colegios (tenants) y sus administradores</p>
          </div>
        </div>
        <button onClick={signOut} className="px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-md border border-slate-200">
          Cerrar Sesión
        </button>
      </div>

      {message && (
        <div className="bg-indigo-50 text-indigo-700 p-4 rounded-lg flex items-start border border-indigo-200 break-all">
          <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
          <span className="font-medium text-sm">{message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="font-bold text-slate-700 flex items-center"><Building2 className="w-4 h-4 mr-2 text-slate-700" /> Registrar Nuevo Colegio</h2>
          <input
            type="text" placeholder="Nombre del colegio" value={tenantForm.name}
            onChange={e => setTenantForm({ ...tenantForm, name: e.target.value })}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
          <input
            type="text" placeholder="Dominio (opcional, ej. colegio.edu)" value={tenantForm.domain}
            onChange={e => setTenantForm({ ...tenantForm, domain: e.target.value })}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={tenantForm.subscription_plan}
              onChange={e => setTenantForm({ ...tenantForm, subscription_plan: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <option value="basic">Plan Básico</option>
              <option value="pro">Plan Pro</option>
              <option value="enterprise">Plan Enterprise</option>
            </select>
            <select
              value={tenantForm.default_language}
              onChange={e => setTenantForm({ ...tenantForm, default_language: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <option value="es">Español</option>
              <option value="en">Inglés</option>
            </select>
          </div>
          <button
            onClick={handleCreateTenant}
            disabled={creating}
            className="flex items-center px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-900 disabled:opacity-50 font-semibold text-sm"
          >
            {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Registrar Colegio
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="font-bold text-slate-700 flex items-center"><UserPlus className="w-4 h-4 mr-2 text-slate-700" /> Crear Administrador de Colegio</h2>
          <select
            value={adminTenantId}
            onChange={e => setAdminTenantId(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <option value="">Selecciona el colegio</option>
            {tenants.filter(t => t.id !== '00000000-0000-0000-0000-000000000001').map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text" placeholder="Nombre" value={adminForm.first_name}
              onChange={e => setAdminForm({ ...adminForm, first_name: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
            <input
              type="text" placeholder="Apellido" value={adminForm.last_name}
              onChange={e => setAdminForm({ ...adminForm, last_name: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <input
            type="email" placeholder="Correo electrónico" value={adminForm.email}
            onChange={e => setAdminForm({ ...adminForm, email: e.target.value })}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
          <input
            type="password" placeholder="Contraseña temporal" value={adminForm.password}
            onChange={e => setAdminForm({ ...adminForm, password: e.target.value })}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
          <button
            onClick={handleCreateAdmin}
            disabled={creating}
            className="flex items-center px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-900 disabled:opacity-50 font-semibold text-sm"
          >
            {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
            Crear Administrador
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center">
          <School className="w-4 h-4 mr-2 text-slate-700" />
          <h2 className="font-bold text-slate-700">Colegios en la Plataforma</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Cargando colegios...
          </div>
        ) : tenants.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Aún no hay colegios registrados.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 font-semibold">COLEGIO</th>
                <th className="px-4 py-3 font-semibold">DOMINIO</th>
                <th className="px-4 py-3 font-semibold">PLAN</th>
                <th className="px-4 py-3 font-semibold">IDIOMA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenants.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold">{t.name}</td>
                  <td className="px-4 py-3 text-slate-500">{t.domain || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 capitalize">{t.subscription_plan}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 uppercase">{t.default_language}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export const SuperAdminPortal: React.FC = () => {
  const { session, profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-6 h-6 mr-2 animate-spin" /> Verificando sesión...
      </div>
    );
  }

  if (!session || !profile) return <LoginPage />;

  if (profile.role !== 'super_admin') {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-sm text-amber-800">
          Esta cuenta ({profile.email}) no tiene el rol de super_admin, así que no puede acceder a la administración de la plataforma.
        </div>
        <button onClick={signOut} className="mt-4 px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-md border border-slate-200">
          Cerrar Sesión
        </button>
      </div>
    );
  }

  return <SuperAdminPortalInner />;
};
