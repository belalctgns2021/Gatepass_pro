import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { VisitorPass } from '../types.ts';
import { formatDate } from '../utils/qr.ts';
import {
  Clock,
  CheckCircle,
  XCircle,
  Shield,
  Search,
  RefreshCw,
  Eye,
  CheckCheck,
  Building,
  AlertCircle,
  User,
  Car,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface ApprovalDashboardPageProps {
  onSelectPass: (pass: VisitorPass) => void;
  onRefreshStats?: () => void;
}

export const ApprovalDashboardPage: React.FC<ApprovalDashboardPageProps> = ({
  onSelectPass,
  onRefreshStats,
}) => {
  const { user, token } = useAuth();
  const [pendingPasses, setPendingPasses] = useState<VisitorPass[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');

  // Single Approve & Reject Modals
  const [approvingPass, setApprovingPass] = useState<VisitorPass | null>(null);
  const [approvalRemarks, setApprovalRemarks] = useState<string>('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState<boolean>(false);

  const [rejectingPass, setRejectingPass] = useState<VisitorPass | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isSubmittingRejection, setIsSubmittingRejection] = useState<boolean>(false);

  // Batch Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchApproving, setIsBatchApproving] = useState<boolean>(false);
  const [batchNotice, setBatchNotice] = useState<string>('');

  const fetchPendingPasses = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.append('status', 'PENDING_APPROVAL');
      params.append('dateFilter', 'all');
      if (search.trim()) params.append('q', search.trim());
      if (departmentFilter !== 'ALL') params.append('department', departmentFilter);

      const res = await fetch(`/api/passes?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPendingPasses(data);
        setSelectedIds([]);
      }
    } catch (err) {
      console.error('Failed to load pending passes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingPasses();
  }, [token, departmentFilter]);

  const handleApproveSingle = async () => {
    if (!approvingPass || !token) return;
    setIsSubmittingApproval(true);
    try {
      const res = await fetch(`/api/passes/${approvingPass.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ remarks: approvalRemarks || `Approved by ${user?.name} (${user?.role})` }),
      });
      if (res.ok) {
        setApprovingPass(null);
        setApprovalRemarks('');
        fetchPendingPasses();
        if (onRefreshStats) onRefreshStats();
      }
    } catch (err) {
      console.error('Approval failed:', err);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const handleRejectSingle = async () => {
    if (!rejectingPass || !rejectionReason.trim() || !token) return;
    setIsSubmittingRejection(true);
    try {
      const res = await fetch(`/api/passes/${rejectingPass.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: rejectionReason }),
      });
      if (res.ok) {
        setRejectingPass(null);
        setRejectionReason('');
        fetchPendingPasses();
        if (onRefreshStats) onRefreshStats();
      }
    } catch (err) {
      console.error('Rejection failed:', err);
    } finally {
      setIsSubmittingRejection(false);
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0 || !token) return;
    setIsBatchApproving(true);
    try {
      const res = await fetch('/api/passes/batch-approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          passIds: selectedIds,
          remarks: `Bulk approved by ${user?.name} (${user?.role})`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBatchNotice(data.message || `Approved ${data.approvedCount} passes.`);
        setTimeout(() => setBatchNotice(''), 4000);
        fetchPendingPasses();
        if (onRefreshStats) onRefreshStats();
      }
    } catch (err) {
      console.error('Batch approve error:', err);
    } finally {
      setIsBatchApproving(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === pendingPasses.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingPasses.map((p) => p.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  // Get distinct departments from pending passes
  const departments = Array.from(new Set(pendingPasses.map((p) => p.host_department).filter(Boolean)));

  const canApprove = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider bg-amber-200 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-600 animate-ping"></span>
              <span>Manager & Admin Clearance Hub</span>
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Pass Approval Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Review and grant gate clearance for visitor passes created across all factory departments
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchPendingPasses}
            className="p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition border border-slate-200 cursor-pointer"
            title="Refresh Pending List"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {canApprove && selectedIds.length > 0 && (
            <button
              onClick={handleBatchApprove}
              disabled={isBatchApproving}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCheck className="h-4 w-4" />
              <span>{isBatchApproving ? 'Approving...' : `Approve Selected (${selectedIds.length})`}</span>
            </button>
          )}
        </div>
      </div>

      {batchNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <span>{batchNotice}</span>
        </div>
      )}

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Pending */}
        <div className="bg-white p-5 rounded-3xl border-2 border-amber-300 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-amber-800 text-xs font-bold uppercase tracking-wider mb-2">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-600" />
              Total Pending Authorization
            </span>
          </div>
          <div className="text-3xl font-black text-amber-600">{pendingPasses.length}</div>
          <div className="text-[11px] text-amber-800/80 font-medium mt-1">
            Gate turnstiles locked until approved
          </div>
          <div className="absolute -bottom-2 -right-2 h-16 w-16 bg-amber-50 rounded-full opacity-60 pointer-events-none"></div>
        </div>

        {/* User Authority Status */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Your Approval Clearance</span>
            <Shield className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-base font-extrabold text-slate-900">
            {canApprove ? (
              <span className="text-emerald-700 flex items-center gap-1.5">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <span>Authorized ({user?.role})</span>
              </span>
            ) : (
              <span className="text-slate-600 flex items-center gap-1.5">
                <AlertCircle className="h-5 w-5 text-slate-400" />
                <span>View Only ({user?.role})</span>
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {canApprove
              ? 'You have permission to approve or reject passes'
              : 'Only Managers and Admins can approve passes'}
          </div>
        </div>

        {/* Affected Departments */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Departments Awaiting Visitors</span>
            <Building className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{departments.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {departments.slice(0, 3).join(', ') || 'No pending departments'}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between text-xs">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchPendingPasses()}
              placeholder="Search by visitor name, pass number, company, or host..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={fetchPendingPasses}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
          >
            Search
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-500 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            Department:
          </span>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Pending Passes List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {canApprove && pendingPasses.length > 0 && (
              <input
                type="checkbox"
                checked={selectedIds.length === pendingPasses.length && pendingPasses.length > 0}
                onChange={toggleSelectAll}
                className="h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                title="Select all"
              />
            )}
            <div>
              <h3 className="text-base font-black text-slate-900">
                Visitor Passes Pending Approval ({pendingPasses.length})
              </h3>
              <p className="text-xs text-slate-500">
                Each pass requires Manager or Administrator authorization before gate admission is permitted
              </p>
            </div>
          </div>
        </div>

        {pendingPasses.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {pendingPasses.map((p) => {
              const isSelected = selectedIds.includes(p.id);
              return (
                <div
                  key={p.id}
                  className={`p-4 sm:p-5 hover:bg-slate-50/80 transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isSelected ? 'bg-emerald-50/40' : ''
                  }`}
                >
                  {/* Left: Selection + Visitor Profile */}
                  <div className="flex items-start sm:items-center gap-3.5">
                    {canApprove && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(p.id)}
                        className="mt-1 sm:mt-0 h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                      />
                    )}

                    {/* Avatar / Photo */}
                    <div className="h-12 w-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                      {p.visitor_photo ? (
                        <img src={p.visitor_photo} alt={p.visitor_name} className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-6 w-6 text-slate-400" />
                      )}
                    </div>

                    {/* Profile Information */}
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-slate-900">{p.visitor_name}</span>
                        <span className="font-mono text-xs font-extrabold bg-slate-100 text-slate-800 px-2 py-0.5 rounded-lg border border-slate-200">
                          {p.pass_number}
                        </span>
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full text-[10px] font-black">
                          <Clock className="h-3 w-3 text-amber-600 animate-spin" />
                          <span>PENDING APPROVAL</span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-1">
                        <span className="font-semibold text-slate-800">{p.visitor_company || 'Individual Visitor'}</span>
                        <span>•</span>
                        <span>📱 {p.visitor_mobile}</span>
                        <span>•</span>
                        <span className="text-slate-600 font-medium">Visit Date: {formatDate(p.visit_date)}</span>
                        <span>•</span>
                        <span className="text-slate-500">Hours: {p.expected_arrival} - {p.expected_departure}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-1.5">
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                          Host: <strong className="text-slate-900">{p.host_name}</strong> ({p.host_department})
                        </span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md font-medium text-slate-700">
                          Purpose: {p.purpose}
                        </span>
                        {p.vehicle_number && (
                          <span className="font-mono bg-slate-100 px-2 py-0.5 rounded-md text-[11px] text-slate-800 font-bold">
                            🚗 {p.vehicle_number}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                      onClick={() => onSelectPass(p)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer"
                      title="Inspect pass card and QR"
                    >
                      <Eye className="h-3.5 w-3.5 text-slate-500" />
                      <span>Inspect</span>
                    </button>

                    {canApprove && (
                      <>
                        <button
                          onClick={() => {
                            setApprovingPass(p);
                            setApprovalRemarks(`Approved by ${user?.name} (${user?.role})`);
                          }}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>Approve</span>
                        </button>

                        <button
                          onClick={() => {
                            setRejectingPass(p);
                            setRejectionReason('');
                          }}
                          className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer"
                        >
                          <XCircle className="h-3.5 w-3.5 text-rose-500" />
                          <span>Reject</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle className="h-8 w-8" />
            </div>
            <h3 className="text-base font-black text-slate-900">All Passes Authorized & Cleared</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              There are currently no visitor passes awaiting approval. When staff or reception create new passes requiring authorization, they will appear here immediately.
            </p>
          </div>
        )}
      </div>

      {/* Approve Modal */}
      {approvingPass && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="h-9 w-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Approve Gate Clearance</h3>
                <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Authorized as {user?.role}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Grant gate admission clearance for pass{' '}
              <span className="font-mono font-bold text-slate-900">{approvingPass.pass_number}</span> issued to{' '}
              <strong className="text-slate-900">{approvingPass.visitor_name}</strong> visiting{' '}
              <span className="font-semibold text-slate-800">{approvingPass.host_name}</span> ({approvingPass.host_department}).
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Approval Remarks / Entry Instructions (Optional)
              </label>
              <textarea
                rows={2}
                value={approvalRemarks}
                onChange={(e) => setApprovalRemarks(e.target.value)}
                placeholder="e.g. Safety PPE helmet required, allowed in conference hall only..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setApprovingPass(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveSingle}
                disabled={isSubmittingApproval}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle className="h-4 w-4" />
                <span>{isSubmittingApproval ? 'Granting Clearance...' : 'Confirm Approval'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingPass && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="h-9 w-9 rounded-xl bg-rose-500 text-white flex items-center justify-center font-bold">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Reject Gate Clearance</h3>
                <span className="text-[10px] uppercase font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                  Gate Access Refusal
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Disapprove gate entry for pass{' '}
              <span className="font-mono font-bold text-slate-900">{rejectingPass.pass_number}</span> ({rejectingPass.visitor_name}).
              Security guards will prevent gate entry.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Rejection *</label>
              <textarea
                rows={3}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Host unavailable, unscheduled plant maintenance, safety restriction..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectingPass(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Go Back
              </button>
              <button
                onClick={handleRejectSingle}
                disabled={!rejectionReason.trim() || isSubmittingRejection}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer"
              >
                <XCircle className="h-4 w-4" />
                <span>{isSubmittingRejection ? 'Rejecting...' : 'Confirm Rejection'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
