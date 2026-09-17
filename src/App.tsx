import React, { useState } from "react";
import { Network, Database, Globe, Layers, Users, Cpu, ShieldCheck, HelpCircle, Server, FileCode, CheckCircle2, UserCircle, Briefcase, GraduationCap, ClipboardList } from "lucide-react";
import ArchitectureVisualizer from "./components/ArchitectureVisualizer";
import DatabaseSchemaExplorer from "./components/DatabaseSchemaExplorer";
import APIPlayground from "./components/APIPlayground";
import ModuleBlueprint from "./components/ModuleBlueprint";
import PortalPreviews from "./components/PortalPreviews";
import AIAdvisor from "./components/AIAdvisor";
import { TeacherPortal } from "./portals/TeacherPortal";
import { CorporatePortal } from "./portals/CorporatePortal";
import { ParentStudentPortal } from "./portals/ParentStudentPortal";
import { AdmissionsPortal } from "./portals/AdmissionsPortal";

type TabId = "diagram" | "database" | "api" | "modules" | "portals" | "ai_advisor" | "teacher_real" | "corporate_real" | "parent_real" | "admissions_real";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("diagram");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* App Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-[0_0_15px_rgba(99,102,241,0.25)]">
              <Server className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-100 flex items-center gap-2">
                SIS & ERP Académico: Software Architect Workbench
              </h1>
              <p className="text-xs text-slate-400">
                Consola de diseño arquitectónico, diccionario de datos relacionales y sandbox de integración externa API-First.
              </p>
            </div>
          </div>

          {/* Quick Stats / Environment badges */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="text-[10px] font-mono font-bold text-slate-400">STATUS: INTEROPERABLE</span>
            </div>
            <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">GDPR / FERPA READY</span>
            </div>
          </div>

        </div>
      </header>

      {/* Main Workspace Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6">
        
        {/* Navigation Tabs bar */}
        <div className="flex overflow-x-auto gap-2 bg-slate-900/40 p-1 rounded-xl border border-slate-800 shrink-0 select-none scrollbar-none">
          <button
            onClick={() => setActiveTab("diagram")}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all duration-200 shrink-0 cursor-pointer ${
              activeTab === "diagram"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/15"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Network className="w-4 h-4" />
            Diagrama
          </button>
          
          {/* New Portal Real */}
          <button
            onClick={() => setActiveTab("teacher_real")}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all duration-200 shrink-0 cursor-pointer ${
              activeTab === "teacher_real"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/15"
                : "text-emerald-400 hover:text-emerald-200 hover:bg-slate-800/40 border border-emerald-900/30"
            }`}
          >
            <UserCircle className="w-4 h-4" />
            VER PORTAL DOCENTE
          </button>

          {/* Corporate ERP Portal */}
          <button
            onClick={() => setActiveTab("corporate_real")}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all duration-200 shrink-0 cursor-pointer ${
              activeTab === "corporate_real"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/15"
                : "text-blue-400 hover:text-blue-200 hover:bg-slate-800/40 border border-blue-900/30"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            VER PORTAL ERP
          </button>

          {/* Parent / Student Portal */}
          <button
            onClick={() => setActiveTab("parent_real")}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all duration-200 shrink-0 cursor-pointer ${
              activeTab === "parent_real"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/15"
                : "text-purple-400 hover:text-purple-200 hover:bg-slate-800/40 border border-purple-900/30"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            VER PORTAL PADRES
          </button>

          {/* Admissions Portal */}
          <button
            onClick={() => setActiveTab("admissions_real")}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all duration-200 shrink-0 cursor-pointer ${
              activeTab === "admissions_real"
                ? "bg-teal-600 text-white shadow-lg shadow-teal-600/15"
                : "text-teal-400 hover:text-teal-200 hover:bg-slate-800/40 border border-teal-900/30"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            VER PORTAL ADMISIONES
          </button>

          <button
            onClick={() => setActiveTab("database")}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all duration-200 shrink-0 cursor-pointer ${
              activeTab === "database"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/15"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Database className="w-4 h-4" />
            Base de Datos
          </button>
          <button
            onClick={() => setActiveTab("api")}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all duration-200 shrink-0 cursor-pointer ${
              activeTab === "api"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/15"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Globe className="w-4 h-4" />
            Sandbox API
          </button>
          <button
            onClick={() => setActiveTab("portals")}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all duration-200 shrink-0 cursor-pointer ${
              activeTab === "portals"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/15"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Users className="w-4 h-4" />
            Mockups
          </button>
        </div>

        {/* Workspace Active Area */}
        <div className="flex-1 bg-slate-950 rounded-2xl min-h-[500px]">
          {activeTab === "diagram" && <ArchitectureVisualizer />}
          {activeTab === "database" && <DatabaseSchemaExplorer />}
          {activeTab === "api" && <APIPlayground />}
          {activeTab === "modules" && <ModuleBlueprint />}
          {activeTab === "portals" && <PortalPreviews />}
          {activeTab === "ai_advisor" && <AIAdvisor />}
          {activeTab === "teacher_real" && (
            <div className="bg-slate-100 rounded-xl overflow-hidden min-h-[600px]">
              <TeacherPortal />
            </div>
          )}
          {activeTab === "corporate_real" && (
            <div className="bg-slate-50 rounded-xl overflow-hidden min-h-[600px]">
              <CorporatePortal />
            </div>
          )}
          {activeTab === "parent_real" && (
            <div className="bg-slate-50 rounded-xl overflow-hidden min-h-[600px]">
              <ParentStudentPortal />
            </div>
          )}
          {activeTab === "admissions_real" && (
            <div className="bg-slate-50 rounded-xl overflow-hidden min-h-[600px]">
              <AdmissionsPortal />
            </div>
          )}
        </div>

        {/* Compliance & Standards Footer Banner */}
        <footer className="border-t border-slate-900 pt-6 mt-4 grid grid-cols-1 md:grid-cols-3 gap-5 text-xs text-slate-500 shrink-0">
          <div className="flex gap-2">
            <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0" />
            <div>
              <h5 className="font-bold text-slate-400">Arquitectura API-First y LTI 1.3</h5>
              <p className="mt-0.5 leading-normal text-[11px]">
                Diseñado para interoperabilidad con Canvas, Google Classroom y Moodle usando Learning Tools Interoperability (LTI 1.3), garantizando seguridad y sincronización sin roces.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0" />
            <div>
              <h5 className="font-bold text-slate-400">Cumplimiento GDPR & Leyes Educativas</h5>
              <p className="mt-0.5 leading-normal text-[11px]">
                Cifrado estricto de expedientes académicos vivos, registro inmutable de bitácoras disciplinarias y control RBAC granular para resguardar la privacidad familiar.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0" />
            <div>
              <h5 className="font-bold text-slate-400">Automatización Académica y Retención</h5>
              <p className="mt-0.5 leading-normal text-[11px]">
                Integra algoritmos de detección precoz de deserción escolar basados en inasistencias reiteradas y emisión masiva de títulos con códigos QR oficiales.
              </p>
            </div>
          </div>
        </footer>

      </main>
    </div>
  );
}
