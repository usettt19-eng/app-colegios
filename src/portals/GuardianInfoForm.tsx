import React, { useEffect, useState } from 'react';
import { Camera, CheckCircle, Loader2, UserCircle2 } from 'lucide-react';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface Props {
  tenantId: string;
  profileId: string | null;
  label: string;
  onMessage: (msg: string) => void;
}

const emptyForm = {
  cedula: '', first_name: '', last_name: '', phone: '', office_phone: '', mobile_phone: '',
  nationality: '', email: '', confirm_email: '', profession: '', workplace: '', address: '',
};

export const GuardianInfoForm: React.FC<Props> = ({ tenantId, profileId, label, onMessage }) => {
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [notLinked, setNotLinked] = useState(false);

  useEffect(() => {
    if (!profileId) {
      setNotLinked(true);
      return;
    }
    setNotLinked(false);
    const load = async () => {
      try {
        const response = await fetch(`/api/v1/profiles/${profileId}`);
        const data = await response.json();
        const p = data.profile;
        if (p) {
          setPhoto(p.photo_url || null);
          setForm({
            cedula: p.cedula || '', first_name: p.first_name || '', last_name: p.last_name || '',
            phone: p.phone || '', office_phone: p.office_phone || '', mobile_phone: p.mobile_phone || '',
            nationality: p.nationality || '', email: p.email || '', confirm_email: p.email || '',
            profession: p.profession || '', workplace: p.workplace || '', address: p.address || '',
          });
        }
      } catch {
        onMessage('❌ No se pudo conectar con el servidor SIS.');
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const handleUploadPhoto = async (file: File | undefined) => {
    if (!file || !profileId) return;
    setPhotoLoading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const response = await fetch(`/api/v1/profiles/${profileId}/photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, photo_url: dataUrl }),
      });
      const data = await response.json();
      if (data.success) {
        setPhoto(data.profile?.photo_url || dataUrl);
        onMessage(`✅ Foto de ${label} actualizada.`);
      } else {
        onMessage('❌ ' + (data.error || 'No se pudo actualizar la foto.'));
      }
    } catch {
      onMessage('❌ Error al subir la foto.');
    }
    setPhotoLoading(false);
  };

  const handleSave = async () => {
    if (!profileId) return;
    if (form.email !== form.confirm_email) {
      onMessage('❌ El correo y su confirmación no coinciden.');
      return;
    }
    setLoading(true);
    try {
      const { confirm_email, ...payload } = form;
      const response = await fetch(`/api/v1/profiles/${profileId}/general-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.success) {
        onMessage(`✅ Información de ${label} actualizada.`);
      } else {
        onMessage('❌ ' + (data.error || 'No se pudo guardar la información.'));
      }
    } catch {
      onMessage('❌ Error de conexión.');
    }
    setLoading(false);
  };

  if (notLinked) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-400">
        Este alumno aún no tiene un/a {label.toLowerCase()} vinculado/a en su expediente.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-3 text-center max-w-xs mx-auto">
        <h2 className="font-bold text-slate-700 flex items-center justify-center"><UserCircle2 className="w-4 h-4 mr-2 text-purple-600" /> Foto ({label})</h2>
        <div className="w-28 h-28 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center mx-auto">
          {photo ? <img src={photo} alt={label} className="w-full h-full object-cover" /> : <Camera className="w-8 h-8 text-slate-300" />}
        </div>
        <label className="inline-flex items-center px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-md text-sm font-semibold cursor-pointer">
          {photoLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
          Actualizar Foto
          <input type="file" accept="image/*" className="hidden" disabled={photoLoading} onChange={e => handleUploadPhoto(e.target.files?.[0])} />
        </label>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-blue-600">
          <h2 className="font-bold text-white">Información General ({label})</h2>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {[
            ['cedula', 'Cédula'], ['first_name', 'Nombre'], ['last_name', 'Apellido'],
            ['phone', 'Teléfono'], ['office_phone', 'Tel. Oficina'], ['mobile_phone', 'Tel. Móvil'],
            ['nationality', 'Nacionalidad'],
          ].map(([key, labelText]) => (
            <div key={key}>
              <label className="block text-xs text-slate-500 mb-1">{labelText}</label>
              <input
                type="text" value={(form as any)[key]}
                onChange={e => setForm({ ...form, [key]: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Confirmar Email</label>
            <input type="email" value={form.confirm_email} onChange={e => setForm({ ...form, confirm_email: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Profesión</label>
            <input type="text" value={form.profession} onChange={e => setForm({ ...form, profession: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Lugar de Trabajo</label>
            <input type="text" value={form.workplace} onChange={e => setForm({ ...form, workplace: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Dirección</label>
            <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="px-6 pb-6">
          <button onClick={handleSave} disabled={loading} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold text-sm">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
            Guardar Información General
          </button>
        </div>
      </div>
    </div>
  );
};
