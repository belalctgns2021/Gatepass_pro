import React, { useEffect, useState } from 'react';
import { VisitorPass } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { generateQrDataUrl, formatDate } from '../utils/qr.ts';
import {
  Printer,
  Share2,
  Copy,
  Check,
  X,
  ShieldCheck,
  Building,
  User,
  Clock,
  Calendar,
  Car,
  AlertCircle,
  FileCheck,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface PassCardModalProps {
  pass: VisitorPass | null;
  onClose: () => void;
}

export const PassCardModal: React.FC<PassCardModalProps> = ({ pass: initialPass, onClose }) => {
  const { user, token } = useAuth();
  const [pass, setPass] = useState<VisitorPass | null>(initialPass);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<'badge' | 'mobile'>('badge');
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string>('');

  useEffect(() => {
    setPass(initialPass);
  }, [initialPass]);

  useEffect(() => {
    if (pass) {
      // In production, encode full public verification link or token
      const verifyUrl = `${window.location.origin}/verify/${pass.qr_token}`;
      generateQrDataUrl(verifyUrl).then(setQrDataUrl);
    }
  }, [pass]);

  if (!pass) return null;

  const publicUrl = `${window.location.origin}/pass/${pass.qr_token}`;

  const handleInlineApprove = async () => {
    if (!token || !pass) return;
    setIsApproving(true);
    setActionNotice('');
    try {
      const res = await fetch(`/api/passes/${pass.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ remarks: `Approved by ${user?.name} (${user?.role})` }),
      });
      const data = await res.json();
      if (res.ok) {
        setPass(data.pass || { ...pass, status: 'ACTIVE', approved_by_name: `${user?.name} (${user?.role})` });
        setActionNotice('Pass approved successfully!');
      } else {
        setActionNotice(data.error || 'Failed to approve');
      }
    } catch (err: any) {
      setActionNotice(err.message || 'Error approving pass');
    } finally {
      setIsApproving(false);
    }
  };

  const handleInlineReject = async () => {
    if (!token || !pass) return;
    const reason = window.prompt('Please enter the reason for rejecting this pass:');
    if (reason === null) return;
    setIsApproving(true);
    setActionNotice('');
    try {
      const res = await fetch(`/api/passes/${pass.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: reason || 'Disapproved by management' }),
      });
      const data = await res.json();
      if (res.ok) {
        setPass(data.pass || { ...pass, status: 'REJECTED', cancel_reason: reason });
        setActionNotice('Pass rejected.');
      } else {
        setActionNotice(data.error || 'Failed to reject');
      }
    } catch (err: any) {
      setActionNotice(err.message || 'Error rejecting pass');
    } finally {
      setIsApproving(false);
    }
  };

  const copyPassLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const sharePass = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Factory Visitor Gate Pass - ${pass.visitor_name}`,
          text: `Gate Pass for ${pass.visitor_name} at Feng Qun (${pass.pass_number})`,
          url: publicUrl,
        });
      } catch {
        copyPassLink();
      }
    } else {
      copyPassLink();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      {/* Container */}
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden relative">
        {/* Modal Controls Bar (hidden during print) */}
        <div className="print:hidden bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight">Visitor Gate Pass</span>
            <span className="font-mono text-xs bg-slate-800 text-emerald-400 px-2 py-0.5 rounded border border-slate-700">
              {pass.pass_number}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-800 p-0.5 rounded-lg flex text-xs">
              <button
                onClick={() => setActiveView('badge')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  activeView === 'badge' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-300'
                }`}
              >
                Printable Pass
              </button>
              <button
                onClick={() => setActiveView('mobile')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  activeView === 'mobile' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-300'
                }`}
              >
                Mobile View
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg border border-slate-700 text-slate-200 transition"
              title="Print Pass"
            >
              <Printer className="h-3.5 w-3.5 text-emerald-400" />
              <span>Print</span>
            </button>

            <button
              onClick={sharePass}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg border border-slate-700 text-slate-200 transition"
              title="Share Pass"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5 text-blue-400" />}
              <span>{copied ? 'Copied' : 'Share'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE BADGE VIEW */}
        {activeView === 'badge' ? (
          <div className="p-6 sm:p-8 bg-white print:p-0" id="printable-visitor-pass">
            {/* Header with Factory Branding */}
            <div className="border-b-2 border-slate-900 pb-4 mb-5 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-7 w-7 rounded bg-slate-900 text-white flex items-center justify-center font-black text-xs">
                    FQ
                  </div>
                  <h2 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                    Feng Qun Manufacturing Complex
                  </h2>
                </div>
                <p className="text-xs text-slate-500">Security Gate Operations • Official Visitor Clearance</p>
              </div>

              <div className="text-right">
                <span className="inline-block bg-slate-900 text-white text-xs font-black uppercase tracking-wider px-3 py-1 rounded">
                  OFFICIAL GATE PASS
                </span>
                <p className="text-xs font-mono font-bold text-slate-700 mt-1">{pass.pass_number}</p>
              </div>
            </div>

            {/* Action Notice feedback */}
            {actionNotice && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-xl text-center">
                {actionNotice}
              </div>
            )}

            {/* Approval Status Alert Banner */}
            {pass.status === 'PENDING_APPROVAL' && (
              <div className="mb-5 p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                      <span>AWAITING MANAGER / ADMIN APPROVAL</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-200 text-amber-800">Entry Denied</span>
                    </div>
                    <div className="text-[11px] text-amber-800">
                      This pass must be approved by a Department Manager or Admin before gate entry can be logged.
                    </div>
                  </div>
                </div>

                {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleInlineApprove}
                      disabled={isApproving}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>{isApproving ? 'Approving...' : 'Approve Pass'}</span>
                    </button>
                    <button
                      onClick={handleInlineReject}
                      disabled={isApproving}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1 cursor-pointer"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {pass.status === 'REJECTED' && (
              <div className="mb-5 p-3.5 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-center gap-2.5">
                <XCircle className="h-6 w-6 text-rose-600 shrink-0" />
                <div>
                  <div className="text-xs font-black text-rose-900 uppercase">PASS REJECTED BY MANAGEMENT</div>
                  <div className="text-[11px] text-rose-700 font-medium">
                    Reason: {pass.cancel_reason || 'Disapproved by department manager/admin'}
                  </div>
                </div>
              </div>
            )}

            {pass.approved_by_name && pass.status === 'ACTIVE' && (
              <div className="mb-4 px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span className="font-semibold">
                    Approved by <strong className="font-black">{pass.approved_by_name}</strong>
                    {pass.approved_at ? ` on ${formatDate(pass.approved_at)}` : ''}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-700 font-mono font-bold bg-emerald-100 px-2 py-0.5 rounded">
                  CLEARANCE GRANTED
                </span>
              </div>
            )}

            {/* Main Pass Body: 2 Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
              {/* Left Column: Photo & Details */}
              <div className="sm:col-span-2 space-y-4">
                <div className="flex items-center gap-4">
                  {/* Visitor Photo or Placeholder */}
                  <div className="h-24 w-24 rounded-xl border-2 border-slate-300 bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                    {pass.visitor_photo ? (
                      <img src={pass.visitor_photo} alt={pass.visitor_name} className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-12 w-12 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900 leading-tight">{pass.visitor_name}</h3>
                    <p className="text-sm font-semibold text-slate-700">{pass.visitor_company || 'Individual Visitor'}</p>
                    {pass.visitor_designation && (
                      <p className="text-xs text-slate-500">{pass.visitor_designation}</p>
                    )}
                    <p className="text-xs font-mono text-slate-500 mt-1">
                      📱 {pass.visitor_mobile}
                      {pass.visitor_id_number ? ` • ID: ${pass.visitor_id_number}` : ''}
                    </p>
                  </div>
                </div>

                {/* Visit Metadata Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Host / Person to Visit</span>
                    <span className="font-bold text-slate-800 text-sm">{pass.host_name}</span>
                    <span className="text-slate-500 block text-[11px]">{pass.host_department}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Purpose of Visit</span>
                    <span className="font-bold text-slate-800">{pass.purpose}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Valid Visit Date</span>
                    <span className="font-bold text-slate-800">{formatDate(pass.visit_date)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Expected Hours</span>
                    <span className="font-bold text-slate-800">
                      {pass.expected_arrival || '09:00'} - {pass.expected_departure || '17:00'}
                    </span>
                  </div>
                  {pass.vehicle_number && (
                    <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Vehicle Reg:</span>
                      <span className="font-mono font-bold text-slate-800">{pass.vehicle_number} ({pass.vehicle_type})</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: QR Code & Verification Status */}
              <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300 text-center">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Scan at Gate
                </span>
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Visitor QR Code"
                    className="h-36 w-36 object-contain rounded-lg shadow-sm border border-slate-200"
                  />
                ) : (
                  <div className="h-36 w-36 bg-slate-200 rounded flex items-center justify-center text-slate-400 text-xs">
                    Generating QR...
                  </div>
                )}
                <div className="mt-2 text-center">
                  <span className="text-[10px] font-mono font-semibold text-slate-500 block">TOKEN HASH</span>
                  <span className="text-[9px] font-mono text-slate-400 truncate max-w-[150px] inline-block">
                    {pass.qr_token.slice(0, 18)}...
                  </span>
                </div>
              </div>
            </div>

            {/* Important Factory Safety & Gate Rules */}
            <div className="mt-6 pt-4 border-t border-slate-200 text-[11px] text-slate-600 space-y-1">
              <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px] flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Factory Visitor Safety Instructions</span>
              </div>
              <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                <li>This pass must be visibly worn at all times while on factory premises.</li>
                <li>Safety shoes, helmet, and high-visibility vest required in production and loading zones.</li>
                <li>Strictly no smoking, photography, or unescorted entry to hazardous mechanical areas.</li>
                <li>Present this pass to security at the gate upon exit to log departure time.</li>
              </ul>
            </div>

            {/* Footer with Contact info */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
              <span>Security Central Control: +1 (555) 019-9999 • Gate 1 Main Control</span>
              <span>Pass Issued: {new Date(pass.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ) : (
          /* MOBILE PASS VIEW (Smartphone preview) */
          <div className="p-6 bg-slate-100 flex flex-col items-center justify-center">
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden text-slate-900">
              {/* Mobile Header */}
              <div className="bg-slate-900 text-white p-5 text-center relative">
                <span className="text-[10px] tracking-widest uppercase font-bold text-emerald-400 block mb-0.5">
                  Feng Qun Manufacturing Complex
                </span>
                <h3 className="text-lg font-black tracking-tight">VISITOR GATE PASS</h3>
                <span className="text-xs font-mono text-slate-400 mt-1 inline-block bg-slate-800 px-2 py-0.5 rounded">
                  {pass.pass_number}
                </span>
              </div>

              {/* Mobile Body */}
              <div className="p-5 text-center space-y-4">
                <div className="flex flex-col items-center">
                  <div className="h-20 w-20 rounded-full border-2 border-emerald-500 bg-slate-100 flex items-center justify-center overflow-hidden mb-2 shadow-inner">
                    {pass.visitor_photo ? (
                      <img src={pass.visitor_photo} alt={pass.visitor_name} className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-10 w-10 text-slate-400" />
                    )}
                  </div>
                  <h4 className="text-lg font-black text-slate-900">{pass.visitor_name}</h4>
                  <p className="text-xs font-semibold text-slate-600">{pass.visitor_company || 'Guest Visitor'}</p>
                </div>

                {/* QR Code Container */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 inline-block shadow-sm">
                  {qrDataUrl && (
                    <img src={qrDataUrl} alt="QR Code" className="h-44 w-44 mx-auto object-contain" />
                  )}
                  <p className="text-[11px] font-bold text-slate-600 mt-2">SHOW TO SECURITY GUARD AT GATE</p>
                </div>

                {/* Visit summary */}
                <div className="text-left bg-slate-50 rounded-xl p-3.5 text-xs space-y-1.5 border border-slate-200">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Host:</span>
                    <span className="font-bold text-slate-800">{pass.host_name} ({pass.host_department})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Purpose:</span>
                    <span className="font-semibold text-slate-800">{pass.purpose}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date:</span>
                    <span className="font-bold text-slate-800">{formatDate(pass.visit_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Expected Time:</span>
                    <span className="font-semibold text-slate-800">{pass.expected_arrival} - {pass.expected_departure}</span>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  onClick={copyPassLink}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>{copied ? 'Pass Link Copied!' : 'Copy Visitor Pass Link'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Bottom Actions */}
        <div className="print:hidden bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Pass status: <span className="font-bold uppercase text-slate-800">{pass.status}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow"
            >
              <Printer className="h-4 w-4 text-emerald-400" />
              <span>Print Badge</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
