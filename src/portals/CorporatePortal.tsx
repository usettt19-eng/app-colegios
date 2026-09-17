import React, { useState } from 'react';
import { Package, Monitor, Briefcase, TrendingDown, Plus, CheckCircle, Search, Laptop, PenTool, HardDrive } from 'lucide-react';

const MOCK_ASSETS = [
  { id: '1', tag: 'IT-2026-001', name: 'MacBook Air M2', condition: 'Nuevo', assignedTo: 'Sin asignar' },
  { id: '2', tag: 'IT-2026-002', name: 'Proyector Epson', condition: 'Bueno', assignedTo: 'Prof. Carlos Ruiz' },
];

const MOCK_CONSUMABLES = [
  { id: '1', name: 'Resma Papel A4', stock: 45, unitCost: 4.50 },
  { id: '2', name: 'Marcadores Pizarra (Caja)', stock: 12, unitCost: 8.00 },
  { id: '3', name: 'Tinta Impresora Negra', stock: 3, unitCost: 25.00 }, // Low stock
];

export const CorporatePortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'assets' | 'consumables'>('assets');
  const [message, setMessage] = useState('');

  const handleAssignAsset = async (tag: string) => {
    // Simulando llamada a /api/v1/corporate/assets/assign
    setMessage(`✅ Equipo ${tag} asignado correctamente a Prof. Ana Gómez.`);
    setTimeout(() => setMessage(''), 4000);
  };

  const handleDispatchConsumable = async (name: string, cost: number) => {
    // Simulando llamada a /api/v1/corporate/consumables/dispatch
    setMessage(`📦 Se descontó 1 unidad de ${name}. Cargo de $${cost.toFixed(2)} registrado al Depto. de Ciencias.`);
    setTimeout(() => setMessage(''), 4000);
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
      </div>

      {/* Activos IT */}
      {activeTab === 'assets' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input type="text" placeholder="Buscar placa (ej: IT-2026-001)" className="pl-9 pr-4 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-64" />
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm font-semibold flex items-center">
              <Plus className="w-4 h-4 mr-1" /> Registrar Nuevo Activo
            </button>
          </div>
          
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
              {MOCK_ASSETS.map((asset) => (
                <tr key={asset.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-bold text-slate-600">{asset.tag}</td>
                  <td className="px-4 py-3 flex items-center gap-2">
                    {asset.name.includes('MacBook') ? <Laptop className="w-4 h-4 text-slate-400" /> : <HardDrive className="w-4 h-4 text-slate-400" />}
                    {asset.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">{asset.condition}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{asset.assignedTo}</td>
                  <td className="px-4 py-3 text-right">
                    {asset.assignedTo === 'Sin asignar' && (
                      <button 
                        onClick={() => handleAssignAsset(asset.tag)}
                        className="text-blue-600 font-bold hover:text-blue-800 bg-blue-50 px-3 py-1 rounded"
                      >
                        Asignar al Staff
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Consumibles */}
      {activeTab === 'consumables' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
             <h2 className="font-bold text-slate-700 flex items-center"><TrendingDown className="w-4 h-4 mr-2 text-rose-500" /> Centro de Costos / Egresos de Bodega</h2>
          </div>
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
              {MOCK_CONSUMABLES.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 flex items-center gap-2">
                    <PenTool className="w-4 h-4 text-slate-400" />
                    <span className="font-medium">{item.name}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">${item.unitCost.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.stock <= 5 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {item.stock} unidades {item.stock <= 5 && '(¡Bajo!)'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button 
                      onClick={() => handleDispatchConsumable(item.name, item.unitCost)}
                      className="text-indigo-600 font-bold hover:text-indigo-800 bg-indigo-50 px-3 py-1 rounded border border-indigo-200"
                    >
                      Despachar 1 ud.
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};
