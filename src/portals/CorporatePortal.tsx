import React, { useEffect, useState } from 'react';
import { Package, Monitor, Briefcase, TrendingDown, Plus, CheckCircle, Laptop, PenTool, HardDrive, Wallet, Users, Calculator, Loader2, Truck, ShoppingCart } from 'lucide-react';

// Contexto de demostración: en producción tenant_id / requested_by vienen del token JWT de Supabase Auth (Fase 2)
const DEMO_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const DEMO_REQUESTER_ID = '66666666-6666-6666-6666-666666666666';

interface FixedAsset {
  id: string;
  asset_tag: string;
  name: string;
  category: string | null;
  condition: string;
  current_assignment: { assigned_to: string; profiles?: { first_name: string; last_name: string } } | null;
}

interface ConsumableItem {
  id: string;
  name: string;
  unit_cost: number;
  stock_quantity: number;
  reorder_level: number;
}

interface Department {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  profile_id: string;
  hire_date: string;
  base_salary: number;
  status: string;
  profiles?: { first_name: string; last_name: string; role: string };
}

interface StaffOption {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface PayrollRun {
  id: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  status: string;
  run_type: string;
}

interface CountryRule {
  country_code: string;
  country_name: string;
  social_security_label: string;
  employee_rate: number;
  employer_rate: number;
  extra_month_label: string | null;
  extra_month_has_own_rate: boolean;
  extra_month_employee_rate: number | null;
  extra_month_employer_rate: number | null;
}

interface Paystub {
  id: string;
  gross_pay: number;
  deductions: number;
  net_pay: number;
  status: string;
  hr_employees?: { profiles?: { first_name: string; last_name: string } };
}

interface Vendor {
  id: string;
  name: string;
  contact_email: string | null;
  service_type: string | null;
}

interface PurchaseOrder {
  id: string;
  total_cost: number;
  status: string;
  created_at: string;
  vendors?: { name: string; service_type: string | null };
}

export const CorporatePortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'assets' | 'consumables' | 'payroll' | 'procurement'>('assets');
  const [message, setMessage] = useState('');

  // --- Patrimonio IT ---
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetForm, setAssetForm] = useState({ asset_tag: '', name: '', category: '', purchase_value: '' });
  const [assignForm, setAssignForm] = useState<{ asset_tag: string; assigned_to_profile_id: string }>({ asset_tag: '', assigned_to_profile_id: '' });

  // --- Bodega y Consumibles ---
  const [consumables, setConsumables] = useState<ConsumableItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [consumablesLoading, setConsumablesLoading] = useState(false);
  const [consumableForm, setConsumableForm] = useState({ name: '', unit_cost: '', stock_quantity: '' });
  const [dispatchDeptByItem, setDispatchDeptByItem] = useState<Record<string, string>>({});

  // --- Proveedores y Compras ---
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [procurementLoading, setProcurementLoading] = useState(false);
  const [vendorForm, setVendorForm] = useState({ name: '', contact_email: '', service_type: '' });
  const [poForm, setPoForm] = useState({ vendor_id: '', total_cost: '' });

  // --- Nómina ---
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [paystubs, setPaystubs] = useState<Paystub[]>([]);
  const [payrollLoading, setPayrollLoading] = useState(false);

  const [employeeForm, setEmployeeForm] = useState({ profile_id: '', hire_date: '', base_salary: '' });
  const [runForm, setRunForm] = useState({ period_start: '', period_end: '', run_type: 'regular' });
  const [deductionRateOverride, setDeductionRateOverride] = useState<Record<string, string>>({});
  const [countryRule, setCountryRule] = useState<CountryRule | null>(null);

  const loadPayrollData = async () => {
    try {
      const [employeesRes, runsRes, staffRes, tenantRes, rulesRes] = await Promise.all([
        fetch(`/api/v1/corporate/employees?tenant_id=${DEMO_TENANT_ID}`),
        fetch(`/api/v1/corporate/payroll/runs?tenant_id=${DEMO_TENANT_ID}`),
        fetch(`/api/v1/hierarchy/staff?tenant_id=${DEMO_TENANT_ID}`),
        fetch(`/api/v1/tenants/${DEMO_TENANT_ID}`),
        fetch(`/api/v1/corporate/payroll-country-rules`),
      ]);
      const employeesData = await employeesRes.json();
      const runsData = await runsRes.json();
      const staffData = await staffRes.json();
      const tenantData = await tenantRes.json();
      const rulesData = await rulesRes.json();
      setEmployees(employeesData.employees || []);
      setPayrollRuns(runsData.runs || []);
      setStaffOptions(staffData.staff || []);
      const rules: CountryRule[] = rulesData.countryRules || [];
      setCountryRule(rules.find(r => r.country_code === tenantData.tenant?.country) || null);
    } catch {
      setMessage('❌ No se pudo conectar con el servidor SIS.');
    }
  };

  useEffect(() => {
    if (activeTab === 'payroll') loadPayrollData();
    if (activeTab === 'procurement') loadProcurementData();
    if (activeTab === 'assets') loadAssets();
    if (activeTab === 'consumables') loadConsumables();
  }, [activeTab]);

  const loadAssets = async () => {
    setAssetsLoading(true);
    try {
      const response = await fetch(`/api/v1/corporate/assets?tenant_id=${DEMO_TENANT_ID}`);
      const data = await response.json();
      setAssets(data.assets || []);
    } catch {
      setMessage('❌ No se pudo conectar con el servidor SIS.');
    }
    setAssetsLoading(false);
  };

  const handleCreateAsset = async () => {
    if (!assetForm.asset_tag || !assetForm.name) {
      setMessage('❌ Indica la placa y el nombre del activo.');
      return;
    }
    setAssetsLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/corporate/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          asset_tag: assetForm.asset_tag,
          name: assetForm.name,
          category: assetForm.category || null,
          purchase_value: assetForm.purchase_value ? Number(assetForm.purchase_value) : null,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Activo registrado en el patrimonio.');
        setAssetForm({ asset_tag: '', name: '', category: '', purchase_value: '' });
        loadAssets();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo registrar el activo.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setAssetsLoading(false);
  };

  const handleAssignAssetTo = async (tag: string) => {
    const assignedTo = assignForm.asset_tag === tag ? assignForm.assigned_to_profile_id : '';
    if (!assignedTo) {
      setMessage('❌ Indica el ID de perfil del staff que recibirá el equipo.');
      return;
    }
    setAssetsLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/corporate/assets/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: DEMO_TENANT_ID, asset_tag: tag, assigned_to_profile_id: assignedTo }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage(`✅ Equipo ${tag} asignado correctamente.`);
        setAssignForm({ asset_tag: '', assigned_to_profile_id: '' });
        loadAssets();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo asignar el activo.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setAssetsLoading(false);
  };

  const loadConsumables = async () => {
    setConsumablesLoading(true);
    try {
      const [consumablesRes, deptRes] = await Promise.all([
        fetch(`/api/v1/corporate/consumables?tenant_id=${DEMO_TENANT_ID}`),
        fetch(`/api/v1/hierarchy/departments?tenant_id=${DEMO_TENANT_ID}`),
      ]);
      const consumablesData = await consumablesRes.json();
      const deptData = await deptRes.json();
      setConsumables(consumablesData.consumables || []);
      setDepartments(deptData.departments || []);
    } catch {
      setMessage('❌ No se pudo conectar con el servidor SIS.');
    }
    setConsumablesLoading(false);
  };

  const handleCreateConsumable = async () => {
    if (!consumableForm.name || !consumableForm.unit_cost) {
      setMessage('❌ Indica el nombre y el costo unitario del ítem.');
      return;
    }
    setConsumablesLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/corporate/consumables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          name: consumableForm.name,
          unit_cost: Number(consumableForm.unit_cost),
          stock_quantity: consumableForm.stock_quantity ? Number(consumableForm.stock_quantity) : 0,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Ítem agregado al catálogo de bodega.');
        setConsumableForm({ name: '', unit_cost: '', stock_quantity: '' });
        loadConsumables();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo agregar el ítem.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setConsumablesLoading(false);
  };

  const handleDispatchConsumableReal = async (item: ConsumableItem) => {
    const departmentId = dispatchDeptByItem[item.id];
    if (!departmentId) {
      setMessage('❌ Selecciona el departamento que recibirá el consumible.');
      return;
    }
    setConsumablesLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/corporate/consumables/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          consumable_id: item.id,
          department_id: departmentId,
          requested_by_profile_id: DEMO_REQUESTER_ID,
          quantity: 1,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('📦 ' + data.message);
        loadConsumables();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo despachar el consumible.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setConsumablesLoading(false);
  };

  const loadProcurementData = async () => {
    try {
      const [vendorsRes, poRes] = await Promise.all([
        fetch(`/api/v1/corporate/vendors?tenant_id=${DEMO_TENANT_ID}`),
        fetch(`/api/v1/corporate/purchase-orders?tenant_id=${DEMO_TENANT_ID}`),
      ]);
      const vendorsData = await vendorsRes.json();
      const poData = await poRes.json();
      setVendors(vendorsData.vendors || []);
      setPurchaseOrders(poData.purchaseOrders || []);
    } catch {
      setMessage('❌ No se pudo conectar con el servidor SIS.');
    }
  };

  const handleAddVendor = async () => {
    if (!vendorForm.name) {
      setMessage('❌ El nombre del proveedor es requerido.');
      return;
    }
    setProcurementLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/corporate/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: DEMO_TENANT_ID, ...vendorForm }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Proveedor registrado.');
        setVendorForm({ name: '', contact_email: '', service_type: '' });
        loadProcurementData();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo registrar el proveedor.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setProcurementLoading(false);
  };

  const handleCreatePurchaseOrder = async () => {
    if (!poForm.vendor_id || !poForm.total_cost) {
      setMessage('❌ Selecciona un proveedor e indica el costo total.');
      return;
    }
    setProcurementLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/corporate/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          vendor_id: poForm.vendor_id,
          total_cost: Number(poForm.total_cost),
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Orden de compra creada, pendiente de aprobación.');
        setPoForm({ vendor_id: '', total_cost: '' });
        loadProcurementData();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo crear la orden de compra.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setProcurementLoading(false);
  };

  const handleUpdatePOStatus = async (id: string, status: string) => {
    setProcurementLoading(true);
    setMessage('');
    try {
      const response = await fetch(`/api/v1/corporate/purchase-orders/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ ' + data.message);
        loadProcurementData();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo actualizar la orden de compra.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setProcurementLoading(false);
  };

  const handleAddEmployee = async () => {
    if (!employeeForm.profile_id || !employeeForm.hire_date || !employeeForm.base_salary) {
      setMessage('❌ Completa perfil, fecha de contratación y salario base.');
      return;
    }
    setPayrollLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/corporate/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          profile_id: employeeForm.profile_id,
          hire_date: employeeForm.hire_date,
          base_salary: Number(employeeForm.base_salary),
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Empleado registrado en nómina.');
        setEmployeeForm({ profile_id: '', hire_date: '', base_salary: '' });
        loadPayrollData();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo registrar al empleado.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setPayrollLoading(false);
  };

  const handleOpenRun = async () => {
    if (!runForm.period_start || !runForm.period_end) {
      setMessage('❌ Define el inicio y fin del periodo de la planilla.');
      return;
    }
    setPayrollLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/corporate/payroll/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: DEMO_TENANT_ID, ...runForm }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Planilla abierta en borrador.');
        setRunForm({ period_start: '', period_end: '', run_type: 'regular' });
        loadPayrollData();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo abrir la planilla.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setPayrollLoading(false);
  };

  const handleCalculateRun = async (runId: string) => {
    setPayrollLoading(true);
    setMessage('');
    try {
      const override = deductionRateOverride[runId];
      const response = await fetch(`/api/v1/corporate/payroll/runs/${runId}/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(override ? { deduction_rate: Number(override) / 100 } : {}),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ ' + data.message);
        loadPayrollData();
        handleViewPaystubs(runId);
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo calcular la planilla.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setPayrollLoading(false);
  };

  const handleViewPaystubs = async (runId: string) => {
    setSelectedRunId(runId);
    try {
      const response = await fetch(`/api/v1/corporate/payroll/runs/${runId}/paystubs`);
      const data = await response.json();
      setPaystubs(data.paystubs || []);
    } catch {
      setMessage('❌ Error al consultar los recibos de pago.');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-slate-800">
      
      <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-lg text-blue-700">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">ERP Corporativo: Activos e Inventario</h1>
            <p className="text-sm text-slate-500">Módulo de gestión patrimonial y centro de costos</p>
          </div>
        </div>
      </div>

      {message && (
        <div className="bg-emerald-50 text-emerald-700 p-4 rounded-lg flex items-center border border-emerald-200">
          <CheckCircle className="w-5 h-5 mr-2" />
          <span className="font-medium">{message}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2">
        <button 
          onClick={() => setActiveTab('assets')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'assets' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Monitor className="w-4 h-4 mr-2" /> Patrimonio IT (Equipos)
        </button>
        <button
          onClick={() => setActiveTab('consumables')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'consumables' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Package className="w-4 h-4 mr-2" /> Bodega y Consumibles
        </button>
        <button
          onClick={() => setActiveTab('payroll')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'payroll' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Wallet className="w-4 h-4 mr-2" /> Nómina y Planillas
        </button>
        <button
          onClick={() => setActiveTab('procurement')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'procurement' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Truck className="w-4 h-4 mr-2" /> Proveedores y Compras
        </button>
      </div>

      {/* Activos IT */}
      {activeTab === 'assets' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h2 className="font-bold text-slate-700 flex items-center mb-3"><Plus className="w-4 h-4 mr-2 text-blue-600" /> Registrar Nuevo Activo</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text" placeholder="Placa (ej. IT-2026-003)" value={assetForm.asset_tag}
                onChange={e => setAssetForm({ ...assetForm, asset_tag: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text" placeholder="Nombre del equipo" value={assetForm.name}
                onChange={e => setAssetForm({ ...assetForm, name: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text" placeholder="Categoría (IT, Mobiliario...)" value={assetForm.category}
                onChange={e => setAssetForm({ ...assetForm, category: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number" placeholder="Valor de compra" value={assetForm.purchase_value}
                onChange={e => setAssetForm({ ...assetForm, purchase_value: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleCreateAsset}
              disabled={assetsLoading}
              className="mt-3 flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold text-sm"
            >
              {assetsLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Registrar Activo
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-bold text-slate-700">Inventario de Patrimonio</h2>
            </div>
            {assets.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">Aún no hay activos registrados.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 font-semibold">CÓDIGO (PLACA)</th>
                    <th className="px-4 py-3 font-semibold">EQUIPO</th>
                    <th className="px-4 py-3 font-semibold">ESTADO</th>
                    <th className="px-4 py-3 font-semibold">ASIGNADO A</th>
                    <th className="px-4 py-3 font-semibold text-right">ACCIÓN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-600">{asset.asset_tag}</td>
                      <td className="px-4 py-3 flex items-center gap-2">
                        {asset.name.toLowerCase().includes('mac') || asset.name.toLowerCase().includes('laptop')
                          ? <Laptop className="w-4 h-4 text-slate-400" /> : <HardDrive className="w-4 h-4 text-slate-400" />}
                        {asset.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">{asset.condition}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {asset.current_assignment
                          ? (asset.current_assignment.profiles
                              ? `${asset.current_assignment.profiles.first_name} ${asset.current_assignment.profiles.last_name}`
                              : 'Asignado')
                          : 'Sin asignar'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!asset.current_assignment && (
                          assignForm.asset_tag === asset.asset_tag ? (
                            <div className="flex items-center justify-end gap-2">
                              <input
                                type="text" placeholder="ID de perfil" value={assignForm.assigned_to_profile_id}
                                onChange={e => setAssignForm({ ...assignForm, assigned_to_profile_id: e.target.value })}
                                className="border border-slate-300 rounded-md px-2 py-1 text-xs w-32"
                              />
                              <button
                                onClick={() => handleAssignAssetTo(asset.asset_tag)}
                                disabled={assetsLoading}
                                className="text-blue-600 font-bold hover:text-blue-800 bg-blue-50 px-3 py-1 rounded disabled:opacity-50"
                              >
                                Confirmar
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setAssignForm({ asset_tag: asset.asset_tag, assigned_to_profile_id: '' })}
                              className="text-blue-600 font-bold hover:text-blue-800 bg-blue-50 px-3 py-1 rounded"
                            >
                              Asignar al Staff
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Consumibles */}
      {activeTab === 'consumables' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h2 className="font-bold text-slate-700 flex items-center mb-3"><Plus className="w-4 h-4 mr-2 text-blue-600" /> Agregar Ítem al Catálogo</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text" placeholder="Nombre del ítem" value={consumableForm.name}
                onChange={e => setConsumableForm({ ...consumableForm, name: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number" placeholder="Costo unitario" value={consumableForm.unit_cost}
                onChange={e => setConsumableForm({ ...consumableForm, unit_cost: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number" placeholder="Stock inicial" value={consumableForm.stock_quantity}
                onChange={e => setConsumableForm({ ...consumableForm, stock_quantity: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleCreateConsumable}
              disabled={consumablesLoading}
              className="mt-3 flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold text-sm"
            >
              {consumablesLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Agregar Ítem
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-slate-700 flex items-center"><TrendingDown className="w-4 h-4 mr-2 text-rose-500" /> Centro de Costos / Egresos de Bodega</h2>
            </div>
            {consumables.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">Aún no hay ítems en el catálogo de bodega.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 font-semibold">ITEM</th>
                    <th className="px-4 py-3 font-semibold">COSTO UNITARIO</th>
                    <th className="px-4 py-3 font-semibold">STOCK ACTUAL</th>
                    <th className="px-4 py-3 font-semibold text-right">DESPACHO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {consumables.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 flex items-center gap-2">
                        <PenTool className="w-4 h-4 text-slate-400" />
                        <span className="font-medium">{item.name}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">${Number(item.unit_cost).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.stock_quantity <= item.reorder_level ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {item.stock_quantity} unidades {item.stock_quantity <= item.reorder_level && '(¡Bajo!)'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <select
                            value={dispatchDeptByItem[item.id] || ''}
                            onChange={e => setDispatchDeptByItem({ ...dispatchDeptByItem, [item.id]: e.target.value })}
                            className="border border-slate-300 rounded-md px-2 py-1 text-xs"
                          >
                            <option value="">Depto...</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                          <button
                            onClick={() => handleDispatchConsumableReal(item)}
                            disabled={consumablesLoading}
                            className="text-indigo-600 font-bold hover:text-indigo-800 bg-indigo-50 px-3 py-1 rounded border border-indigo-200 disabled:opacity-50"
                          >
                            Despachar 1 ud.
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Nómina y Planillas */}
      {activeTab === 'payroll' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
              <h2 className="font-bold text-slate-700 flex items-center"><Users className="w-4 h-4 mr-2 text-blue-600" /> Dar de Alta Empleado en Nómina</h2>
              <select
                value={employeeForm.profile_id}
                onChange={e => setEmployeeForm({ ...employeeForm, profile_id: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona un docente/staff</option>
                {staffOptions
                  .filter(s => !employees.some(e => e.profile_id === s.id))
                  .map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.role})</option>)}
              </select>
              {staffOptions.length === 0 && (
                <p className="text-xs text-slate-400">
                  Aún no hay docentes/staff creados. Ve a Admin → Organización → "Agregar Docente / Staff" primero.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Fecha de contratación</label>
                  <input
                    type="date" value={employeeForm.hire_date}
                    onChange={e => setEmployeeForm({ ...employeeForm, hire_date: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Salario base</label>
                  <input
                    type="number" placeholder="0.00" value={employeeForm.base_salary}
                    onChange={e => setEmployeeForm({ ...employeeForm, base_salary: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <button
                onClick={handleAddEmployee}
                disabled={payrollLoading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold text-sm"
              >
                {payrollLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Registrar Empleado
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
              <h2 className="font-bold text-slate-700 flex items-center"><Calculator className="w-4 h-4 mr-2 text-blue-600" /> Abrir Planilla del Periodo</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Inicio del periodo</label>
                  <input
                    type="date" value={runForm.period_start}
                    onChange={e => setRunForm({ ...runForm, period_start: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Fin del periodo</label>
                  <input
                    type="date" value={runForm.period_end}
                    onChange={e => setRunForm({ ...runForm, period_end: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400">Tipo de planilla</label>
                <select
                  value={runForm.run_type}
                  onChange={e => setRunForm({ ...runForm, run_type: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="regular">Regular</option>
                  <option value="extra_month">{countryRule?.extra_month_label || 'Mes Extra (aguinaldo/décimo/prima)'}</option>
                </select>
              </div>
              {countryRule ? (
                <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md p-2">
                  Se calculará con las reglas de <strong>{countryRule.country_name} ({countryRule.social_security_label})</strong>:{' '}
                  {runForm.run_type === 'extra_month' && countryRule.extra_month_has_own_rate
                    ? `${countryRule.extra_month_employee_rate}% al empleado sobre el ${countryRule.extra_month_label}.`
                    : `${countryRule.employee_rate}% al empleado.`}
                </p>
              ) : (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2">
                  Este colegio no tiene país configurado — se usará un 12% de deducción por defecto (editable al calcular cada planilla).
                </p>
              )}
              <button
                onClick={handleOpenRun}
                disabled={payrollLoading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold text-sm"
              >
                {payrollLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Abrir Planilla
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center">
              <Users className="w-4 h-4 mr-2 text-blue-600" />
              <h2 className="font-bold text-slate-700">Staff en Nómina</h2>
            </div>
            {employees.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">Aún no hay empleados dados de alta en nómina.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 font-semibold">EMPLEADO</th>
                    <th className="px-4 py-3 font-semibold">ROL</th>
                    <th className="px-4 py-3 font-semibold">CONTRATADO</th>
                    <th className="px-4 py-3 font-semibold text-right">SALARIO BASE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold">
                        {emp.profiles ? `${emp.profiles.first_name} ${emp.profiles.last_name}` : 'Sin perfil vinculado'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{emp.profiles?.role || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{emp.hire_date}</td>
                      <td className="px-4 py-3 text-right font-mono">${Number(emp.base_salary).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center">
              <Wallet className="w-4 h-4 mr-2 text-blue-600" />
              <h2 className="font-bold text-slate-700">Planillas</h2>
            </div>
            {payrollRuns.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">Aún no hay planillas abiertas.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 font-semibold">PERIODO</th>
                    <th className="px-4 py-3 font-semibold">TIPO</th>
                    <th className="px-4 py-3 font-semibold">ESTADO</th>
                    <th className="px-4 py-3 font-semibold text-right">TOTAL NETO</th>
                    <th className="px-4 py-3 font-semibold text-right">ACCIÓN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payrollRuns.map(run => (
                    <tr key={run.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">{run.period_start} → {run.period_end}</td>
                      <td className="px-4 py-3 text-slate-500">{run.run_type === 'extra_month' ? (countryRule?.extra_month_label || 'Mes Extra') : 'Regular'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          run.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                          run.status === 'approved' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                        }`}>{run.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">${Number(run.total_amount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {run.status === 'draft' ? (
                          <div className="flex items-center justify-end gap-2">
                            <input
                              type="number" placeholder="% manual (opcional)"
                              value={deductionRateOverride[run.id] || ''}
                              onChange={e => setDeductionRateOverride({ ...deductionRateOverride, [run.id]: e.target.value })}
                              className="w-32 border border-slate-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              onClick={() => handleCalculateRun(run.id)}
                              disabled={payrollLoading}
                              className="text-blue-600 font-bold hover:text-blue-800 bg-blue-50 px-3 py-1 rounded disabled:opacity-50"
                            >
                              Calcular Planilla
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleViewPaystubs(run.id)}
                            className="text-slate-600 font-bold hover:text-slate-800 bg-slate-100 px-3 py-1 rounded"
                          >
                            Ver Recibos
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {selectedRunId && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h2 className="font-bold text-slate-700">Recibos de Pago (Paystubs)</h2>
              </div>
              {paystubs.length === 0 ? (
                <p className="p-6 text-sm text-slate-400">Esta planilla aún no tiene recibos generados.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3 font-semibold">EMPLEADO</th>
                      <th className="px-4 py-3 font-semibold text-right">BRUTO</th>
                      <th className="px-4 py-3 font-semibold text-right">DEDUCCIONES</th>
                      <th className="px-4 py-3 font-semibold text-right">NETO A PAGAR</th>
                      <th className="px-4 py-3 font-semibold text-right">ESTADO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paystubs.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold">
                          {p.hr_employees?.profiles ? `${p.hr_employees.profiles.first_name} ${p.hr_employees.profiles.last_name}` : 'Empleado'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">${Number(p.gross_pay).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono text-rose-600">-${Number(p.deductions).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold">${Number(p.net_pay).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${p.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* Proveedores y Compras */}
      {activeTab === 'procurement' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
              <h2 className="font-bold text-slate-700 flex items-center"><Truck className="w-4 h-4 mr-2 text-blue-600" /> Registrar Proveedor</h2>
              <input
                type="text" placeholder="Nombre del proveedor" value={vendorForm.name}
                onChange={e => setVendorForm({ ...vendorForm, name: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="email" placeholder="Correo de contacto" value={vendorForm.contact_email}
                onChange={e => setVendorForm({ ...vendorForm, contact_email: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text" placeholder="Tipo de servicio (ej. Mantenimiento)" value={vendorForm.service_type}
                onChange={e => setVendorForm({ ...vendorForm, service_type: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddVendor}
                disabled={procurementLoading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold text-sm"
              >
                {procurementLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Registrar Proveedor
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
              <h2 className="font-bold text-slate-700 flex items-center"><ShoppingCart className="w-4 h-4 mr-2 text-blue-600" /> Nueva Orden de Compra</h2>
              <select
                value={poForm.vendor_id}
                onChange={e => setPoForm({ ...poForm, vendor_id: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona el proveedor</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <input
                type="number" placeholder="Costo total" value={poForm.total_cost}
                onChange={e => setPoForm({ ...poForm, total_cost: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleCreatePurchaseOrder}
                disabled={procurementLoading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold text-sm"
              >
                {procurementLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Crear Orden de Compra
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center">
              <Truck className="w-4 h-4 mr-2 text-blue-600" />
              <h2 className="font-bold text-slate-700">Proveedores</h2>
            </div>
            {vendors.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">Aún no hay proveedores registrados.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 font-semibold">NOMBRE</th>
                    <th className="px-4 py-3 font-semibold">SERVICIO</th>
                    <th className="px-4 py-3 font-semibold">CONTACTO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vendors.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold">{v.name}</td>
                      <td className="px-4 py-3 text-slate-500">{v.service_type || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{v.contact_email || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center">
              <ShoppingCart className="w-4 h-4 mr-2 text-blue-600" />
              <h2 className="font-bold text-slate-700">Órdenes de Compra (Cuentas por Pagar)</h2>
            </div>
            {purchaseOrders.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">Aún no hay órdenes de compra registradas.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 font-semibold">PROVEEDOR</th>
                    <th className="px-4 py-3 font-semibold text-right">MONTO</th>
                    <th className="px-4 py-3 font-semibold">ESTADO</th>
                    <th className="px-4 py-3 font-semibold text-right">ACCIÓN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchaseOrders.map(po => (
                    <tr key={po.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold">{po.vendors?.name || '—'}</td>
                      <td className="px-4 py-3 text-right font-mono">${Number(po.total_cost).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          po.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                          po.status === 'scheduled' ? 'bg-indigo-100 text-indigo-700' :
                          po.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                          po.status === 'cancelled' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                        }`}>{po.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {po.status === 'pending_approval' && (
                          <button
                            onClick={() => handleUpdatePOStatus(po.id, 'approved')}
                            disabled={procurementLoading}
                            className="text-blue-600 font-bold hover:text-blue-800 bg-blue-50 px-3 py-1 rounded disabled:opacity-50"
                          >
                            Aprobar
                          </button>
                        )}
                        {(po.status === 'approved' || po.status === 'scheduled') && (
                          <span className="text-xs text-slate-400">Programar/pagar desde el Portal de Finanzas</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
