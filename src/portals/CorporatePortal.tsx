import React, { useEffect, useState } from 'react';
import { Package, Monitor, Briefcase, TrendingDown, Plus, CheckCircle, Laptop, PenTool, HardDrive, Wallet, Users, Calculator, Loader2, Truck, ShoppingCart, CalendarOff, UserCog, X, DoorOpen, Star } from 'lucide-react';

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
  base_salary: number | null;
  status: string;
  employment_type: 'local' | 'expatriate' | 'honorarios';
  custom_employee_rate: number | null;
  pay_type: 'monthly' | 'hourly';
  hourly_rate: number | null;
  hourly_prep_percent: number | null;
  vacation_days_balance: number | null;
  profiles?: { first_name: string; last_name: string; role: string };
}

interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: 'vacation' | 'sick' | 'personal' | 'other';
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  hr_employees?: { profile_id: string; vacation_days_balance: number | null; profiles?: { first_name: string; last_name: string } };
}

interface SubstituteAssignment {
  id: string;
  class_id: string;
  date: string;
  notes: string | null;
  classes?: { name: string; courses?: { name: string } };
  original_teacher?: { first_name: string; last_name: string };
  substitute_teacher?: { first_name: string; last_name: string };
}

interface ClassOption {
  id: string;
  name: string;
  teacher_id: string | null;
  courses?: { name: string };
}

interface Facility {
  id: string;
  name: string;
  category: string | null;
  capacity: number | null;
  is_active: boolean;
}

interface FacilityBooking {
  id: string;
  facility_id: string;
  date: string;
  start_time: string;
  end_time: string;
  purpose: string | null;
  facilities?: { name: string; category: string | null };
  profiles?: { first_name: string; last_name: string };
}

interface EvaluationCycle {
  id: string;
  name: string;
  is_open: boolean;
  academic_terms?: { name: string };
}

interface TeacherEvaluationSummaryRow {
  teacher_id: string;
  teacher_name: string;
  student_average: number | null;
  student_responses: number;
  coordination_average: number | null;
  coordination_responses: number;
  overall_average: number | null;
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
  hours_worked: number | null;
  status: string;
  hr_employees?: { profiles?: { first_name: string; last_name: string } };
}

interface Vendor {
  id: string;
  name: string;
  contact_email: string | null;
  service_type: string | null;
}

interface PayrollTypeTotals {
  grossPay: number;
  netPay: number;
  count: number;
  employerCost: number;
}

interface PayrollMonthSummary {
  month: string;
  netPay: number;
  employerCost: number;
  grandTotal: number;
  runsCount: number;
  hasExtraMonth: boolean;
  byType: { local: PayrollTypeTotals; expatriate: PayrollTypeTotals; honorarios: PayrollTypeTotals };
}

interface PurchaseOrder {
  id: string;
  total_cost: number;
  status: string;
  created_at: string;
  vendors?: { name: string; service_type: string | null };
}

export const CorporatePortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'assets' | 'consumables' | 'payroll' | 'procurement' | 'hr_leave' | 'facilities' | 'evaluations'>('assets');
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

  const [employeeForm, setEmployeeForm] = useState({
    profile_id: '', hire_date: '', employment_type: 'local', custom_employee_rate: '',
    pay_type: 'monthly', base_salary: '', hourly_rate: '', hourly_prep_percent: '',
  });
  const [runForm, setRunForm] = useState({ period_start: '', period_end: '', run_type: 'regular' });
  const [deductionRateOverride, setDeductionRateOverride] = useState<Record<string, string>>({});
  const [countryRule, setCountryRule] = useState<CountryRule | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<PayrollMonthSummary[]>([]);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  // --- Ausencias y Suplencias ---
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [substituteAssignments, setSubstituteAssignments] = useState<SubstituteAssignment[]>([]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [hrLeaveEmployees, setHrLeaveEmployees] = useState<Employee[]>([]);
  const [hrLeaveStaffOptions, setHrLeaveStaffOptions] = useState<StaffOption[]>([]);
  const [hrLeaveLoading, setHrLeaveLoading] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ employee_id: '', leave_type: 'vacation', start_date: '', end_date: '', days_requested: '', reason: '' });
  const [substituteForm, setSubstituteForm] = useState({ class_id: '', date: '', substitute_teacher_id: '', notes: '' });
  const [vacationBalanceDrafts, setVacationBalanceDrafts] = useState<Record<string, string>>({});

  // --- Reserva de Espacios (Facility Booking) ---
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facilityBookings, setFacilityBookings] = useState<FacilityBooking[]>([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [facilityForm, setFacilityForm] = useState({ name: '', category: '', capacity: '' });
  const [bookingForm, setBookingForm] = useState({ facility_id: '', date: '', start_time: '', end_time: '', purpose: '' });

  // --- Evaluación Docente 360° ---
  const [evaluationCycles, setEvaluationCycles] = useState<EvaluationCycle[]>([]);
  const [evaluationSummary, setEvaluationSummary] = useState<TeacherEvaluationSummaryRow[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [evaluationsLoading, setEvaluationsLoading] = useState(false);
  const [cycleForm, setCycleForm] = useState({ name: '' });
  const [evalForm, setEvalForm] = useState({ teacher_id: '', score_teaching: '5', score_punctuality: '5', score_communication: '5', score_fairness: '5', comments: '' });

  const loadFacilitiesData = async () => {
    setFacilitiesLoading(true);
    try {
      const [facRes, bookRes] = await Promise.all([
        fetch(`/api/v1/facilities?tenant_id=${DEMO_TENANT_ID}`),
        fetch(`/api/v1/facilities/bookings?tenant_id=${DEMO_TENANT_ID}`),
      ]);
      const facData = await facRes.json();
      const bookData = await bookRes.json();
      setFacilities(facData.facilities || []);
      setFacilityBookings(bookData.bookings || []);
    } catch {
      setMessage('❌ No se pudo conectar con el servidor SIS.');
    }
    setFacilitiesLoading(false);
  };

  const handleCreateFacility = async () => {
    if (!facilityForm.name) {
      setMessage('❌ Escribe el nombre del espacio.');
      return;
    }
    setFacilitiesLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/facilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: DEMO_TENANT_ID, ...facilityForm, capacity: facilityForm.capacity ? Number(facilityForm.capacity) : null }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Espacio creado.');
        setFacilityForm({ name: '', category: '', capacity: '' });
        loadFacilitiesData();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo crear el espacio.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setFacilitiesLoading(false);
  };

  const handleCreateBooking = async () => {
    if (!bookingForm.facility_id || !bookingForm.date || !bookingForm.start_time || !bookingForm.end_time) {
      setMessage('❌ Completa el espacio, la fecha y el horario.');
      return;
    }
    setFacilitiesLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/facilities/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: DEMO_TENANT_ID, booked_by: DEMO_REQUESTER_ID, ...bookingForm }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Espacio reservado.');
        setBookingForm({ facility_id: '', date: '', start_time: '', end_time: '', purpose: '' });
        loadFacilitiesData();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo reservar el espacio.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setFacilitiesLoading(false);
  };

  const handleCancelBooking = async (id: string) => {
    setMessage('');
    try {
      const response = await fetch(`/api/v1/facilities/bookings/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setFacilityBookings(prev => prev.filter(b => b.id !== id));
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo cancelar la reserva.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
  };

  const loadEvaluationsData = async () => {
    setEvaluationsLoading(true);
    try {
      const [cyclesRes, staffRes] = await Promise.all([
        fetch(`/api/v1/teacher-evaluations/cycles?tenant_id=${DEMO_TENANT_ID}`),
        fetch(`/api/v1/hierarchy/staff?tenant_id=${DEMO_TENANT_ID}`),
      ]);
      const cyclesData = await cyclesRes.json();
      const staffData = await staffRes.json();
      setStaffOptions(staffData.staff || []);
      const cycles: EvaluationCycle[] = cyclesData.cycles || [];
      setEvaluationCycles(cycles);
      const activeCycleId = selectedCycleId || cycles[0]?.id || '';
      setSelectedCycleId(activeCycleId);
      if (activeCycleId) {
        const summaryRes = await fetch(`/api/v1/teacher-evaluations/summary?tenant_id=${DEMO_TENANT_ID}&cycle_id=${activeCycleId}`);
        const summaryData = await summaryRes.json();
        setEvaluationSummary(summaryData.summary || []);
      } else {
        setEvaluationSummary([]);
      }
    } catch {
      setMessage('❌ No se pudo conectar con el servidor SIS.');
    }
    setEvaluationsLoading(false);
  };

  const loadEvaluationSummaryForCycle = async (cycleId: string) => {
    setSelectedCycleId(cycleId);
    if (!cycleId) { setEvaluationSummary([]); return; }
    try {
      const response = await fetch(`/api/v1/teacher-evaluations/summary?tenant_id=${DEMO_TENANT_ID}&cycle_id=${cycleId}`);
      const data = await response.json();
      setEvaluationSummary(data.summary || []);
    } catch {
      setMessage('❌ No se pudo conectar con el servidor SIS.');
    }
  };

  const handleCreateCycle = async () => {
    if (!cycleForm.name) {
      setMessage('❌ Escribe el nombre del ciclo de evaluación.');
      return;
    }
    setEvaluationsLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/teacher-evaluations/cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: DEMO_TENANT_ID, name: cycleForm.name }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Ciclo de evaluación creado.');
        setCycleForm({ name: '' });
        loadEvaluationsData();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo crear el ciclo.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setEvaluationsLoading(false);
  };

  const handleCloseCycle = async (cycleId: string) => {
    setMessage('');
    try {
      const response = await fetch(`/api/v1/teacher-evaluations/cycles/${cycleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_open: false }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Ciclo cerrado.');
        loadEvaluationsData();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo cerrar el ciclo.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
  };

  const handleSubmitCoordinationEvaluation = async () => {
    if (!selectedCycleId || !evalForm.teacher_id) {
      setMessage('❌ Selecciona el ciclo y el docente a evaluar.');
      return;
    }
    setEvaluationsLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/teacher-evaluations/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          cycle_id: selectedCycleId,
          teacher_id: evalForm.teacher_id,
          evaluator_role: 'coordination',
          evaluator_profile_id: DEMO_REQUESTER_ID,
          score_teaching: Number(evalForm.score_teaching),
          score_punctuality: Number(evalForm.score_punctuality),
          score_communication: Number(evalForm.score_communication),
          score_fairness: Number(evalForm.score_fairness),
          comments: evalForm.comments || null,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Evaluación registrada.');
        setEvalForm({ teacher_id: '', score_teaching: '5', score_punctuality: '5', score_communication: '5', score_fairness: '5', comments: '' });
        loadEvaluationSummaryForCycle(selectedCycleId);
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo registrar la evaluación.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setEvaluationsLoading(false);
  };

  const loadHrLeaveData = async () => {
    setHrLeaveLoading(true);
    try {
      const [leaveRes, subRes, employeesRes, staffRes, classesRes] = await Promise.all([
        fetch(`/api/v1/hr-leave/requests?tenant_id=${DEMO_TENANT_ID}`),
        fetch(`/api/v1/hr-leave/substitute-assignments?tenant_id=${DEMO_TENANT_ID}`),
        fetch(`/api/v1/corporate/employees?tenant_id=${DEMO_TENANT_ID}`),
        fetch(`/api/v1/hierarchy/staff?tenant_id=${DEMO_TENANT_ID}`),
        fetch(`/api/v1/academics/classes?tenant_id=${DEMO_TENANT_ID}`),
      ]);
      const leaveData = await leaveRes.json();
      const subData = await subRes.json();
      const employeesData = await employeesRes.json();
      const staffData = await staffRes.json();
      const classesData = await classesRes.json();
      setLeaveRequests(leaveData.leaveRequests || []);
      setSubstituteAssignments(subData.substituteAssignments || []);
      setHrLeaveEmployees(employeesData.employees || []);
      setHrLeaveStaffOptions(staffData.staff || []);
      setClassOptions(classesData.classes || []);
    } catch {
      setMessage('❌ No se pudo conectar con el servidor SIS.');
    }
    setHrLeaveLoading(false);
  };

  const handleCreateLeaveRequest = async () => {
    if (!leaveForm.employee_id || !leaveForm.start_date || !leaveForm.end_date || !leaveForm.days_requested) {
      setMessage('❌ Completa empleado, fechas y días solicitados.');
      return;
    }
    setHrLeaveLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/hr-leave/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: DEMO_TENANT_ID, ...leaveForm, days_requested: Number(leaveForm.days_requested) }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Solicitud de ausencia registrada, pendiente de aprobación.');
        setLeaveForm({ employee_id: '', leave_type: 'vacation', start_date: '', end_date: '', days_requested: '', reason: '' });
        loadHrLeaveData();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo registrar la solicitud.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setHrLeaveLoading(false);
  };

  const handleDecideLeaveRequest = async (id: string, status: 'approved' | 'rejected') => {
    setMessage('');
    try {
      const response = await fetch(`/api/v1/hr-leave/requests/${id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, approved_by: DEMO_REQUESTER_ID }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage(status === 'approved' ? '✅ Solicitud aprobada.' : '✅ Solicitud rechazada.');
        loadHrLeaveData();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo decidir la solicitud.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
  };

  const handleSaveVacationBalance = async (employeeId: string) => {
    const value = vacationBalanceDrafts[employeeId];
    if (value === undefined) return;
    setMessage('');
    try {
      const response = await fetch(`/api/v1/hr-leave/employees/${employeeId}/vacation-balance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vacation_days_balance: Number(value) }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Saldo de vacaciones actualizado.');
        loadHrLeaveData();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo actualizar el saldo.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
  };

  const handleCreateSubstituteAssignment = async () => {
    if (!substituteForm.class_id || !substituteForm.date || !substituteForm.substitute_teacher_id) {
      setMessage('❌ Completa el grupo, la fecha y el suplente.');
      return;
    }
    setHrLeaveLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/hr-leave/substitute-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: DEMO_TENANT_ID, created_by: DEMO_REQUESTER_ID, ...substituteForm }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Suplencia asignada. Se refleja automáticamente en las horas de la planilla de ambos docentes.');
        setSubstituteForm({ class_id: '', date: '', substitute_teacher_id: '', notes: '' });
        loadHrLeaveData();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo asignar la suplencia.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setHrLeaveLoading(false);
  };

  const handleDeleteSubstituteAssignment = async (id: string) => {
    setMessage('');
    try {
      const response = await fetch(`/api/v1/hr-leave/substitute-assignments/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setSubstituteAssignments(prev => prev.filter(s => s.id !== id));
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo eliminar la suplencia.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
  };

  const loadPayrollData = async () => {
    try {
      const [employeesRes, runsRes, staffRes, tenantRes, rulesRes, summaryRes] = await Promise.all([
        fetch(`/api/v1/corporate/employees?tenant_id=${DEMO_TENANT_ID}`),
        fetch(`/api/v1/corporate/payroll/runs?tenant_id=${DEMO_TENANT_ID}`),
        fetch(`/api/v1/hierarchy/staff?tenant_id=${DEMO_TENANT_ID}`),
        fetch(`/api/v1/tenants/${DEMO_TENANT_ID}`),
        fetch(`/api/v1/corporate/payroll-country-rules`),
        fetch(`/api/v1/corporate/payroll/summary?tenant_id=${DEMO_TENANT_ID}`),
      ]);
      const employeesData = await employeesRes.json();
      const runsData = await runsRes.json();
      const staffData = await staffRes.json();
      const tenantData = await tenantRes.json();
      const rulesData = await rulesRes.json();
      const summaryData = await summaryRes.json();
      setEmployees(employeesData.employees || []);
      setPayrollRuns(runsData.runs || []);
      setMonthlySummary(summaryData.months || []);
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
    if (activeTab === 'hr_leave') loadHrLeaveData();
    if (activeTab === 'facilities') loadFacilitiesData();
    if (activeTab === 'evaluations') loadEvaluationsData();
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
    if (!employeeForm.profile_id || !employeeForm.hire_date) {
      setMessage('❌ Completa perfil y fecha de contratación.');
      return;
    }
    if (employeeForm.pay_type === 'monthly' && !employeeForm.base_salary) {
      setMessage('❌ Falta el salario base mensual.');
      return;
    }
    if (employeeForm.pay_type === 'hourly' && !employeeForm.hourly_rate) {
      setMessage('❌ Falta la tarifa por hora.');
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
          employment_type: employeeForm.employment_type,
          custom_employee_rate: employeeForm.custom_employee_rate ? Number(employeeForm.custom_employee_rate) : undefined,
          pay_type: employeeForm.pay_type,
          base_salary: employeeForm.pay_type === 'monthly' ? Number(employeeForm.base_salary) : undefined,
          hourly_rate: employeeForm.pay_type === 'hourly' ? Number(employeeForm.hourly_rate) : undefined,
          hourly_prep_percent: employeeForm.pay_type === 'hourly' && employeeForm.hourly_prep_percent ? Number(employeeForm.hourly_prep_percent) : undefined,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Empleado registrado en nómina.');
        setEmployeeForm({
          profile_id: '', hire_date: '', employment_type: 'local', custom_employee_rate: '',
          pay_type: 'monthly', base_salary: '', hourly_rate: '', hourly_prep_percent: '',
        });
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
        <button
          onClick={() => setActiveTab('hr_leave')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'hr_leave' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <CalendarOff className="w-4 h-4 mr-2" /> Ausencias y Suplencias
        </button>
        <button
          onClick={() => setActiveTab('facilities')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'facilities' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <DoorOpen className="w-4 h-4 mr-2" /> Reserva de Espacios
        </button>
        <button
          onClick={() => setActiveTab('evaluations')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'evaluations' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Star className="w-4 h-4 mr-2" /> Evaluación Docente 360°
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
                              <select
                                value={assignForm.assigned_to_profile_id}
                                onChange={e => setAssignForm({ ...assignForm, assigned_to_profile_id: e.target.value })}
                                className="border border-slate-300 rounded-md px-2 py-1 text-xs w-40"
                              >
                                <option value="">Selecciona el staff...</option>
                                {staffOptions.map(s => (
                                  <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                                ))}
                              </select>
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
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center">
              <Wallet className="w-4 h-4 mr-2 text-blue-600" />
              <h2 className="font-bold text-slate-700">Acumulado Mensual de Nómina</h2>
            </div>
            <p className="px-4 pt-3 text-xs text-slate-500">
              Suma TODAS las planillas ya calculadas de ese mes (regulares + mes extra), incluyendo el costo patronal adicional (lo que el colegio paga aparte del sueldo, no descontado al empleado) — así ves de un vistazo cuánto cuesta la nómina completa cada mes. Clic en un mes para desglosarlo por tipo de contratación.
            </p>
            {monthlySummary.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">Aún no hay planillas calculadas.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 font-semibold">MES</th>
                    <th className="px-4 py-3 font-semibold text-right">NETO A EMPLEADOS</th>
                    <th className="px-4 py-3 font-semibold text-right">COSTO PATRONAL</th>
                    <th className="px-4 py-3 font-semibold text-right">TOTAL DEL MES</th>
                    <th className="px-4 py-3 font-semibold text-right"># PLANILLAS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlySummary.map(m => (
                    <React.Fragment key={m.month}>
                      <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpandedMonth(expandedMonth === m.month ? null : m.month)}>
                        <td className="px-4 py-3 font-semibold">
                          {expandedMonth === m.month ? '▾ ' : '▸ '}{m.month}
                          {m.hasExtraMonth && <span className="ml-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">incl. mes extra</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">${m.netPay.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-500">${m.employerCost.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold">${m.grandTotal.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{m.runsCount}</td>
                      </tr>
                      {expandedMonth === m.month && (
                        <tr>
                          <td colSpan={5} className="bg-slate-50 px-4 py-3">
                            <table className="w-full text-xs">
                              <thead className="text-slate-500">
                                <tr>
                                  <th className="text-left font-semibold py-1">TIPO</th>
                                  <th className="text-right font-semibold py-1">EMPLEADOS</th>
                                  <th className="text-right font-semibold py-1">BRUTO</th>
                                  <th className="text-right font-semibold py-1">NETO</th>
                                  <th className="text-right font-semibold py-1">COSTO PATRONAL</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {(['local', 'expatriate', 'honorarios'] as const).map(type => {
                                  const t = m.byType[type];
                                  if (t.count === 0) return null;
                                  const label = type === 'local' ? 'Local' : type === 'expatriate' ? 'Expatriado' : 'Honorarios';
                                  return (
                                    <tr key={type}>
                                      <td className="py-1.5 font-semibold text-slate-700">{label}</td>
                                      <td className="py-1.5 text-right text-slate-500">{t.count}</td>
                                      <td className="py-1.5 text-right font-mono text-slate-500">${t.grossPay.toFixed(2)}</td>
                                      <td className="py-1.5 text-right font-mono">${t.netPay.toFixed(2)}</td>
                                      <td className="py-1.5 text-right font-mono text-slate-500">${t.employerCost.toFixed(2)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>

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
                  <label className="text-xs text-slate-400">Forma de pago</label>
                  <select
                    value={employeeForm.pay_type}
                    onChange={e => setEmployeeForm({ ...employeeForm, pay_type: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="monthly">Salario mensual fijo</option>
                    <option value="hourly">Por horas (sin dedicación exclusiva)</option>
                  </select>
                </div>
              </div>
              {employeeForm.pay_type === 'monthly' ? (
                <div>
                  <label className="text-xs text-slate-400">Salario base mensual</label>
                  <input
                    type="number" placeholder="0.00" value={employeeForm.base_salary}
                    onChange={e => setEmployeeForm({ ...employeeForm, base_salary: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400">Tarifa por hora</label>
                      <input
                        type="number" placeholder="0.00" value={employeeForm.hourly_rate}
                        onChange={e => setEmployeeForm({ ...employeeForm, hourly_rate: e.target.value })}
                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">% extra prep./corrección</label>
                      <input
                        type="number" placeholder="Ej. 30" value={employeeForm.hourly_prep_percent}
                        onChange={e => setEmployeeForm({ ...employeeForm, hourly_prep_percent: e.target.value })}
                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md p-2">
                    Las horas se calculan automáticamente del distributivo real del docente (Admin → Horarios). El trabajo de un docente no es solo la clase: si quieres compensar preparación y corrección de evaluaciones, súmalo aquí como % adicional sobre las horas de clase (ej. 30% = se pagan 1.3x las horas dictadas). Déjalo en 0 si solo quieres pagar horas de clase.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Tipo de contratación</label>
                  <select
                    value={employeeForm.employment_type}
                    onChange={e => setEmployeeForm({ ...employeeForm, employment_type: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="local">Local (planilla del país)</option>
                    <option value="expatriate">Expatriado (regla propia)</option>
                    <option value="honorarios">Honorarios Profesionales (sin deducciones)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">
                    {employeeForm.employment_type === 'honorarios' ? '% (no aplica)' : '% personalizado (opcional)'}
                  </label>
                  <input
                    type="number" placeholder="Usa el % del país" value={employeeForm.custom_employee_rate}
                    onChange={e => setEmployeeForm({ ...employeeForm, custom_employee_rate: e.target.value })}
                    disabled={employeeForm.employment_type === 'honorarios'}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>
              {employeeForm.employment_type === 'expatriate' && (
                <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md p-2">
                  El personal expatriado suele tener reglas de seguro social distintas a las del país; si conoces el % exacto de este empleado, ponlo arriba. Si lo dejas vacío, se calculará igual que el personal local.
                </p>
              )}
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
                    <th className="px-4 py-3 font-semibold">TIPO</th>
                    <th className="px-4 py-3 font-semibold">CONTRATADO</th>
                    <th className="px-4 py-3 font-semibold text-right">TARIFA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold">
                        {emp.profiles ? `${emp.profiles.first_name} ${emp.profiles.last_name}` : 'Sin perfil vinculado'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{emp.profiles?.role || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          emp.employment_type === 'honorarios' ? 'bg-slate-100 text-slate-600' :
                          emp.employment_type === 'expatriate' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {emp.employment_type === 'honorarios' ? 'Honorarios' : emp.employment_type === 'expatriate' ? 'Expatriado' : 'Local'}
                          {emp.custom_employee_rate !== null && emp.employment_type !== 'honorarios' ? ` (${emp.custom_employee_rate}%)` : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{emp.hire_date}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {emp.pay_type === 'hourly'
                          ? <>${Number(emp.hourly_rate || 0).toFixed(2)}/hora{!!emp.hourly_prep_percent && <span className="block text-xs text-slate-400">+{emp.hourly_prep_percent}% prep.</span>}</>
                          : <>${Number(emp.base_salary || 0).toFixed(2)}/mes</>}
                      </td>
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
                        <td className="px-4 py-3 text-right font-mono">
                          ${Number(p.gross_pay).toFixed(2)}
                          {p.hours_worked !== null && <span className="block text-xs text-slate-400">{p.hours_worked}h</span>}
                        </td>
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

      {/* Ausencias y Suplencias */}
      {activeTab === 'hr_leave' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
              <h2 className="font-bold text-slate-700 flex items-center"><CalendarOff className="w-4 h-4 mr-2 text-blue-600" /> Solicitar Vacaciones / Incapacidad</h2>
              <select
                value={leaveForm.employee_id}
                onChange={e => setLeaveForm({ ...leaveForm, employee_id: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona el empleado...</option>
                {hrLeaveEmployees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.profiles ? `${e.profiles.first_name} ${e.profiles.last_name}` : e.id} (saldo: {e.vacation_days_balance ?? 0} días)
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={leaveForm.leave_type}
                  onChange={e => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="vacation">Vacaciones</option>
                  <option value="sick">Incapacidad</option>
                  <option value="personal">Permiso personal</option>
                  <option value="other">Otro</option>
                </select>
                <input
                  type="number" placeholder="Días solicitados" value={leaveForm.days_requested}
                  onChange={e => setLeaveForm({ ...leaveForm, days_requested: e.target.value })}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date" value={leaveForm.start_date}
                  onChange={e => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="date" value={leaveForm.end_date}
                  onChange={e => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <input
                type="text" placeholder="Motivo (opcional)" value={leaveForm.reason}
                onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleCreateLeaveRequest}
                disabled={hrLeaveLoading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold text-sm"
              >
                {hrLeaveLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Solicitar
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
              <h2 className="font-bold text-slate-700 flex items-center"><UserCog className="w-4 h-4 mr-2 text-blue-600" /> Asignar Suplencia</h2>
              <p className="text-xs text-slate-500">Reasigna las clases de un docente ausente, un día específico, a un suplente. Se refleja automáticamente en las horas de planilla de ambos.</p>
              <select
                value={substituteForm.class_id}
                onChange={e => setSubstituteForm({ ...substituteForm, class_id: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona el grupo/clase...</option>
                {classOptions.map(c => (
                  <option key={c.id} value={c.id}>{c.courses?.name || c.name} — {c.name}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date" value={substituteForm.date}
                  onChange={e => setSubstituteForm({ ...substituteForm, date: e.target.value })}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={substituteForm.substitute_teacher_id}
                  onChange={e => setSubstituteForm({ ...substituteForm, substitute_teacher_id: e.target.value })}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Suplente...</option>
                  {hrLeaveStaffOptions.map(s => (
                    <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                  ))}
                </select>
              </div>
              <input
                type="text" placeholder="Notas (opcional)" value={substituteForm.notes}
                onChange={e => setSubstituteForm({ ...substituteForm, notes: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleCreateSubstituteAssignment}
                disabled={hrLeaveLoading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold text-sm"
              >
                {hrLeaveLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Asignar Suplencia
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <h2 className="font-bold text-slate-700">Solicitudes de Ausencia</h2>
            </div>
            {hrLeaveLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Cargando...
              </div>
            ) : leaveRequests.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">Aún no hay solicitudes de ausencia.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {leaveRequests.map(lr => (
                  <div key={lr.id} className="p-4 flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-semibold text-slate-700 text-sm">
                        {lr.hr_employees?.profiles ? `${lr.hr_employees.profiles.first_name} ${lr.hr_employees.profiles.last_name}` : 'Empleado'} — {lr.leave_type}
                      </p>
                      <p className="text-xs text-slate-400">
                        {lr.start_date} a {lr.end_date} · {lr.days_requested} días{lr.reason ? ` · ${lr.reason}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        lr.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        lr.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                      }`}>{lr.status}</span>
                      {lr.status === 'pending' && (
                        <>
                          <button onClick={() => handleDecideLeaveRequest(lr.id, 'approved')} className="text-xs font-bold text-emerald-600 hover:underline">Aprobar</button>
                          <button onClick={() => handleDecideLeaveRequest(lr.id, 'rejected')} className="text-xs font-bold text-rose-600 hover:underline">Rechazar</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <h2 className="font-bold text-slate-700">Saldo de Vacaciones por Empleado</h2>
            </div>
            {hrLeaveEmployees.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">Sin empleados dados de alta en nómina.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {hrLeaveEmployees.map(e => (
                  <div key={e.id} className="p-4 flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-semibold text-slate-700 text-sm">{e.profiles ? `${e.profiles.first_name} ${e.profiles.last_name}` : e.id}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Saldo actual: {e.vacation_days_balance ?? 0} días</span>
                      <input
                        type="number" placeholder="Ajustar saldo" defaultValue={e.vacation_days_balance ?? ''}
                        onChange={ev => setVacationBalanceDrafts({ ...vacationBalanceDrafts, [e.id]: ev.target.value })}
                        className="w-24 border border-slate-300 rounded-md px-2 py-1 text-xs"
                      />
                      <button
                        onClick={() => handleSaveVacationBalance(e.id)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <h2 className="font-bold text-slate-700">Suplencias Asignadas</h2>
            </div>
            {substituteAssignments.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">Aún no hay suplencias asignadas.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {substituteAssignments.map(s => (
                  <div key={s.id} className="p-4 flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-semibold text-slate-700 text-sm">{s.classes?.courses?.name || s.classes?.name} · {s.date}</p>
                      <p className="text-xs text-slate-400">
                        Titular: {s.original_teacher ? `${s.original_teacher.first_name} ${s.original_teacher.last_name}` : '—'} → Suplente: {s.substitute_teacher ? `${s.substitute_teacher.first_name} ${s.substitute_teacher.last_name}` : '—'}
                        {s.notes ? ` · ${s.notes}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteSubstituteAssignment(s.id)}
                      className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded"
                      title="Eliminar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reserva de Espacios (Facility Booking) */}
      {activeTab === 'facilities' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
              <h2 className="font-bold text-slate-700 flex items-center"><DoorOpen className="w-4 h-4 mr-2 text-blue-600" /> Registrar Espacio</h2>
              <input
                type="text" placeholder="Nombre (ej. Auditorio, Laboratorio de Ciencias)" value={facilityForm.name}
                onChange={e => setFacilityForm({ ...facilityForm, name: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text" placeholder="Categoría (opcional)" value={facilityForm.category}
                  onChange={e => setFacilityForm({ ...facilityForm, category: e.target.value })}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number" placeholder="Capacidad (opcional)" value={facilityForm.capacity}
                  onChange={e => setFacilityForm({ ...facilityForm, capacity: e.target.value })}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleCreateFacility}
                disabled={facilitiesLoading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold text-sm"
              >
                {facilitiesLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Registrar Espacio
              </button>

              {facilities.length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  {facilities.map(f => (
                    <div key={f.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-md px-3 py-1.5">
                      <span className="text-slate-600">{f.name} {f.category ? `(${f.category})` : ''} {f.capacity ? `· cap. ${f.capacity}` : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
              <h2 className="font-bold text-slate-700 flex items-center"><CalendarOff className="w-4 h-4 mr-2 text-blue-600" /> Reservar Espacio</h2>
              <select
                value={bookingForm.facility_id}
                onChange={e => setBookingForm({ ...bookingForm, facility_id: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona el espacio...</option>
                {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <input
                type="date" value={bookingForm.date}
                onChange={e => setBookingForm({ ...bookingForm, date: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="time" value={bookingForm.start_time}
                  onChange={e => setBookingForm({ ...bookingForm, start_time: e.target.value })}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="time" value={bookingForm.end_time}
                  onChange={e => setBookingForm({ ...bookingForm, end_time: e.target.value })}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <input
                type="text" placeholder="Motivo (opcional)" value={bookingForm.purpose}
                onChange={e => setBookingForm({ ...bookingForm, purpose: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleCreateBooking}
                disabled={facilitiesLoading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold text-sm"
              >
                {facilitiesLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Reservar
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <h2 className="font-bold text-slate-700">Reservas</h2>
            </div>
            {facilitiesLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Cargando...
              </div>
            ) : facilityBookings.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">Aún no hay reservas.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {facilityBookings.map(b => (
                  <div key={b.id} className="p-4 flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-semibold text-slate-700 text-sm">{b.facilities?.name} · {b.date} · {b.start_time}–{b.end_time}</p>
                      <p className="text-xs text-slate-400">
                        {b.profiles ? `${b.profiles.first_name} ${b.profiles.last_name}` : 'Staff'}{b.purpose ? ` · ${b.purpose}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCancelBooking(b.id)}
                      className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded"
                      title="Cancelar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Evaluación Docente 360° */}
      {activeTab === 'evaluations' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
            <h2 className="font-bold text-slate-700 flex items-center"><Star className="w-4 h-4 mr-2 text-blue-600" /> Ciclos de Evaluación</h2>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="text" placeholder="Nombre del ciclo (ej. Evaluación Anual 2026)" value={cycleForm.name}
                onChange={e => setCycleForm({ name: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[200px]"
              />
              <button
                onClick={handleCreateCycle}
                disabled={evaluationsLoading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold text-sm"
              >
                {evaluationsLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Crear Ciclo
              </button>
            </div>
            {evaluationCycles.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-slate-100">
                <select
                  value={selectedCycleId}
                  onChange={e => loadEvaluationSummaryForCycle(e.target.value)}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {evaluationCycles.map(c => <option key={c.id} value={c.id}>{c.name} {c.is_open ? '(abierto)' : '(cerrado)'}</option>)}
                </select>
                {evaluationCycles.find(c => c.id === selectedCycleId)?.is_open && (
                  <button
                    onClick={() => handleCloseCycle(selectedCycleId)}
                    className="text-xs font-bold text-rose-600 hover:text-rose-800"
                  >
                    Cerrar este ciclo
                  </button>
                )}
              </div>
            )}
          </div>

          {selectedCycleId && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
              <h2 className="font-bold text-slate-700 flex items-center"><UserCog className="w-4 h-4 mr-2 text-blue-600" /> Evaluación de Coordinación</h2>
              <p className="text-xs text-slate-500">Escala 1 (muy deficiente) a 5 (excelente) por dimensión.</p>
              <select
                value={evalForm.teacher_id}
                onChange={e => setEvalForm({ ...evalForm, teacher_id: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona el docente...</option>
                {staffOptions.filter(s => s.role === 'teacher').map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
              </select>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <label className="text-xs text-slate-500">
                  Enseñanza
                  <input
                    type="number" min={1} max={5} value={evalForm.score_teaching}
                    onChange={e => setEvalForm({ ...evalForm, score_teaching: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm mt-0.5"
                  />
                </label>
                <label className="text-xs text-slate-500">
                  Puntualidad
                  <input
                    type="number" min={1} max={5} value={evalForm.score_punctuality}
                    onChange={e => setEvalForm({ ...evalForm, score_punctuality: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm mt-0.5"
                  />
                </label>
                <label className="text-xs text-slate-500">
                  Comunicación
                  <input
                    type="number" min={1} max={5} value={evalForm.score_communication}
                    onChange={e => setEvalForm({ ...evalForm, score_communication: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm mt-0.5"
                  />
                </label>
                <label className="text-xs text-slate-500">
                  Equidad
                  <input
                    type="number" min={1} max={5} value={evalForm.score_fairness}
                    onChange={e => setEvalForm({ ...evalForm, score_fairness: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm mt-0.5"
                  />
                </label>
              </div>
              <input
                type="text" placeholder="Comentarios (opcional)" value={evalForm.comments}
                onChange={e => setEvalForm({ ...evalForm, comments: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSubmitCoordinationEvaluation}
                disabled={evaluationsLoading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold text-sm"
              >
                {evaluationsLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Registrar Evaluación
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <h2 className="font-bold text-slate-700">Puntaje de Desempeño por Docente</h2>
            </div>
            {evaluationSummary.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">Sin evaluaciones registradas todavía en este ciclo.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 font-semibold">DOCENTE</th>
                    <th className="px-4 py-3 font-semibold text-right">ALUMNOS (n)</th>
                    <th className="px-4 py-3 font-semibold text-right">COORDINACIÓN (n)</th>
                    <th className="px-4 py-3 font-semibold text-right">PUNTAJE GENERAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {evaluationSummary.map(row => (
                    <tr key={row.teacher_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-700">{row.teacher_name}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{row.student_average !== null ? `${row.student_average} (${row.student_responses})` : `— (0)`}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{row.coordination_average !== null ? `${row.coordination_average} (${row.coordination_responses})` : `— (0)`}</td>
                      <td className="px-4 py-3 text-right font-bold text-blue-600">{row.overall_average ?? '—'}</td>
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
