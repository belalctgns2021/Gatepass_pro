import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Gate } from '../types.ts';
import { formatDateTime } from '../utils/qr.ts';
import {
  Building,
  Shield,
  PlusCircle,
  History,
  MapPin,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

export const GatesAndAuditPage: React.FC = () => {
  const { token, gates, fetchGates } = useAuth();
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(true);

  // New Gate Form state
  const [isAddingGate, setIsAddingGate] = useState<boolean>(false);
  const [gateName, setGateName] = useState<string>('');
  const [gateCode, setGateCode] = useState<string>('');
  const [gateError, setGateError] = useState<string>('');
  const [isSubmittingGate, setIsSubmittingGate] = useState<boolean>(false);

  const fetchAuditLogs = async () => {
    if (!token) return;
    try {
      setIsLoadingAudit(true);
      const res = await fetch('/api/audit-logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [token]);

  const handleCreateGate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gateName.trim() || !gateCode.trim()) return;
    setIsSubmittingGate(true);
    setGateError('');
    try {
      const res = await fetch('/api/gates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ gate_name: gateName, gate_code: gateCode }),
      });
      if (res.ok) {
        setGateName('');
        setGateCode('');
        setGateError('');
        setIsAddingGate(false);
        await fetchGates();
        fetchAuditLogs();
      } else {
        const err = await res.json();
        setGateError(err.error || 'Failed to create gate');
      }
    } catch (err: any) {
      setGateError(err.message || 'Error creating gate');
    } finally {
      setIsSubmittingGate(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Factory Gates & Audit Logs</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Security post administration and tamper-evident event audit trail
        </p>
      </div>

      {/* SECTION 1: GATES MANAGEMENT */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-emerald-600" />
              <span>Factory Checkpoints & Security Gates</span>
            </h2>
            <p className="text-xs text-slate-500">Configured entry/exit points across factory perimeter</p>
          </div>

          <button
            onClick={() => setIsAddingGate(!isAddingGate)}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
          >
            <PlusCircle className="h-3.5 w-3.5 text-emerald-400" />
            <span>Add New Gate</span>
          </button>
        </div>

        {/* Add Gate Form */}
        {isAddingGate && (
          <form onSubmit={handleCreateGate} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-wrap gap-3 items-end text-xs">
            {gateError && (
              <div className="w-full p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-semibold">
                {gateError}
              </div>
            )}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Gate Name / Station</label>
              <input
                type="text"
                required
                value={gateName}
                onChange={(e) => setGateName(e.target.value)}
                placeholder="e.g. East Contractor Gate"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="w-36">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Gate Code</label>
              <input
                type="text"
                required
                value={gateCode}
                onChange={(e) => setGateCode(e.target.value)}
                placeholder="GATE-05"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmittingGate}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition"
              >
                {isSubmittingGate ? 'Saving...' : 'Save Gate'}
              </button>
              <button
                type="button"
                onClick={() => setIsAddingGate(false)}
                className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Gates Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {gates.map((g) => (
            <div key={g.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 relative">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-black bg-slate-900 text-emerald-400 px-2 py-0.5 rounded">
                  {g.gate_code}
                </span>
                <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  {g.status}
                </span>
              </div>
              <h3 className="font-black text-sm text-slate-900">{g.gate_name}</h3>
              <p className="text-[11px] text-slate-500 mt-1">Active verification station</p>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: AUDIT TRAIL */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <History className="h-5 w-5 text-purple-600" />
              <span>Immutable System Audit Trail</span>
            </h2>
            <p className="text-xs text-slate-500">Security actions, pass generation, gate records, and user sessions</p>
          </div>
          <button
            onClick={fetchAuditLogs}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingAudit ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Change Details</th>
                <th className="px-4 py-3">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-[11px]">
              {auditLogs.length > 0 ? (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-sans">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="px-4 py-3 font-sans font-bold text-slate-900 whitespace-nowrap">
                      {log.user_name || 'System'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{log.entity_type}</td>
                    <td className="px-4 py-3 font-sans text-slate-800">{log.new_value}</td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{log.ip_address}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-sans">
                    No audit records found.
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
