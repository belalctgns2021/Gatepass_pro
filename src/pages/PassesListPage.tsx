import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { VisitorPass } from '../types.ts';
import { formatDate, formatTime } from '../utils/qr.ts';
import {
  Search,
  Filter,
  Eye,
  XCircle,
  QrCode,
  Calendar,
  Building,
  RefreshCw,
  PlusCircle,
  Car,
  Clock,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';

interface PassesListPageProps {
  onSelectPass: (pass: VisitorPass) => void;
  onOpenCreate: () => void;
}

export const PassesListPage: React.FC<PassesListPageProps> = ({ onSelectPass, onOpenCreate }) => {
  const { token, user } = useAuth();
  const [passes, setPasses] = useState<VisitorPass[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');

  // Cancel pass modal state
  const [cancellingPass, setCancellingPass] = useState<VisitorPass | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelError, setCancelError] = useState<string>('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState<boolean>(false);

  // Approve & Reject pass state
  const [approvingPass, setApprovingPass] = useState<VisitorPass | null>(null);
  const [approvalRemarks, setApprovalRemarks] = useState<string>('');
  const [approvalError, setApprovalError] = useState<string>('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState<boolean>(false);

  const [rejectingPass, setRejectingPass] = useState<VisitorPass | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [rejectionError, setRejectionError] = useState<string>('');
  const [isSubmittingRejection, setIsSubmittingRejection] = useState<boolean>(false);

  const fetchPasses = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.append('q', search.trim());
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (dateFilter) params.append('dateFilter', dateFilter);
      if (dateFilter === 'custom' && startDate && endDate) {
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      }
      if (departmentFilter) params.append('department', departmentFilter);

      const res = await fetch(`/api/passes?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPasses(data);
      }
    } catch (err) {
      console.error('Failed to fetch passes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPasses();
  }, [token, statusFilter, dateFilter, departmentFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPasses();
  };

  const handleCancelPass = async () => {
    if (!cancellingPass || !cancelReason.trim()) return;
    setIsSubmittingCancel(true);
    setCancelError('');
    try {
      const res = await fetch(`/api/passes/${cancellingPass.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: cancelReason }),
      });
      if (res.ok) {
        setCancellingPass(null);
        setCancelReason('');
        setCancelError('');
        fetchPasses();
      } else {
        const err = await res.json();
        setCancelError(err.error || 'Failed to cancel pass');
      }
    } catch (err: any) {
      setCancelError(err.message || 'Error cancelling pass');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  const handleApprovePass = async () => {
    if (!approvingPass) return;
    setIsSubmittingApproval(true);
    setApprovalError('');
    try {
      const res = await fetch(`/api/passes/${approvingPass.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ remarks: approvalRemarks }),
      });
      if (res.ok) {
        setApprovingPass(null);
        setApprovalRemarks('');
        fetchPasses();
      } else {
        const err = await res.json();
        setApprovalError(err.error || 'Failed to approve pass');
      }
    } catch (err: any) {
      setApprovalError(err.message || 'Error approving pass');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const handleRejectPass = async () => {
    if (!rejectingPass || !rejectionReason.trim()) return;
    setIsSubmittingRejection(true);
    setRejectionError('');
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
        fetchPasses();
      } else {
        const err = await res.json();
        setRejectionError(err.error || 'Failed to reject pass');
      }
    } catch (err: any) {
      setRejectionError(err.message || 'Error rejecting pass');
    } finally {
      setIsSubmittingRejection(false);
    }
  };

  const getStatusBadge = (status: string, pass?: VisitorPass) => {
    switch (status) {
      case 'PENDING_APPROVAL':
        return (
          <div className="flex flex-col items-start gap-0.5">
            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full text-[11px] font-black">
              <Clock className="h-3 w-3 text-amber-600 animate-spin" />
              <span>PENDING APPROVAL</span>
            </span>
            <span className="text-[9px] text-amber-700/80 font-semibold pl-1">Needs Manager/Admin</span>
          </div>
        );
      case 'INSIDE':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-600 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            INSIDE
          </span>
        );
      case 'ACTIVE':
        return (
          <div className="flex flex-col items-start gap-0.5">
            <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">
              ACTIVE
            </span>
            {pass?.approved_by_name && (
              <span className="text-[9px] text-emerald-700 font-medium pl-1">
                ✓ {pass.approved_by_name}
              </span>
            )}
          </div>
        );
      case 'EXITED':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-600 border border-blue-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">
            EXITED
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-0.5 rounded-full text-xs font-black">
            <XCircle className="h-3 w-3 text-rose-600" />
            REJECTED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-600 border border-rose-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">
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
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Visitor Passes Directory</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Search, filter, print, and track all gate clearance passes
          </p>
        </div>

        {user?.role !== 'SECURITY' && (
          <button
            onClick={onOpenCreate}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5 self-start sm:self-auto"
          >
            <PlusCircle className="h-4 w-4 text-emerald-400" />
            <span>Create Visitor Pass</span>
          </button>
        )}
      </div>

      {/* Advanced Filters Panel (Section 11) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Visitor Name, Mobile, Company, Pass #, Host, or Vehicle..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition"
          >
            Search
          </button>
          <button
            type="button"
            onClick={fetchPasses}
            className="p-2.5 text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </form>

        {/* Filter Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Pass Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING_APPROVAL">Pending Approval (Manager/Admin)</option>
              <option value="ACTIVE">Active (Approved)</option>
              <option value="INSIDE">Currently Inside</option>
              <option value="EXITED">Exited</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Date Period
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="all">All Dates</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Host Department
            </label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">All Departments</option>
              <option value="Purchase">Purchase</option>
              <option value="Engineering">Engineering</option>
              <option value="Operations">Operations</option>
              <option value="Quality Assurance">Quality Assurance</option>
              <option value="Facilities">Facilities</option>
              <option value="Logistics">Logistics</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {dateFilter === 'custom' && (
          <div className="flex gap-3 pt-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800"
            />
            <span className="self-center text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800"
            />
            <button
              onClick={fetchPasses}
              className="px-3 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold"
            >
              Apply Range
            </button>
          </div>
        )}
      </div>

      {/* Passes Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Pass Number</th>
                <th className="px-4 py-3.5">Visitor Name</th>
                <th className="px-4 py-3.5">Company</th>
                <th className="px-4 py-3.5">Person to Visit</th>
                <th className="px-4 py-3.5">Date & Hours</th>
                <th className="px-4 py-3.5">Vehicle</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {passes.length > 0 ? (
                passes.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {p.pass_number}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900">{p.visitor_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{p.visitor_mobile}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-800">{p.visitor_company || 'Individual'}</div>
                      {p.visitor_designation && (
                        <div className="text-[11px] text-slate-500">{p.visitor_designation}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900">{p.host_name}</div>
                      <div className="text-[11px] text-slate-500">{p.host_department}</div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{formatDate(p.visit_date)}</div>
                      <div className="text-[11px] text-slate-500">
                        {p.expected_arrival} - {p.expected_departure}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {p.vehicle_number ? (
                        <span className="font-mono text-slate-800 font-semibold">{p.vehicle_number}</span>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">{getStatusBadge(p.status, p)}</td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-1">
                      {/* Approve / Reject buttons for Manager or Admin on PENDING_APPROVAL passes */}
                      {p.status === 'PENDING_APPROVAL' && (user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                        <>
                          <button
                            onClick={() => {
                              setApprovingPass(p);
                              setApprovalRemarks(`Approved by ${user.name} (${user.role})`);
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition inline-flex items-center gap-1 shadow-sm cursor-pointer"
                            title="Approve Visitor Pass"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => {
                              setRejectingPass(p);
                              setRejectionReason('');
                            }}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                            title="Reject Visitor Pass"
                          >
                            <XCircle className="h-3.5 w-3.5 text-rose-500" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => onSelectPass(p)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                        title="View pass badge & QR"
                      >
                        <Eye className="h-3.5 w-3.5 text-slate-600" />
                        <span>Pass</span>
                      </button>

                      {user?.role !== 'SECURITY' && (p.status === 'ACTIVE' || p.status === 'PENDING_APPROVAL') && (
                        <button
                          onClick={() => setCancellingPass(p)}
                          className="px-2 py-1 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 font-bold rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                          title="Cancel Pass"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Cancel</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    No visitor passes found matching your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel Pass Modal */}
      {cancellingPass && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 mb-1">Cancel Visitor Pass</h3>
            <p className="text-xs text-slate-500 mb-4">
              Cancelling <span className="font-bold text-slate-800">{cancellingPass.pass_number}</span> for{' '}
              <span className="font-bold text-slate-800">{cancellingPass.visitor_name}</span>. This pass will be
              rendered invalid immediately.
            </p>

            {cancelError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 font-semibold">
                {cancelError}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Cancellation</label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Host unavailable, meeting rescheduled, security denial..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCancellingPass(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Keep Pass
              </button>
              <button
                onClick={handleCancelPass}
                disabled={!cancelReason.trim() || isSubmittingCancel}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow cursor-pointer"
              >
                {isSubmittingCancel ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Pass Modal */}
      {approvingPass && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="h-9 w-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Approve Visitor Pass</h3>
                <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Manager / Admin Authorization
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Grant official gate access clearance for pass{' '}
              <span className="font-mono font-bold text-slate-900">{approvingPass.pass_number}</span> issued to{' '}
              <strong className="text-slate-900">{approvingPass.visitor_name}</strong> ({approvingPass.visitor_company || 'Individual'}).
            </p>

            {approvalError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 font-semibold">
                {approvalError}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Approval Remarks / Instructions (Optional)
              </label>
              <textarea
                rows={2}
                value={approvalRemarks}
                onChange={(e) => setApprovalRemarks(e.target.value)}
                placeholder="e.g. Cleared for Sector 3 conference room, visitor safety PPE confirmed..."
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
                onClick={handleApprovePass}
                disabled={isSubmittingApproval}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle className="h-4 w-4" />
                <span>{isSubmittingApproval ? 'Approving...' : 'Confirm Approval'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Pass Modal */}
      {rejectingPass && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="h-9 w-9 rounded-xl bg-rose-500 text-white flex items-center justify-center font-bold">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Reject Visitor Pass</h3>
                <span className="text-[10px] uppercase font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                  Access Refusal
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Disapprove gate access for pass{' '}
              <span className="font-mono font-bold text-slate-900">{rejectingPass.pass_number}</span> ({rejectingPass.visitor_name}).
              Security officers will block gate entry.
            </p>

            {rejectionError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 font-semibold">
                {rejectionError}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Rejection *</label>
              <textarea
                rows={3}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Host unavailable, unscheduled plant maintenance in Sector 2, security concern..."
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
                onClick={handleRejectPass}
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
