import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { VisitorPass, DashboardStats } from '../types.ts';
import { formatDate, formatTime } from '../utils/qr.ts';
import {
  Users,
  Building,
  UserCheck,
  UserMinus,
  PlusCircle,
  QrCode,
  Eye,
  ExternalLink,
  ArrowUpRight,
  TrendingUp,
  MapPin,
  RefreshCw,
  Search,
  Clock,
  CheckCircle,
} from 'lucide-react';

interface DashboardPageProps {
  onOpenCreate: () => void;
  onSelectPass: (pass: VisitorPass) => void;
  onNavigateToScan: () => void;
  onNavigateToEmergency: () => void;
  onNavigateToApprovals: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onOpenCreate,
  onSelectPass,
  onNavigateToScan,
  onNavigateToEmergency,
  onNavigateToApprovals,
}) => {
  const { token, user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    todayVisitors: 0,
    currentlyInside: 0,
    expectedToday: 0,
    exitedToday: 0,
  });
  const [recentPasses, setRecentPasses] = useState<VisitorPass[]>([]);
  const [gateActivity, setGateActivity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchDashboardData = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await fetch('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setRecentPasses(data.recentPasses || []);
        setGateActivity(data.gateActivity || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full text-xs font-black">
            <Clock className="h-3 w-3 text-amber-600 animate-spin" />
            PENDING APPROVAL
          </span>
        );
      case 'INSIDE':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-500 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            INSIDE
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">
            ACTIVE
          </span>
        );
      case 'EXITED':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-500 border border-blue-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">
            EXITED
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-0.5 rounded-full text-xs font-black">
            REJECTED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-500 border border-rose-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">
            CANCELLED
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 bg-slate-500/10 text-slate-500 border border-slate-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">
            EXPIRED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Factory Visitor Management</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Real-time gate pass operations, visitor screening, and security clearance
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboardData}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            title="Refresh Stats"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onNavigateToScan}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
          >
            <QrCode className="h-4 w-4" />
            <span>Scan QR Pass</span>
          </button>

          {user?.role !== 'SECURITY' && (
            <button
              onClick={onOpenCreate}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
            >
              <PlusCircle className="h-4 w-4 text-emerald-400" />
              <span>Create Visitor Pass</span>
            </button>
          )}
        </div>
      </div>

      {/* Metric Stat Cards (Section 10) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Today's Visitors */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Today's Visitors</span>
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-3xl font-black text-slate-900">{stats.todayVisitors}</div>
          <div className="text-[11px] text-slate-500 mt-1">Total registered for today</div>
          <div className="absolute -bottom-2 -right-2 h-16 w-16 bg-blue-50 rounded-full opacity-60 pointer-events-none"></div>
        </div>

        {/* Currently Inside (Urgent / High Priority) */}
        <div
          onClick={onNavigateToEmergency}
          className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-amber-300 shadow-sm relative overflow-hidden cursor-pointer hover:border-amber-400 transition"
        >
          <div className="flex items-center justify-between text-amber-700 text-xs font-bold uppercase tracking-wider mb-2">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
              Currently Inside
            </span>
            <UserCheck className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-3xl font-black text-amber-600">{stats.currentlyInside}</div>
          <div className="text-[11px] text-amber-800 font-medium mt-1 flex items-center gap-1">
            <span>Headcount View</span>
            <ArrowUpRight className="h-3 w-3" />
          </div>
          <div className="absolute -bottom-2 -right-2 h-16 w-16 bg-amber-50 rounded-full opacity-60 pointer-events-none"></div>
        </div>

        {/* Pending Approval (Actionable / Priority) */}
        <div
          onClick={onNavigateToApprovals}
          className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-amber-400 shadow-sm relative overflow-hidden cursor-pointer hover:border-amber-500 hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between text-amber-800 text-xs font-bold uppercase tracking-wider mb-2">
            <span className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full bg-amber-500 ${(stats.pendingApproval ?? 0) > 0 ? 'animate-ping' : ''}`}></span>
              Pending Approval
            </span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-3xl font-black text-amber-600">{stats.pendingApproval ?? 0}</div>
          <div className="text-[11px] text-amber-800 font-bold mt-1 flex items-center gap-1 group-hover:underline">
            <span>Review Passes</span>
            <ArrowUpRight className="h-3 w-3" />
          </div>
          <div className="absolute -bottom-2 -right-2 h-16 w-16 bg-amber-100/60 rounded-full pointer-events-none"></div>
        </div>

        {/* Expected Today */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Expected Today</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-slate-900">{stats.expectedToday}</div>
          <div className="text-[11px] text-slate-500 mt-1">Pending arrival at gates</div>
          <div className="absolute -bottom-2 -right-2 h-16 w-16 bg-emerald-50 rounded-full opacity-60 pointer-events-none"></div>
        </div>

        {/* Exited Today */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Exited Today</span>
            <UserMinus className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-3xl font-black text-slate-900">{stats.exitedToday}</div>
          <div className="text-[11px] text-slate-500 mt-1">Visits completed & cleared</div>
          <div className="absolute -bottom-2 -right-2 h-16 w-16 bg-purple-50 rounded-full opacity-60 pointer-events-none"></div>
        </div>
      </div>

      {/* Pending Manager / Admin Approval Alert Banner */}
      {(stats.pendingApproval ?? 0) > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-900">
                  {stats.pendingApproval} Visitor Pass{(stats.pendingApproval ?? 0) > 1 ? 'es' : ''} Awaiting Approval
                </span>
                <span className="text-[10px] font-bold uppercase bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                  Action Required
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Department Managers or Administrators must review and grant approval before visitors can clear gate turnstiles.
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateToApprovals}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl shadow transition self-start sm:self-auto cursor-pointer flex items-center gap-1.5"
          >
            <span>Review & Authorize ({stats.pendingApproval})</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Grid: Recent Passes & Gate Throughput */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Visitors Table (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Visitors & Passes</h2>
              <p className="text-xs text-slate-500">Latest gate passes created or updated</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">Pass No</th>
                  <th className="px-4 py-3">Visitor</th>
                  <th className="px-4 py-3">Host & Dept</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {recentPasses.length > 0 ? (
                  recentPasses.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {p.pass_number}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{p.visitor_name}</div>
                        <div className="text-[11px] text-slate-500">{p.visitor_company || 'Individual'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{p.host_name}</div>
                        <div className="text-[11px] text-slate-500">{p.host_department}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{getStatusBadge(p.status)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => onSelectPass(p)}
                          className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg transition inline-flex items-center gap-1"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-600" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No visitor passes found. Create your first visitor gate pass.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Gate Activity & Live Summary (1 col) */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-base font-bold text-slate-900 mb-1">Factory Gate Throughput</h3>
            <p className="text-xs text-slate-500 mb-4">Today's entries and exits by station</p>

            <div className="space-y-3">
              {gateActivity.map((gate) => (
                <div key={gate.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>{gate.gate_name}</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{gate.gate_code}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="bg-emerald-50 text-emerald-800 p-1.5 rounded-lg border border-emerald-100">
                      <span className="block text-[10px] font-semibold uppercase">Entries</span>
                      <span className="text-sm font-black">{gate.entries || 0}</span>
                    </div>
                    <div className="bg-blue-50 text-blue-800 p-1.5 rounded-lg border border-blue-100">
                      <span className="block text-[10px] font-semibold uppercase">Exits</span>
                      <span className="text-sm font-black">{gate.exits || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Security Protocol Box */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm border border-slate-800 text-xs space-y-2">
            <h4 className="font-extrabold text-sm text-emerald-400">Factory Safety & Security Protocol</h4>
            <p className="text-slate-300 leading-relaxed">
              All contractors and guests must possess an ACTIVE gate pass. High-visibility vests and safety footwear are mandatory within warehouse sectors.
            </p>
            <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between">
              <span>Security Hot-Line</span>
              <span className="font-bold text-white">Ext. 9901 / Gate 1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
