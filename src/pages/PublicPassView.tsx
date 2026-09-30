import React, { useState, useEffect } from 'react';
import { VisitorPass } from '../types.ts';
import { generateQrDataUrl, formatDate, formatTime } from '../utils/qr.ts';
import {
  Shield,
  User,
  Building,
  Calendar,
  Clock,
  Car,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Share2,
  Copy,
  Printer,
  ChevronLeft,
} from 'lucide-react';

interface PublicPassViewProps {
  tokenOrPass: string;
  onBackToApp: () => void;
}

export const PublicPassView: React.FC<PublicPassViewProps> = ({ tokenOrPass, onBackToApp }) => {
  const [pass, setPass] = useState<VisitorPass | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    const fetchPass = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/passes/${tokenOrPass}`);
        if (res.ok) {
          const data = await res.json();
          setPass(data.pass);
          const verifyUrl = `${window.location.origin}/verify/${data.pass.qr_token}`;
          const qr = await generateQrDataUrl(verifyUrl);
          setQrDataUrl(qr);
        }
      } catch (err) {
        console.error('Failed to load public pass:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPass();
  }, [tokenOrPass]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xs">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p>Loading Official Gate Pass...</p>
        </div>
      </div>
    );
  }

  if (!pass) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white text-center">
        <AlertTriangle className="h-12 w-12 text-rose-500 mb-3" />
        <h2 className="text-xl font-bold">Pass Not Found</h2>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          This visitor pass link is invalid or may have been revoked by factory security.
        </p>
        <button
          onClick={onBackToApp}
          className="mt-6 px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl border border-slate-700"
        >
          Return to Portal
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4 flex flex-col items-center justify-center">
      {/* Top action bar */}
      <div className="w-full max-w-md flex items-center justify-between mb-4">
        <button
          onClick={onBackToApp}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-semibold"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Back to Portal</span>
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="p-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs border border-slate-700"
            title="Print"
          >
            <Printer className="h-4 w-4" />
          </button>
          <button
            onClick={copyLink}
            className="p-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs border border-slate-700"
            title="Copy Link"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Official Smartphone Wallet Style Pass Card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Pass Header */}
        <div className="bg-slate-900 text-white p-6 text-center relative">
          <div className="inline-flex h-10 w-10 rounded-xl bg-emerald-500 items-center justify-center text-slate-950 mb-2 shadow">
            <Shield className="h-6 w-6" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">
            Feng Qun Manufacturing Complex
          </span>
          <h1 className="text-xl font-black tracking-tight mt-0.5">VISITOR GATE CLEARANCE</h1>
          <div className="mt-2 inline-block font-mono text-xs font-bold bg-slate-800 text-slate-200 px-3 py-1 rounded-full border border-slate-700">
            {pass.pass_number}
          </div>
        </div>

        {/* Pass Content */}
        <div className="p-6 text-center space-y-5">
          {/* Visitor Avatar & Identity */}
          <div className="flex flex-col items-center">
            <div className="h-24 w-24 rounded-full border-4 border-emerald-500 bg-slate-100 flex items-center justify-center overflow-hidden mb-2 shadow-inner">
              {pass.visitor_photo ? (
                <img src={pass.visitor_photo} alt={pass.visitor_name} className="h-full w-full object-cover" />
              ) : (
                <User className="h-12 w-12 text-slate-400" />
              )}
            </div>
            <h2 className="text-xl font-black text-slate-900">{pass.visitor_name}</h2>
            <p className="text-xs font-bold text-slate-600">{pass.visitor_company || 'Independent Visitor'}</p>
            {pass.visitor_designation && (
              <p className="text-[11px] text-slate-400">{pass.visitor_designation}</p>
            )}
          </div>

          {/* QR Code Container */}
          <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300 inline-block shadow-sm">
            {qrDataUrl && (
              <img src={qrDataUrl} alt="Visitor QR" className="h-48 w-48 mx-auto object-contain" />
            )}
            <p className="text-[11px] font-black text-slate-800 mt-2 uppercase tracking-wide">
              Show QR to Guard at Gate
            </p>
          </div>

          {/* Status Badge */}
          <div>
            <span
              className={`inline-block text-xs font-black uppercase px-4 py-1.5 rounded-full ${
                pass.status === 'INSIDE'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : pass.status === 'ACTIVE'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : pass.status === 'EXITED'
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}
            >
              Status: {pass.status}
            </span>
          </div>

          {/* Visit Details Box */}
          <div className="text-left bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-semibold">Person to Visit:</span>
              <span className="font-bold text-slate-800">{pass.host_name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-semibold">Department:</span>
              <span className="font-semibold text-slate-700">{pass.host_department}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-semibold">Purpose:</span>
              <span className="font-semibold text-slate-700">{pass.purpose}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-semibold">Visit Date:</span>
              <span className="font-bold text-slate-800">{formatDate(pass.visit_date)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-semibold">Expected Hours:</span>
              <span className="font-semibold text-slate-700">{pass.expected_arrival} - {pass.expected_departure}</span>
            </div>
            {pass.vehicle_number && (
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-slate-400 font-semibold">Vehicle:</span>
                <span className="font-mono font-bold text-slate-800">{pass.vehicle_number}</span>
              </div>
            )}
          </div>

          {/* Safety Notice */}
          <div className="text-[10px] text-slate-500 text-center leading-relaxed">
            Please report to <span className="font-bold text-slate-700">Gate 1 (Main Security)</span> on arrival. Safety helmets and vests must be worn in loading zones.
          </div>
        </div>
      </div>
    </div>
  );
};
