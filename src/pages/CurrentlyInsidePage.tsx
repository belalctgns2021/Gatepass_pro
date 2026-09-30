import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { formatTime } from '../utils/qr.ts';
import {
  AlertTriangle,
  Users,
  Printer,
  Search,
  CheckCircle,
  Phone,
  Building,
  MapPin,
  Clock,
  Car,
  ShieldAlert,
  RefreshCw,
  UserCheck,
} from 'lucide-react';

interface InsideVisitor {
  pass_id: string;
  pass_number: string;
  host_name: string;
  host_department: string;
  purpose: string;
  vehicle_type?: string;
  vehicle_number?: string;
  number_of_visitors: number;
  qr_token: string;
  visitor_id: string;
  visitor_name: string;
  visitor_mobile: string;
  visitor_company?: string;
  designation?: string;
  photo?: string;
  entry_time?: string;
  entry_gate?: string;
  checked_in_by?: string;
}

export const CurrentlyInsidePage: React.FC = () => {
  const { token } = useAuth();
  const [visitors, setVisitors] = useState<InsideVisitor[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [emergencyMode, setEmergencyMode] = useState<boolean>(false);
  const [accountedIds, setAccountedIds] = useState<Record<string, boolean>>({});

  const fetchInsideVisitors = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await fetch('/api/currently-inside', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setVisitors(data.visitors || []);
      }
    } catch (err) {
      console.error('Failed to load currently inside visitors:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInsideVisitors();
    const interval = setInterval(fetchInsideVisitors, 10000); // Live poll every 10s
    return () => clearInterval(interval);
  }, [token]);

  const filteredVisitors = visitors.filter((v) => {
    const q = search.toLowerCase();
    return (
      v.visitor_name.toLowerCase().includes(q) ||
      (v.visitor_company && v.visitor_company.toLowerCase().includes(q)) ||
      v.host_name.toLowerCase().includes(q) ||
      v.host_department.toLowerCase().includes(q) ||
      v.pass_number.toLowerCase().includes(q)
    );
  });

  const toggleAccounted = (passId: string) => {
    setAccountedIds((prev) => ({
      ...prev,
      [passId]: !prev[passId],
    }));
  };

  const handlePrintMusterList = () => {
    window.print();
  };

  const accountedCount = Object.values(accountedIds).filter(Boolean).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Emergency Toggle & Header */}
      <div
        className={`rounded-3xl p-6 sm:p-8 transition-all ${
          emergencyMode
            ? 'bg-rose-950 text-white border-4 border-rose-600 shadow-2xl animate-pulse-slow'
            : 'bg-slate-900 text-white shadow-xl border border-slate-800'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full ${
                  emergencyMode
                    ? 'bg-rose-600 text-white animate-bounce'
                    : 'bg-amber-950 text-amber-300 border border-amber-800'
                }`}
              >
                {emergencyMode ? 'EMERGENCY PROTOCOL ACTIVE' : 'LIVE HEADCOUNT ROSTER'}
              </span>
              <span className="text-xs text-slate-400 font-mono">Updated just now</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              {emergencyMode ? (
                <>
                  <ShieldAlert className="h-9 w-9 text-rose-400 animate-pulse" />
                  <span>EMERGENCY — PEOPLE CURRENTLY INSIDE</span>
                </>
              ) : (
                <>
                  <Users className="h-8 w-8 text-amber-400" />
                  <span>CURRENTLY INSIDE FACTORY</span>
                </>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              {emergencyMode
                ? 'Official emergency evacuation muster list. Account for every visitor at safe assembly points.'
                : 'Live manifest of all non-employee guests, contractors, and visitors currently within facility grounds.'}
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setEmergencyMode(!emergencyMode)}
              className={`px-4 py-2.5 text-xs font-black rounded-xl transition shadow flex items-center gap-1.5 ${
                emergencyMode
                  ? 'bg-white text-rose-950 hover:bg-slate-100 font-extrabold'
                  : 'bg-rose-700 hover:bg-rose-600 text-white'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              <span>{emergencyMode ? 'Exit Emergency Mode' : 'Trigger Emergency View'}</span>
            </button>

            <button
              onClick={handlePrintMusterList}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition flex items-center gap-1.5 shadow"
            >
              <Printer className="h-4 w-4 text-emerald-400" />
              <span>Print Muster List</span>
            </button>

            <button
              onClick={fetchInsideVisitors}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Headcount Metrics Strip */}
        <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
          <div className="bg-black/30 p-4 rounded-2xl border border-white/10">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
              Total Visitors Inside
            </span>
            <span className="text-3xl font-black text-amber-400 mt-0.5 block">{visitors.length}</span>
          </div>

          <div className="bg-black/30 p-4 rounded-2xl border border-white/10">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
              Assembly Muster Check
            </span>
            <span className="text-3xl font-black text-emerald-400 mt-0.5 block">
              {accountedCount} / {visitors.length}
            </span>
          </div>

          <div className="bg-black/30 p-4 rounded-2xl border border-white/10">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
              Unaccounted Guests
            </span>
            <span className="text-3xl font-black text-rose-400 mt-0.5 block">
              {visitors.length - accountedCount}
            </span>
          </div>

          <div className="bg-black/30 p-4 rounded-2xl border border-white/10">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
              Assembly Point Contact
            </span>
            <span className="text-sm font-black text-white mt-1.5 block">Gate 1 Assembly Area A</span>
          </div>
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search inside visitors by name, company, host, or pass #..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="text-xs font-semibold text-slate-500">
          Showing <span className="text-slate-900 font-bold">{filteredVisitors.length}</span> active visitors
        </div>
      </div>

      {/* Visitor Cards / Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
              <tr>
                {emergencyMode && <th className="px-4 py-3.5 text-center">Muster Check</th>}
                <th className="px-4 py-3.5">#</th>
                <th className="px-4 py-3.5">Visitor</th>
                <th className="px-4 py-3.5">Company</th>
                <th className="px-4 py-3.5">Host & Department</th>
                <th className="px-4 py-3.5">Entry Time</th>
                <th className="px-4 py-3.5">Gate</th>
                <th className="px-4 py-3.5">Contact / Mobile</th>
                <th className="px-4 py-3.5">Pass No</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredVisitors.length > 0 ? (
                filteredVisitors.map((v, idx) => {
                  const isAccounted = accountedIds[v.pass_id];
                  return (
                    <tr
                      key={v.pass_id}
                      className={`hover:bg-slate-50 transition ${
                        isAccounted ? 'bg-emerald-50/60' : emergencyMode ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      {emergencyMode && (
                        <td className="px-4 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={!!isAccounted}
                            onChange={() => toggleAccounted(v.pass_id)}
                            className="h-5 w-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3.5 font-bold text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3.5">
                        <div className="font-extrabold text-slate-900 text-sm">{v.visitor_name}</div>
                        {v.designation && <div className="text-[11px] text-slate-500">{v.designation}</div>}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-slate-800">{v.visitor_company || 'Independent'}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{v.host_name}</div>
                        <div className="text-[11px] text-slate-500">{v.host_department}</div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {formatTime(v.entry_time)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap font-medium text-slate-800">
                        {v.entry_gate || 'Main Gate'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono text-slate-700">
                        <a href={`tel:${v.visitor_mobile}`} className="hover:text-emerald-600 flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <span>{v.visitor_mobile}</span>
                        </a>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-500 whitespace-nowrap">
                        <span className="bg-slate-100 px-2 py-0.5 rounded font-bold">{v.pass_number}</span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={emergencyMode ? 9 : 8} className="px-4 py-12 text-center text-slate-400">
                    <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                    <p className="text-sm font-bold text-slate-700">No visitors currently inside the factory</p>
                    <p className="text-xs text-slate-400 mt-1">All visitors have either exited or not entered yet.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
