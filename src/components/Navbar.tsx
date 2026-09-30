import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Shield,
  QrCode,
  Users,
  PlusCircle,
  FileText,
  AlertTriangle,
  Building,
  LogOut,
  MapPin,
  ChevronDown,
  UserCheck,
  Box,
  Sparkles,
  Clock,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  openCreateModal: () => void;
  insideCount: number;
  pendingApprovalCount?: number;
  onOpenChatbot: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  openCreateModal,
  insideCount,
  pendingApprovalCount = 0,
  onOpenChatbot,
}) => {
  const { user, logout, loginAsDemo, gates, currentGate, switchGate } = useAuth();

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-purple-200">Admin</span>;
      case 'MANAGER':
        return <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-amber-200">Manager</span>;
      case 'RECEPTION':
        return <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-blue-200">Reception / HR</span>;
      case 'SECURITY':
        return <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-emerald-200">Security Gate Guard</span>;
      default:
        return null;
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-md border-b border-slate-800">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentTab(user?.role === 'SECURITY' ? 'scan' : 'dashboard')}>
            <div className="h-10 w-10 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-black shadow-inner">
              <Shield className="h-6 w-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">FactoryPass</span>
                <span className="text-[10px] uppercase font-bold tracking-widest bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-1.5 py-0.5 rounded">
                  Gate Security
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Feng Qun Manufacturing Complex</p>
            </div>
          </div>

          {/* Quick Gate Assignment & Switcher */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Gate Indicator */}
            <div className="relative group">
              <div className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 text-xs text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition">
                <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="font-medium truncate max-w-[120px] sm:max-w-[160px]">
                  {currentGate ? currentGate.gate_name : 'Select Gate'}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <div className="absolute right-0 mt-1 w-64 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-1.5 hidden group-hover:block z-50">
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700/60 mb-1">
                  Active Duty Station / Gate
                </div>
                {gates.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => switchGate(g.id)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-700 transition ${
                      currentGate?.id === g.id ? 'text-emerald-400 font-bold bg-slate-700/50' : 'text-slate-300'
                    }`}
                  >
                    <span>{g.gate_name}</span>
                    <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-1.5 py-0.5 rounded">{g.gate_code}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Emergency Live Indicator */}
            <button
              onClick={() => setCurrentTab('emergency')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition animate-none ${
                insideCount > 0
                  ? 'bg-amber-950/80 text-amber-300 border-amber-600 hover:bg-amber-900'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
              title="Click to view Emergency Headcount & Muster List"
            >
              <span className="relative flex h-2.5 w-2.5">
                {insideCount > 0 && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${insideCount > 0 ? 'bg-amber-500' : 'bg-slate-500'}`}></span>
              </span>
              <span>Inside: {insideCount}</span>
            </button>

            {/* Gemini AI Co-Pilot Button */}
            <button
              onClick={onOpenChatbot}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-900 transition shadow-sm cursor-pointer"
              title="Open Gemini AI Security Co-Pilot"
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">AI Co-Pilot</span>
            </button>

            {/* User Profile & Demo Switcher */}
            {user ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-xs font-semibold text-slate-200">{user.name}</span>
                  {getRoleBadge(user.role)}
                </div>
                <div className="relative group">
                  <button className="flex items-center gap-1.5 p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs border border-slate-700">
                    <UserCheck className="h-4 w-4 text-emerald-400" />
                    <span className="hidden sm:inline font-medium">Switch Role</span>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </button>
                  <div className="absolute right-0 mt-1 w-56 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-2 hidden group-hover:block z-50">
                    <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700 mb-1">
                      One-Click Demo Switcher
                    </div>
                    <button
                      onClick={() => loginAsDemo('SECURITY')}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-700 ${
                        user.role === 'SECURITY' ? 'text-emerald-400 font-bold bg-slate-700/50' : 'text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="font-semibold">Security Guard</div>
                        <div className="text-[10px] text-slate-400">Scan QR & Record Entry/Exit</div>
                      </div>
                      <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded">Guard</span>
                    </button>
                    <button
                      onClick={() => loginAsDemo('ADMIN')}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-700 ${
                        user.role === 'ADMIN' ? 'text-purple-400 font-bold bg-slate-700/50' : 'text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="font-semibold">Admin</div>
                        <div className="text-[10px] text-slate-400">All permissions & reports</div>
                      </div>
                      <span className="text-[10px] bg-purple-950 text-purple-400 px-1.5 py-0.5 rounded">Admin</span>
                    </button>
                    <button
                      onClick={() => loginAsDemo('MANAGER')}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-700 ${
                        user.role === 'MANAGER' ? 'text-amber-400 font-bold bg-slate-700/50' : 'text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="font-semibold">Department Manager</div>
                        <div className="text-[10px] text-slate-400">Approve passes & audits</div>
                      </div>
                      <span className="text-[10px] bg-amber-950 text-amber-400 px-1.5 py-0.5 rounded">Manager</span>
                    </button>
                    <button
                      onClick={() => loginAsDemo('RECEPTION')}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-700 ${
                        user.role === 'RECEPTION' ? 'text-blue-400 font-bold bg-slate-700/50' : 'text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="font-semibold">Reception / HR</div>
                        <div className="text-[10px] text-slate-400">Create & manage passes</div>
                      </div>
                      <span className="text-[10px] bg-blue-950 text-blue-400 px-1.5 py-0.5 rounded">Staff</span>
                    </button>
                    <div className="border-t border-slate-700 my-1 pt-1">
                      <button
                        onClick={logout}
                        className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-slate-700 flex items-center gap-2"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Log out
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-2 border-t border-slate-800 text-xs sm:text-sm scrollbar-none">
          {/* Scan QR Code tab: High-visibility button for security */}
          <button
            onClick={() => setCurrentTab('scan')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold transition whitespace-nowrap ${
              currentTab === 'scan'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                : 'bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-700'
            }`}
          >
            <QrCode className="h-4 w-4" />
            <span>Scan Visitor QR</span>
          </button>

          {user?.role !== 'SECURITY' && (
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                currentTab === 'dashboard'
                  ? 'bg-slate-800 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Dashboard</span>
            </button>
          )}

          {user?.role !== 'SECURITY' && (
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium bg-blue-600 hover:bg-blue-500 text-white transition whitespace-nowrap shadow-sm"
            >
              <PlusCircle className="h-4 w-4" />
              <span>+ Create Visitor Pass</span>
            </button>
          )}

          <button
            onClick={() => setCurrentTab('passes')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition whitespace-nowrap ${
              currentTab === 'passes'
                ? 'bg-slate-800 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>All Visitor Passes</span>
          </button>

          {/* Approvals Dashboard Tab */}
          <button
            onClick={() => setCurrentTab('approvals')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition whitespace-nowrap ${
              currentTab === 'approvals'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500 font-bold'
                : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800/60'
            }`}
          >
            <Clock className="h-4 w-4 text-amber-400" />
            <span>Approvals</span>
            {(pendingApprovalCount ?? 0) > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-black leading-none text-slate-950 bg-amber-400 rounded-full animate-pulse shadow-sm">
                {pendingApprovalCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setCurrentTab('emergency')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition whitespace-nowrap ${
              currentTab === 'emergency'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500 font-bold'
                : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800/60'
            }`}
          >
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span>Currently Inside ({insideCount})</span>
          </button>

          {user?.role !== 'SECURITY' && (
            <button
              onClick={() => setCurrentTab('reports')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                currentTab === 'reports'
                  ? 'bg-slate-800 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Reports</span>
            </button>
          )}

          {user?.role === 'ADMIN' && (
            <button
              onClick={() => setCurrentTab('gates-audit')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                currentTab === 'gates-audit'
                  ? 'bg-slate-800 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Building className="h-4 w-4" />
              <span>Gates & Audit Trail</span>
            </button>
          )}

          <button
            onClick={() => setCurrentTab('nextjs-hub')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition whitespace-nowrap ${
              currentTab === 'nextjs-hub'
                ? 'bg-slate-800 text-emerald-400 font-bold border border-emerald-500/40'
                : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800/60'
            }`}
          >
            <Box className="h-4 w-4 text-emerald-400" />
            <span>Next.js & Node.js Suite</span>
          </button>
        </div>
      </div>
    </header>
  );
};
