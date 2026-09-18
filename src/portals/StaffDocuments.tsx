import React, { useEffect, useState } from 'react';
import { FileUp, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';

const STAFF_DOC_TYPES: { value: string; label: string }[] = [
  { value: 'degree', label: 'Título / Diploma' },
  { value: 'certification', label: 'Certificación / Curso' },
  { value: 'cv', label: 'Hoja de Vida (CV)' },
  { value: 'experience_letter', label: 'Carta de Experiencia Laboral' },
  { value: 'background_check', label: 'Certificado de Antecedentes' },
  { value: 'id_document', label: 'Cédula / Pasaporte' },
  { value: 'contract', label: 'Contrato Laboral' },
  { value: 'other', label: 'Otro' },
];

interface StaffDocument {
  id: string;
  doc_type: string;
  title: string;
  status: 'pending_review' | 'approved' | 'rejected';
  created_at: string;
}

interface Props {
  tenantId: string;
  profileId: string;
  reviewerId?: string;
}

function readFileName(file: File): string {
  return file.name;
}

export const StaffDocuments: React.FC<Props> = ({ tenantId, profileId, reviewerId }) => {
  const [documents, setDocuments] = useState<StaffDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedDocType, setSelectedDocType] = useState('degree');

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/staff-documents/${profileId}`);
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch {
      setMessage('❌ No se pudo cargar el expediente.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const handleUpload = async (fileName: string) => {
    setLoading(true);
    setMessage('');
    try {
      const docTypeLabel = STAFF_DOC_TYPES.find(d => d.value === selectedDocType)?.label || selectedDocType;
      // El archivo real se sube directo a Supabase Storage desde el cliente;
      // aquí solo registramos la referencia resultante en el expediente.
      const fakeFileUrl = `staff-documents/${tenantId}/${profileId}/${selectedDocType}_${fileName}`;

      const response = await fetch('/api/v1/staff-documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          profile_id: profileId,
          uploader_id: reviewerId || null,
          doc_type: selectedDocType,
          title: `${docTypeLabel} - ${fileName}`,
          file_url: fakeFileUrl,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage(`✅ "${docTypeLabel}" adjuntado al expediente.`);
        loadDocuments();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo subir el documento.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setLoading(false);
  };

  const handleReview = async (documentId: string, status: 'approved' | 'rejected') => {
    setMessage('');
    try {
      const response = await fetch('/api/v1/staff-documents/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: documentId, status, reviewer_id: reviewerId || null }),
      });
      const data = await response.json();
      if (data.success) {
        loadDocuments();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo actualizar el documento.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
  };

  const statusBadge = (status: StaffDocument['status']) => {
    if (status === 'approved') {
      return <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full"><CheckCircle2 className="w-3 h-3" /> Verificado</span>;
    }
    if (status === 'rejected') {
      return <span className="flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-100 px-2 py-1 rounded-full"><XCircle className="w-3 h-3" /> Rechazado</span>;
    }
    return <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full"><Clock className="w-3 h-3" /> Pendiente</span>;
  };

  return (
    <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-4">
      {message && <p className="text-xs font-semibold text-slate-600">{message}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedDocType}
          onChange={e => setSelectedDocType(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          {STAFF_DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <label className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 text-white rounded-md text-sm font-semibold cursor-pointer hover:bg-rose-700">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
          Adjuntar Documento
          <input
            type="file" className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleUpload(readFileName(file));
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {documents.length === 0 ? (
        <p className="text-sm text-slate-400">Aún no hay documentos en el expediente.</p>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => (
            <div key={doc.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-md px-3 py-2">
              <span className="text-sm font-medium text-slate-700">{doc.title}</span>
              <div className="flex items-center gap-2">
                {statusBadge(doc.status)}
                {doc.status === 'pending_review' && (
                  <>
                    <button onClick={() => handleReview(doc.id, 'approved')} className="text-xs font-bold text-emerald-600 hover:underline">Verificar</button>
                    <button onClick={() => handleReview(doc.id, 'rejected')} className="text-xs font-bold text-rose-600 hover:underline">Rechazar</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
