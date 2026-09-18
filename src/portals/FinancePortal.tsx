import React, { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Wallet, Loader2, Plus, FileUp, CalendarClock, CheckCircle2, Landmark, Repeat, Building2, Upload, AlertTriangle } from 'lucide-react';

// Parser de CSV simple (mismo patrón que BulkImport.tsx): separador coma,
// soporta campos entre comillas con comas internas.
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { cells.push(current.trim()); current = ''; }
      else current += char;
    }
    cells.push(current.trim());
    return cells;
  };
  const headers = parseLine(lines[0]).map(h => h.toLowerCase().trim());
  return lines.slice(1).map(line => {
    const cells = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] || ''; });
    return row;
  });
}

// Contexto de demostración: en producción tenant_id / profile_id vienen del token JWT de Supabase Auth (Fase 2)
const DEMO_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const DEMO_ACTOR_ID = '66666666-6666-6666-6666-666666666666';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

// Periodo actual en formato "YYYY-MM", igual al que usa Colecturía para las facturas de alumnos
function currentBillingPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

interface CashflowTotals {
  total_received?: number;
  total_pending?: number;
  total_paid?: number;
}

interface Transaction {
  type: 'income' | 'staff_expense' | 'vendor_expense';
  description: string;
  amount: number;
  date: string;
}

interface Cashflow {
  income: CashflowTotals;
  staffExpenses: CashflowTotals;
  vendorExpenses: CashflowTotals;
  recentTransactions: Transaction[];
}

interface Vendor {
  id: string;
  name: string;
  service_type: string | null;
}

interface PurchaseOrder {
  id: string;
  subtotal: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  total_cost: number;
  status: string;
  quote_title: string | null;
  quote_file_url: string | null;
  quote_download_url?: string | null;
  scheduled_payment_date: string | null;
  recurring_expense_id: string | null;
  billing_period: string | null;
  vendors?: { name: string; service_type: string | null };
  profiles?: { first_name: string; last_name: string } | null;
}

interface RecurringExpense {
  id: string;
  concept: string;
  estimated_amount: number;
  due_day: number;
  tax_rate: number;
  is_active: boolean;
  vendors?: { name: string; service_type: string | null };
}

interface TaxSummary {
  year: number;
  totalSubtotal: number;
  totalTax: number;
}

interface Department {
  id: string;
  name: string;
}

interface DepartmentBudgetStatus {
  department_id: string;
  department_name: string | null;
  year: number;
  budget_amount: number;
  spent: number;
  remaining: number;
  over_budget: boolean;
}

interface ReconciliationRow {
  date: string;
  amount: number;
  reference: string;
  description?: string;
  invoice_number?: string;
  invoice_amount?: number;
  reason?: string;
}

interface ReconciliationResult {
  matched: ReconciliationRow[];
  mismatched: ReconciliationRow[];
  unmatched: ReconciliationRow[];
  alreadyReconciled: ReconciliationRow[];
}

type TabId = 'flujo' | 'cotizaciones' | 'programar' | 'presupuestos' | 'conciliacion';

const TX_LABEL: Record<Transaction['type'], string> = {
  income: 'Ingreso (alumno)',
  staff_expense: 'Egreso (nómina)',
  vendor_expense: 'Egreso (proveedor)',
};

export const FinancePortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('flujo');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // --- Flujo Financiero ---
  const [cashflow, setCashflow] = useState<Cashflow | null>(null);
  const [cashflowLoading, setCashflowLoading] = useState(false);

  // --- Cotizaciones y Compras ---
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [poForm, setPoForm] = useState({ vendor_id: '', department_id: '', subtotal: '', tax_rate: '7', quote_title: '' });
  const [quoteFile, setQuoteFile] = useState<File | null>(null);

  // --- Presupuesto Anual por Departamento ---
  const [departments, setDepartments] = useState<Department[]>([]);
  const [budgetStatus, setBudgetStatus] = useState<DepartmentBudgetStatus[]>([]);
  const [budgetForm, setBudgetForm] = useState({ department_id: '', year: String(new Date().getFullYear()), amount: '', notes: '' });
  const [budgetLoading, setBudgetLoading] = useState(false);

  // --- Conciliación Bancaria ---
  const [bankRows, setBankRows] = useState<Record<string, string>[]>([]);
  const [reconciling, setReconciling] = useState(false);
  const [reconciliationResult, setReconciliationResult] = useState<ReconciliationResult | null>(null);

  // --- Gastos Recurrentes Mensuales (energía, agua, internet...) ---
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [recurringForm, setRecurringForm] = useState({ vendor_id: '', concept: '', estimated_amount: '', due_day: '5', tax_rate: '7' });
  const [generateAmountByRE, setGenerateAmountByRE] = useState<Record<string, string>>({});

  // --- Resumen de Impuestos (para declaraciones) ---
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null);

  // --- Programar Pagos ---
  const [scheduleDateByPO, setScheduleDateByPO] = useState<Record<string, string>>({});

  const loadCashflow = async () => {
    setCashflowLoading(true);
    try {
      const [cashflowRes, taxRes] = await Promise.all([
        fetch(`/api/v1/finance/cashflow?tenant_id=${DEMO_TENANT_ID}`),
        fetch(`/api/v1/finance/tax-summary?tenant_id=${DEMO_TENANT_ID}`),
      ]);
      const cashflowData = await cashflowRes.json();
      const taxData = await taxRes.json();
      setCashflow(cashflowData.cashflow || null);
      setTaxSummary(taxData.taxSummary || null);
    } catch {
      setMessage('❌ No se pudo conectar con el servidor SIS.');
    }
    setCashflowLoading(false);
  };

  const loadProcurement = async () => {
    try {
      const [vendorsRes, poRes, recurringRes, deptRes] = await Promise.all([
        fetch(`/api/v1/corporate/vendors?tenant_id=${DEMO_TENANT_ID}`),
        fetch(`/api/v1/corporate/purchase-orders?tenant_id=${DEMO_TENANT_ID}`),
        fetch(`/api/v1/corporate/recurring-expenses?tenant_id=${DEMO_TENANT_ID}`),
        fetch(`/api/v1/hierarchy/departments?tenant_id=${DEMO_TENANT_ID}`),
      ]);
      const vendorsData = await vendorsRes.json();
      const poData = await poRes.json();
      const recurringData = await recurringRes.json();
      const deptData = await deptRes.json();
      setVendors(vendorsData.vendors || []);
      setPurchaseOrders(poData.purchaseOrders || []);
      setRecurringExpenses(recurringData.recurringExpenses || []);
      setDepartments(deptData.departments || []);
    } catch {
      setMessage('❌ No se pudo conectar con el servidor SIS.');
    }
  };

  const loadBudgetStatus = async () => {
    setBudgetLoading(true);
    try {
      const [deptRes, statusRes] = await Promise.all([
        fetch(`/api/v1/hierarchy/departments?tenant_id=${DEMO_TENANT_ID}`),
        fetch(`/api/v1/corporate/department-budgets/status?tenant_id=${DEMO_TENANT_ID}&year=${budgetForm.year}`),
      ]);
      const deptData = await deptRes.json();
      const statusData = await statusRes.json();
      setDepartments(deptData.departments || []);
      setBudgetStatus(statusData.status || []);
    } catch {
      setMessage('❌ No se pudo conectar con el servidor SIS.');
    }
    setBudgetLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'flujo') loadCashflow();
    if (activeTab === 'cotizaciones' || activeTab === 'programar') loadProcurement();
    if (activeTab === 'presupuestos') loadBudgetStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleCreateRecurringExpense = async () => {
    if (!recurringForm.vendor_id || !recurringForm.concept || !recurringForm.estimated_amount) {
      setMessage('❌ Selecciona el proveedor, el concepto y el monto estimado.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/corporate/recurring-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          vendor_id: recurringForm.vendor_id,
          concept: recurringForm.concept,
          estimated_amount: Number(recurringForm.estimated_amount),
          due_day: Number(recurringForm.due_day),
          tax_rate: Number(recurringForm.tax_rate || 0),
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Gasto recurrente configurado.');
        setRecurringForm({ vendor_id: '', concept: '', estimated_amount: '', due_day: '5', tax_rate: '7' });
        loadProcurement();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo configurar el gasto recurrente.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setLoading(false);
  };

  const handleGenerateRecurringCharge = async (re: RecurringExpense) => {
    setMessage('');
    try {
      const amount = generateAmountByRE[re.id];
      const response = await fetch(`/api/v1/corporate/recurring-expenses/${re.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          billing_period: currentBillingPeriod(),
          amount: amount ? Number(amount) : undefined,
          requested_by: DEMO_ACTOR_ID,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage(`✅ Cargo de "${re.concept}" generado para ${currentBillingPeriod()}, pendiente de aprobación.`);
        loadProcurement();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo generar el cargo.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
  };

  const handleCreateBudget = async () => {
    if (!budgetForm.department_id || !budgetForm.year || !budgetForm.amount) {
      setMessage('❌ Selecciona el departamento, el año y el monto.');
      return;
    }
    setBudgetLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/corporate/department-budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          department_id: budgetForm.department_id,
          year: Number(budgetForm.year),
          amount: Number(budgetForm.amount),
          notes: budgetForm.notes || null,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Presupuesto asignado.');
        setBudgetForm({ ...budgetForm, department_id: '', amount: '', notes: '' });
        loadBudgetStatus();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo asignar el presupuesto.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setBudgetLoading(false);
  };

  const handleUploadBankStatement = async (file: File | undefined) => {
    if (!file) return;
    setMessage('');
    const reader = new FileReader();
    reader.onload = async () => {
      const rows = parseCsv(String(reader.result || ''));
      setBankRows(rows);
      setReconciling(true);
      setReconciliationResult(null);
      try {
        const response = await fetch('/api/v1/finance/bank-reconciliation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: DEMO_TENANT_ID,
            rows: rows.map(r => ({ date: r.fecha, amount: Number(r.monto), reference: r.referencia, description: r.descripcion })),
          }),
        });
        const data = await response.json();
        if (data.success) {
          setReconciliationResult({ matched: data.matched, mismatched: data.mismatched, unmatched: data.unmatched, alreadyReconciled: data.alreadyReconciled });
          setMessage(`✅ Conciliación procesada: ${data.matched.length} pagos conciliados automáticamente.`);
        } else {
          setMessage('❌ ' + (data.error || 'No se pudo procesar el extracto.'));
        }
      } catch {
        setMessage('❌ Error de conexión.');
      }
      setReconciling(false);
    };
    reader.readAsText(file);
  };

  const handleCreateQuote = async () => {
    if (!poForm.vendor_id || !poForm.subtotal || !quoteFile) {
      setMessage('❌ Selecciona el proveedor, el subtotal y adjunta la cotización.');
      return;
    }
    if (quoteFile.size > 10 * 1024 * 1024) {
      setMessage('❌ El archivo supera el máximo permitido (10MB).');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const fileData = await readFileAsDataUrl(quoteFile);
      const response = await fetch('/api/v1/corporate/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          vendor_id: poForm.vendor_id,
          department_id: poForm.department_id || null,
          requested_by: DEMO_ACTOR_ID,
          subtotal: Number(poForm.subtotal),
          tax_rate: Number(poForm.tax_rate || 0),
          quote_title: poForm.quote_title || null,
          quote_file_data: fileData,
          quote_file_name: quoteFile.name,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage(data.budgetWarning ? `✅ Cotización subida, pendiente de aprobación. ⚠️ ${data.budgetWarning}` : '✅ Cotización subida, pendiente de aprobación.');
        setPoForm({ vendor_id: '', department_id: '', subtotal: '', tax_rate: '7', quote_title: '' });
        setQuoteFile(null);
        loadProcurement();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo registrar la cotización.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setLoading(false);
  };

  const handleApprove = async (id: string, status: 'approved' | 'cancelled') => {
    setMessage('');
    try {
      const response = await fetch(`/api/v1/corporate/purchase-orders/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, approved_by: DEMO_ACTOR_ID }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ ' + data.message);
        loadProcurement();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo actualizar la cotización.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
  };

  const handleSchedule = async (id: string) => {
    const date = scheduleDateByPO[id];
    if (!date) {
      setMessage('❌ Elige una fecha para programar el pago.');
      return;
    }
    setMessage('');
    try {
      const response = await fetch(`/api/v1/corporate/purchase-orders/${id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_payment_date: date, scheduled_by: DEMO_ACTOR_ID }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Pago programado, pendiente de aprobación final.');
        loadProcurement();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo programar el pago.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
  };

  const handleConfirmPayment = async (id: string) => {
    setMessage('');
    try {
      const response = await fetch(`/api/v1/corporate/purchase-orders/${id}/confirm-payment`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Pago confirmado.');
        loadProcurement();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo confirmar el pago.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
  };

  const money = (n: number | undefined) => `$${(n || 0).toFixed(2)}`;

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending_approval: 'bg-amber-100 text-amber-700',
      approved: 'bg-blue-100 text-blue-700',
      scheduled: 'bg-indigo-100 text-indigo-700',
      paid: 'bg-emerald-100 text-emerald-700',
      cancelled: 'bg-rose-100 text-rose-700',
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-bold ${styles[status] || 'bg-slate-100 text-slate-600'}`}>{status}</span>;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-slate-800">
      <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-green-100 rounded-lg text-green-700">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">Portal de Finanzas</h1>
            <p className="text-sm text-slate-500">Flujo financiero, cotizaciones y programación de pagos</p>
          </div>
        </div>
      </div>

      {message && (
        <div className="bg-green-50 text-green-800 p-4 rounded-lg flex items-center border border-green-200">
          <CheckCircle2 className="w-5 h-5 mr-2 flex-shrink-0" />
          <span className="font-medium text-sm">{message}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('flujo')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'flujo' ? 'bg-green-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Wallet className="w-4 h-4 mr-2" /> Flujo Financiero
        </button>
        <button
          onClick={() => setActiveTab('cotizaciones')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'cotizaciones' ? 'bg-green-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <FileUp className="w-4 h-4 mr-2" /> Cotizaciones y Compras
        </button>
        <button
          onClick={() => setActiveTab('programar')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'programar' ? 'bg-green-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <CalendarClock className="w-4 h-4 mr-2" /> Programar Pagos
        </button>
        <button
          onClick={() => setActiveTab('presupuestos')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'presupuestos' ? 'bg-green-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Building2 className="w-4 h-4 mr-2" /> Presupuesto por Departamento
        </button>
        <button
          onClick={() => setActiveTab('conciliacion')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'conciliacion' ? 'bg-green-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Landmark className="w-4 h-4 mr-2" /> Conciliación Bancaria
        </button>
      </div>

      {/* Flujo Financiero */}
      {activeTab === 'flujo' && (
        cashflowLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-6 h-6 mr-2 animate-spin" /> Cargando flujo financiero...
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center text-emerald-600 mb-2"><TrendingUp className="w-4 h-4 mr-2" /><span className="text-xs font-bold uppercase">Ingresos (alumnos)</span></div>
                <p className="text-2xl font-black text-slate-800">{money(cashflow?.income.total_received)}</p>
                <p className="text-xs text-slate-400 mt-1">Pendiente por cobrar: {money(cashflow?.income.total_pending)}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center text-rose-600 mb-2"><TrendingDown className="w-4 h-4 mr-2" /><span className="text-xs font-bold uppercase">Egresos a Staff (nómina)</span></div>
                <p className="text-2xl font-black text-slate-800">{money(cashflow?.staffExpenses.total_paid)}</p>
                <p className="text-xs text-slate-400 mt-1">Pendiente por pagar: {money(cashflow?.staffExpenses.total_pending)}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center text-rose-600 mb-2"><TrendingDown className="w-4 h-4 mr-2" /><span className="text-xs font-bold uppercase">Egresos a Proveedores</span></div>
                <p className="text-2xl font-black text-slate-800">{money(cashflow?.vendorExpenses.total_paid)}</p>
                <p className="text-xs text-slate-400 mt-1">Pendiente por pagar: {money(cashflow?.vendorExpenses.total_pending)}</p>
              </div>
            </div>

            {taxSummary && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center text-indigo-600 mb-2"><Landmark className="w-4 h-4 mr-2" /><span className="text-xs font-bold uppercase">Impuestos Pagados a Proveedores ({taxSummary.year})</span></div>
                <p className="text-2xl font-black text-slate-800">{money(taxSummary.totalTax)}</p>
                <p className="text-xs text-slate-400 mt-1">Sobre un subtotal de {money(taxSummary.totalSubtotal)} — para reportar/deducir en declaraciones fiscales.</p>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center">
                <DollarSign className="w-4 h-4 mr-2 text-green-600" />
                <h2 className="font-bold text-slate-700">Movimientos Recientes</h2>
              </div>
              {!cashflow || cashflow.recentTransactions.length === 0 ? (
                <p className="p-6 text-sm text-slate-400">Aún no hay movimientos registrados.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3 font-semibold">TIPO</th>
                      <th className="px-4 py-3 font-semibold">DESCRIPCIÓN</th>
                      <th className="px-4 py-3 font-semibold text-right">MONTO</th>
                      <th className="px-4 py-3 font-semibold">FECHA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cashflow.recentTransactions.map((tx, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{TX_LABEL[tx.type]}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{tx.description}</td>
                        <td className={`px-4 py-3 text-right font-mono font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.type === 'income' ? '+' : '-'}{money(tx.amount)}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{tx.date ? new Date(tx.date).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )
      )}

      {/* Cotizaciones y Compras */}
      {activeTab === 'cotizaciones' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="font-bold text-slate-700 flex items-center"><Repeat className="w-4 h-4 mr-2 text-green-600" /> Gastos Recurrentes Mensuales</h2>
            <p className="text-sm text-slate-500">
              Para gastos fijos como energía, agua o internet no hace falta subir una cotización cada mes: configúralos una vez y genera el cargo del periodo con un clic (puedes ajustar el monto si la factura real varió).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <select
                value={recurringForm.vendor_id}
                onChange={e => setRecurringForm({ ...recurringForm, vendor_id: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Proveedor</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <input
                type="text" placeholder="Concepto (ej. Energía eléctrica)" value={recurringForm.concept}
                onChange={e => setRecurringForm({ ...recurringForm, concept: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                type="number" placeholder="Monto estimado (antes de impuesto)" value={recurringForm.estimated_amount}
                onChange={e => setRecurringForm({ ...recurringForm, estimated_amount: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                type="number" placeholder="Día de pago" value={recurringForm.due_day} min={1} max={28}
                onChange={e => setRecurringForm({ ...recurringForm, due_day: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                type="number" placeholder="% Impuesto (ej. ITBMS 7%)" value={recurringForm.tax_rate}
                onChange={e => setRecurringForm({ ...recurringForm, tax_rate: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              onClick={handleCreateRecurringExpense}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-slate-700 text-white rounded-md hover:bg-slate-800 disabled:opacity-50 font-semibold"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Configurar Gasto Recurrente
            </button>

            {recurringExpenses.filter(re => re.is_active).length === 0 ? (
              <p className="text-sm text-slate-400">Aún no hay gastos recurrentes configurados.</p>
            ) : (
              <div className="divide-y divide-slate-100 border-t border-slate-100 pt-2">
                {recurringExpenses.filter(re => re.is_active).map(re => {
                  const alreadyGenerated = purchaseOrders.some(po => po.recurring_expense_id === re.id && po.billing_period === currentBillingPeriod());
                  return (
                    <div key={re.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-700">{re.concept}</p>
                        <p className="text-xs text-slate-400">{re.vendors?.name} — estimado ${Number(re.estimated_amount).toFixed(2)} + {re.tax_rate}% imp. — día {re.due_day}</p>
                      </div>
                      {alreadyGenerated ? (
                        <span className="text-xs font-bold text-emerald-600">✓ Ya generado para {currentBillingPeriod()}</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="number" placeholder={String(re.estimated_amount)}
                            value={generateAmountByRE[re.id] ?? ''}
                            onChange={e => setGenerateAmountByRE({ ...generateAmountByRE, [re.id]: e.target.value })}
                            className="w-28 border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <button
                            onClick={() => handleGenerateRecurringCharge(re)}
                            className="text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded"
                          >
                            Generar cargo de {currentBillingPeriod()}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="font-bold text-slate-700 flex items-center"><FileUp className="w-4 h-4 mr-2 text-green-600" /> Subir Cotización</h2>
            <p className="text-sm text-slate-500">
              Los responsables de compras y contrataciones de servicios suben aquí la cotización del proveedor para que sea aprobada.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={poForm.vendor_id}
                onChange={e => setPoForm({ ...poForm, vendor_id: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Selecciona el proveedor</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}{v.service_type ? ` (${v.service_type})` : ''}</option>)}
              </select>
              <input
                type="text" placeholder="Concepto (ej. Mantenimiento AC)" value={poForm.quote_title}
                onChange={e => setPoForm({ ...poForm, quote_title: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <select
              value={poForm.department_id}
              onChange={e => setPoForm({ ...poForm, department_id: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Departamento (opcional, para control de presupuesto)</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="number" placeholder="Subtotal (antes de impuesto)" value={poForm.subtotal}
                onChange={e => setPoForm({ ...poForm, subtotal: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                type="number" placeholder="% Impuesto (ej. ITBMS 7%)" value={poForm.tax_rate}
                onChange={e => setPoForm({ ...poForm, tax_rate: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <div className="flex items-center px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold text-slate-700">
                Total: ${(Number(poForm.subtotal || 0) * (1 + Number(poForm.tax_rate || 0) / 100)).toFixed(2)}
              </div>
            </div>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg py-4 cursor-pointer hover:border-green-400 hover:bg-green-50">
              <FileUp className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-500">{quoteFile?.name || 'Selecciona el archivo de la cotización'}</span>
              <input
                type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setQuoteFile(f); }}
              />
            </label>
            <button
              onClick={handleCreateQuote}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-semibold"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Subir Cotización
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-bold text-slate-700">Cotizaciones Pendientes de Aprobación</h2>
            </div>
            {purchaseOrders.filter(po => po.status === 'pending_approval').length === 0 ? (
              <p className="p-6 text-sm text-slate-400">No hay cotizaciones pendientes.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {purchaseOrders.filter(po => po.status === 'pending_approval').map(po => (
                  <div key={po.id} className="p-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-700">{po.quote_title || po.vendors?.name || 'Cotización'}</p>
                      <p className="text-xs text-slate-400">
                        {po.vendors?.name} — subtotal ${Number(po.subtotal ?? po.total_cost).toFixed(2)}
                        {!!po.tax_amount && ` + impuesto $${Number(po.tax_amount).toFixed(2)}`} = ${Number(po.total_cost).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {po.quote_download_url && (
                        <a href={po.quote_download_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-slate-500 hover:text-slate-700">Ver cotización</a>
                      )}
                      {statusBadge(po.status)}
                      <button onClick={() => handleApprove(po.id, 'approved')} className="text-xs font-bold text-emerald-600 hover:underline">Aprobar</button>
                      <button onClick={() => handleApprove(po.id, 'cancelled')} className="text-xs font-bold text-rose-600 hover:underline">Rechazar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-bold text-slate-700">Historial de Órdenes de Compra</h2>
            </div>
            {purchaseOrders.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">Aún no hay órdenes de compra registradas.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 font-semibold">PROVEEDOR</th>
                    <th className="px-4 py-3 font-semibold text-right">SUBTOTAL</th>
                    <th className="px-4 py-3 font-semibold text-right">IMPUESTO</th>
                    <th className="px-4 py-3 font-semibold text-right">TOTAL</th>
                    <th className="px-4 py-3 font-semibold">ESTADO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchaseOrders.map(po => (
                    <tr key={po.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold">{po.vendors?.name || '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-500">${Number(po.subtotal ?? po.total_cost).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-500">${Number(po.tax_amount || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">${Number(po.total_cost).toFixed(2)}</td>
                      <td className="px-4 py-3">{statusBadge(po.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Programar Pagos */}
      {activeTab === 'programar' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-bold text-slate-700">Aprobadas — Programar Fecha de Pago</h2>
              <p className="text-xs text-slate-500 mt-1">Contabilidad define cuándo se pagará cada orden ya aprobada.</p>
            </div>
            {purchaseOrders.filter(po => po.status === 'approved').length === 0 ? (
              <p className="p-6 text-sm text-slate-400">No hay órdenes aprobadas esperando programación.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {purchaseOrders.filter(po => po.status === 'approved').map(po => (
                  <div key={po.id} className="p-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-700">{po.quote_title || po.vendors?.name}</p>
                      <p className="text-xs text-slate-400">{po.vendors?.name} — ${Number(po.total_cost).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={scheduleDateByPO[po.id] || ''}
                        onChange={e => setScheduleDateByPO({ ...scheduleDateByPO, [po.id]: e.target.value })}
                        className="border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <button onClick={() => handleSchedule(po.id)} className="text-xs font-bold text-indigo-600 hover:underline">Programar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-bold text-slate-700">Programadas — Aprobación Final del Pago</h2>
              <p className="text-xs text-slate-500 mt-1">Confirma la ejecución del pago ya programado por contabilidad.</p>
            </div>
            {purchaseOrders.filter(po => po.status === 'scheduled').length === 0 ? (
              <p className="p-6 text-sm text-slate-400">No hay pagos programados esperando aprobación final.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {purchaseOrders.filter(po => po.status === 'scheduled').map(po => (
                  <div key={po.id} className="p-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-700">{po.quote_title || po.vendors?.name}</p>
                      <p className="text-xs text-slate-400">
                        {po.vendors?.name} — ${Number(po.total_cost).toFixed(2)} — programado para {po.scheduled_payment_date ? new Date(po.scheduled_payment_date).toLocaleDateString() : '—'}
                      </p>
                    </div>
                    <button onClick={() => handleConfirmPayment(po.id)} className="flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded hover:bg-emerald-100">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aprobar y Confirmar Pago
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Presupuesto Anual por Departamento */}
      {activeTab === 'presupuestos' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="font-bold text-slate-700 flex items-center"><Building2 className="w-4 h-4 mr-2 text-green-600" /> Asignar Presupuesto Anual</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <select
                value={budgetForm.department_id}
                onChange={e => setBudgetForm({ ...budgetForm, department_id: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Departamento...</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <input
                type="number" placeholder="Año" value={budgetForm.year}
                onChange={e => setBudgetForm({ ...budgetForm, year: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                type="number" placeholder="Presupuesto (USD)" value={budgetForm.amount}
                onChange={e => setBudgetForm({ ...budgetForm, amount: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                type="text" placeholder="Notas (opcional)" value={budgetForm.notes}
                onChange={e => setBudgetForm({ ...budgetForm, notes: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              onClick={handleCreateBudget}
              disabled={budgetLoading}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-semibold text-sm"
            >
              {budgetLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Asignar Presupuesto
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <h2 className="font-bold text-slate-700">Estado del Presupuesto {budgetForm.year}</h2>
            </div>
            {budgetLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Cargando...
              </div>
            ) : budgetStatus.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">Sin presupuestos asignados para {budgetForm.year}.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {budgetStatus.map(b => (
                  <div key={b.department_id} className="p-4 flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-semibold text-slate-700 text-sm flex items-center">
                        {b.department_name}
                        {b.over_budget && <AlertTriangle className="w-3.5 h-3.5 ml-1.5 text-rose-500" />}
                      </p>
                      <p className="text-xs text-slate-400">
                        Gastado: ${b.spent.toFixed(2)} de ${b.budget_amount.toFixed(2)} asignados ({b.remaining >= 0 ? `$${b.remaining.toFixed(2)} restante` : `$${Math.abs(b.remaining).toFixed(2)} sobre presupuesto`})
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${b.over_budget ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {b.over_budget ? 'Sobre presupuesto' : 'Dentro de presupuesto'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conciliación Bancaria */}
      {activeTab === 'conciliacion' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="font-bold text-slate-700 flex items-center"><Landmark className="w-4 h-4 mr-2 text-green-600" /> Subir Extracto Bancario</h2>
            <p className="text-sm text-slate-500">
              CSV con columnas <code className="bg-slate-100 px-1 rounded">fecha, monto, referencia, descripcion</code>. La <strong>referencia</strong> debe ser el número de factura
              (lo que el padre pone al transferir) — así se hace match automático y se marca la factura como pagada. Si no coincide o el monto es distinto, queda para revisión manual.
            </p>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg py-6 cursor-pointer hover:border-green-400 hover:bg-green-50">
              <Upload className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-500">{bankRows.length > 0 ? `${bankRows.length} filas cargadas` : 'Selecciona el archivo CSV del extracto'}</span>
              <input
                type="file" accept=".csv" className="hidden"
                onChange={e => handleUploadBankStatement(e.target.files?.[0])}
              />
            </label>
            {reconciling && (
              <div className="flex items-center justify-center py-6 text-slate-400">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Procesando conciliación...
              </div>
            )}
          </div>

          {reconciliationResult && (
            <>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-emerald-50 border-b border-emerald-100">
                  <h2 className="font-bold text-emerald-700">✅ Conciliados Automáticamente ({reconciliationResult.matched.length})</h2>
                </div>
                {reconciliationResult.matched.length === 0 ? (
                  <p className="p-6 text-sm text-slate-400">Ninguno en esta carga.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {reconciliationResult.matched.map((r, i) => (
                      <div key={i} className="p-3 flex items-center justify-between text-sm">
                        <span className="text-slate-600">{r.date} · Factura {r.invoice_number} · Ref: {r.reference}</span>
                        <span className="font-bold text-emerald-600">${Number(r.amount).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {reconciliationResult.mismatched.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 bg-amber-50 border-b border-amber-100">
                    <h2 className="font-bold text-amber-700">⚠️ Monto no coincide — revisión manual ({reconciliationResult.mismatched.length})</h2>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {reconciliationResult.mismatched.map((r, i) => (
                      <div key={i} className="p-3 text-sm">
                        <p className="text-slate-600">{r.date} · Ref: {r.reference} · Depósito: ${Number(r.amount).toFixed(2)}</p>
                        <p className="text-xs text-amber-600">{r.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reconciliationResult.unmatched.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 bg-rose-50 border-b border-rose-100">
                    <h2 className="font-bold text-rose-700">❌ Sin factura coincidente — revisión manual ({reconciliationResult.unmatched.length})</h2>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {reconciliationResult.unmatched.map((r, i) => (
                      <div key={i} className="p-3 text-sm">
                        <p className="text-slate-600">{r.date} · Ref: {r.reference} · ${Number(r.amount).toFixed(2)}</p>
                        <p className="text-xs text-rose-500">{r.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
