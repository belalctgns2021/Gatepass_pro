import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import { useAuth } from '../context/AuthContext.tsx';
import { VerificationResult, VisitorPass, Gate } from '../types.ts';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  LogIn,
  LogOut,
  MapPin,
  Shield,
  Search,
  RefreshCw,
  Clock,
  User,
  Car,
  Building,
  RotateCcw,
  Sparkles,
  CheckCircle,
} from 'lucide-react';

export const SecurityScanPage: React.FC = () => {
  const { user, token, currentGate, gates, switchGate } = useAuth();

  // Scanner state
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [manualInput, setManualInput] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [lastScannedToken, setLastScannedToken] = useState<string>('');

  // Action state (Recording entry or exit)
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);
  const [actionSuccessData, setActionSuccessData] = useState<any | null>(null);
  const [actionError, setActionError] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  // Video and Canvas refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Play audio beep tone on successful scan
  const playBeep = (type: 'success' | 'warning' | 'error' = 'success') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } else if (type === 'warning') {
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      } else {
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      }
    } catch {
      // Audio context might be restricted before user gesture
    }
  };

  // Start Camera
  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        scanFrame();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('Unable to access camera. Please allow camera permissions or enter the Pass ID manually.');
      setCameraActive(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    setCameraActive(false);
  };

  // Scan frame with jsQR
  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        const raw = code.data.trim();
        // Extract token from full verification URL if encoded as url, e.g., .../verify/token_xyz or .../pass/token_xyz
        let tokenOrPass = raw;
        if (raw.includes('/verify/')) {
          tokenOrPass = raw.split('/verify/')[1].split('?')[0].split('#')[0];
        } else if (raw.includes('/pass/')) {
          tokenOrPass = raw.split('/pass/')[1].split('?')[0].split('#')[0];
        }

        if (tokenOrPass !== lastScannedToken && !isVerifying) {
          playBeep('success');
          stopCamera();
          verifyPass(tokenOrPass);
          return;
        }
      }
    }

    animationFrameId.current = requestAnimationFrame(scanFrame);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Verify pass against backend
  const verifyPass = async (identifier: string) => {
    if (!identifier.trim()) return;
    setIsVerifying(true);
    setActionSuccessData(null);
    setLastScannedToken(identifier.trim());

    try {
      const res = await fetch(`/api/verify/${encodeURIComponent(identifier.trim())}`);
      const data = await res.json();
      setVerification(data);

      if (data.valid) {
        playBeep(data.status === 'INSIDE' ? 'warning' : 'success');
      } else {
        playBeep('error');
      }
    } catch (err) {
      console.error('Pass verification failed:', err);
      setVerification({
        valid: false,
        status: 'INVALID',
        title: 'NETWORK ERROR',
        message: 'Could not connect to the security server to verify pass.',
      });
      playBeep('error');
    } finally {
      setIsVerifying(false);
    }
  };

  // Record Entry
  const handleRecordEntry = async () => {
    if (!verification?.pass || isSubmittingAction) return;
    setIsSubmittingAction(true);

    try {
      const res = await fetch('/api/entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          qrToken: verification.pass.qr_token,
          passNumber: verification.pass.pass_number,
          gateId: currentGate?.id || 'gate_main',
          remarks: remarks || 'Standard Gate Entry',
          deviceInformation: 'Security Station Browser Scanner',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record entry');
      }

      playBeep('success');
      setActionSuccessData({
        type: 'ENTRY',
        ...data.entry,
      });

      // Refresh verification view
      verifyPass(verification.pass.qr_token);
    } catch (err: any) {
      setActionError(err.message || 'Error recording entry');
      playBeep('error');
    } finally {
      setIsSubmittingAction(false);
      setRemarks('');
    }
  };

  // Record Exit
  const handleRecordExit = async () => {
    if (!verification?.pass || isSubmittingAction) return;
    setIsSubmittingAction(true);
    setActionError('');

    try {
      const res = await fetch('/api/exit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          qrToken: verification.pass.qr_token,
          passNumber: verification.pass.pass_number,
          gateId: currentGate?.id || 'gate_main',
          remarks: remarks || 'Standard Gate Exit',
          deviceInformation: 'Security Station Browser Scanner',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record exit');
      }

      playBeep('success');
      setActionSuccessData({
        type: 'EXIT',
        ...data.exit,
      });

      // Refresh verification view
      verifyPass(verification.pass.qr_token);
    } catch (err: any) {
      setActionError(err.message || 'Error recording exit');
      playBeep('error');
    } finally {
      setIsSubmittingAction(false);
      setRemarks('');
    }
  };

  // Quick Supervisor Approval at Gate (Admin or Manager)
  const handleQuickApproveAtGate = async () => {
    if (!verification?.pass || !token) return;
    try {
      const res = await fetch(`/api/passes/${verification.pass.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ remarks: `Approved at gate by ${user?.name} (${user?.role})` }),
      });
      if (res.ok) {
        playBeep('success');
        verifyPass(verification.pass.qr_token || verification.pass.pass_number);
      }
    } catch (err) {
      console.error('Failed to approve at gate:', err);
    }
  };

  // Reset Scanner for next visitor
  const handleResetScan = () => {
    setVerification(null);
    setActionSuccessData(null);
    setActionError('');
    setManualInput('');
    setLastScannedToken('');
    stopCamera();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 sm:py-6">
      {/* Station Header Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 mb-4 shadow-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">Gate Security Scanner</h1>
              <span className="text-[10px] uppercase font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded">
                Live Verification
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Officer: <span className="text-slate-200 font-semibold">{user?.name}</span>
            </p>
          </div>
        </div>

        {/* Assigned Gate Selector */}
        <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700">
          <MapPin className="h-4 w-4 text-emerald-400 ml-1.5 shrink-0" />
          <div className="text-xs">
            <span className="text-[10px] text-slate-400 block leading-none">Guard Station</span>
            <select
              value={currentGate?.id || ''}
              onChange={(e) => switchGate(e.target.value)}
              className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer pr-2"
            >
              {gates.map((g) => (
                <option key={g.id} value={g.id} className="bg-slate-800 text-white">
                  {g.gate_name} ({g.gate_code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* QUICK DEMO PASS TEST PICKER (Allows 1-click verification of the prompt test scenarios!) */}
      <div className="bg-slate-800/60 rounded-xl p-3 mb-4 border border-slate-700/80 text-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>Instant Demo Passes (Test Scenario Simulator):</span>
          </span>
          <span className="text-[11px] text-slate-400">Click to verify directly</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button
            onClick={() => verifyPass('VP-2026-000125')}
            className="p-2 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/60 rounded-lg text-left transition group"
          >
            <div className="font-bold text-emerald-300 text-xs truncate">Md. Rahim Ahmed</div>
            <div className="text-[10px] text-emerald-400/80 font-mono">VP-2026-000125 • Ready Entry</div>
          </button>
          <button
            onClick={() => verifyPass('VP-2026-000124')}
            className="p-2 bg-amber-950/70 hover:bg-amber-900 border border-amber-700/60 rounded-lg text-left transition group"
          >
            <div className="font-bold text-amber-300 text-xs truncate">Sarah Jenkins</div>
            <div className="text-[10px] text-amber-400/80 font-mono">VP-2026-000124 • INSIDE (Exit)</div>
          </button>
          <button
            onClick={() => verifyPass('VP-2026-000123')}
            className="p-2 bg-blue-950/70 hover:bg-blue-900 border border-blue-700/60 rounded-lg text-left transition group"
          >
            <div className="font-bold text-blue-300 text-xs truncate">David Tanaka</div>
            <div className="text-[10px] text-blue-400/80 font-mono">VP-2026-000123 • EXITED</div>
          </button>
          <button
            onClick={() => verifyPass('VP-2026-000122')}
            className="p-2 bg-rose-950/70 hover:bg-rose-900 border border-rose-700/60 rounded-lg text-left transition group"
          >
            <div className="font-bold text-rose-300 text-xs truncate">Michael Chen</div>
            <div className="text-[10px] text-rose-400/80 font-mono">VP-2026-000122 • CANCELLED</div>
          </button>
          <button
            onClick={() => verifyPass('VP-2026-000121')}
            className="p-2 bg-slate-900 hover:bg-slate-850 border border-slate-700 rounded-lg text-left transition group"
          >
            <div className="font-bold text-slate-300 text-xs truncate">Elena Rostova</div>
            <div className="text-[10px] text-slate-400 font-mono">VP-2026-000121 • EXPIRED</div>
          </button>
          <button
            onClick={() => verifyPass('VP-INVALID-999999')}
            className="p-2 bg-slate-900 hover:bg-slate-850 border border-slate-700 rounded-lg text-left transition group"
          >
            <div className="font-bold text-slate-400 text-xs truncate">Unknown QR Code</div>
            <div className="text-[10px] text-rose-400 font-mono">Fake Token • REJECTED</div>
          </button>
        </div>
      </div>

      {/* ACTION ERROR BANNER */}
      {actionError && (
        <div className="mb-4 p-4 rounded-2xl bg-rose-950/90 border border-rose-500 text-rose-100 flex items-start gap-3 shadow-lg">
          <XCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-300 block">Operation Blocked</span>
            <p className="text-xs font-semibold text-white mt-0.5">{actionError}</p>
          </div>
          <button
            onClick={() => setActionError('')}
            className="text-rose-400 hover:text-white text-xs font-bold px-2 py-1 rounded"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* SUCCESS CONFIRMATION BANNER (Entry or Exit Recorded) */}
      {actionSuccessData && (
        <div
          className={`mb-4 p-5 rounded-2xl shadow-xl border animate-in fade-in slide-in-from-top-4 duration-300 ${
            actionSuccessData.type === 'ENTRY'
              ? 'bg-emerald-900/90 border-emerald-500 text-emerald-100'
              : 'bg-blue-900/90 border-blue-500 text-blue-100'
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-xl shrink-0 ${
                actionSuccessData.type === 'ENTRY' ? 'bg-emerald-500 text-slate-950' : 'bg-blue-500 text-slate-950'
              }`}
            >
              {actionSuccessData.type === 'ENTRY' ? <LogIn className="h-7 w-7" /> : <LogOut className="h-7 w-7" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded">
                  {actionSuccessData.type === 'ENTRY' ? '✓ ENTRY SUCCESSFUL' : '✓ EXIT SUCCESSFUL'}
                </span>
                <span className="text-xs font-mono font-bold">{actionSuccessData.passNumber}</span>
              </div>
              <h2 className="text-lg font-black text-white mt-1">
                {actionSuccessData.type === 'ENTRY' ? 'ENTRY RECORDED' : 'EXIT RECORDED'}
              </h2>
              <div className="mt-2 text-xs space-y-1 bg-black/20 p-3 rounded-xl">
                <div>
                  <span className="text-slate-300">Visitor:</span>{' '}
                  <span className="font-bold text-white">{actionSuccessData.visitorName}</span>
                </div>
                <div>
                  <span className="text-slate-300">Gate:</span>{' '}
                  <span className="font-semibold text-white">{actionSuccessData.gate}</span>
                </div>
                {actionSuccessData.type === 'ENTRY' ? (
                  <div>
                    <span className="text-slate-300">Entry Time:</span>{' '}
                    <span className="font-bold text-white">{actionSuccessData.entryTime}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-4">
                      <div>
                        <span className="text-slate-300">Entry:</span>{' '}
                        <span className="text-white">{actionSuccessData.entryTime}</span>
                      </div>
                      <div>
                        <span className="text-slate-300">Exit:</span>{' '}
                        <span className="font-bold text-white">{actionSuccessData.exitTime}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-300">Total Duration:</span>{' '}
                      <span className="font-extrabold text-amber-300">{actionSuccessData.duration}</span>
                    </div>
                  </>
                )}
                <div>
                  <span className="text-slate-300">Recorded By:</span>{' '}
                  <span className="text-white">{actionSuccessData.recordedBy}</span>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleResetScan}
                  className="px-4 py-2 bg-white text-slate-900 font-extrabold text-xs rounded-xl shadow hover:bg-slate-100 transition"
                >
                  Scan Next Visitor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VERIFICATION RESULT SCREEN */}
      {verification ? (
        <div className="space-y-4">
          {/* Card Top: Status Header */}
          <div
            className={`rounded-2xl p-5 sm:p-6 shadow-xl border-2 transition-all ${
              verification.status === 'VALID'
                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-100'
                : verification.status === 'INSIDE'
                ? 'bg-amber-950/80 border-amber-500 text-amber-100'
                : verification.status === 'EXITED'
                ? 'bg-blue-950/80 border-blue-500 text-blue-100'
                : 'bg-rose-950/90 border-rose-600 text-rose-100'
            }`}
          >
            {/* Header Status Line */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                {verification.status === 'VALID' ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                ) : verification.status === 'INSIDE' ? (
                  <AlertTriangle className="h-6 w-6 text-amber-400" />
                ) : verification.status === 'EXITED' ? (
                  <Clock className="h-6 w-6 text-blue-400" />
                ) : (
                  <XCircle className="h-6 w-6 text-rose-400" />
                )}
                <span className="text-base sm:text-lg font-black tracking-wide uppercase">
                  {verification.status === 'VALID'
                    ? '✓ VALID VISITOR PASS'
                    : verification.status === 'PENDING_APPROVAL'
                    ? '⏳ PENDING APPROVAL - ENTRY RESTRICTED'
                    : verification.status === 'INSIDE'
                    ? 'VISITOR CURRENTLY INSIDE'
                    : verification.status === 'EXITED'
                    ? 'VISITOR ALREADY EXITED'
                    : verification.status === 'REJECTED'
                    ? '✕ PASS REJECTED BY MANAGEMENT'
                    : '✕ INVALID VISITOR PASS'}
                </span>
              </div>
              <button
                onClick={handleResetScan}
                className="text-xs bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>New Scan</span>
              </button>
            </div>

            {/* Warning Message for Invalid / Pending Passes */}
            {!verification.valid && (
              <div className={`mt-3 p-3.5 bg-black/50 rounded-xl border ${
                verification.status === 'PENDING_APPROVAL' ? 'border-amber-500/70' : 'border-rose-500/60'
              }`}>
                <span className={`text-[10px] font-black uppercase tracking-wider block ${
                  verification.status === 'PENDING_APPROVAL' ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {verification.status === 'PENDING_APPROVAL' ? 'APPROVAL POLICY REQUIRED' : 'REASON / WARNING'}
                </span>
                <p className="text-sm font-bold text-white mt-0.5">{verification.message}</p>
                <p className={`text-xs font-black tracking-wider mt-1 ${
                  verification.status === 'PENDING_APPROVAL' ? 'text-amber-300' : 'text-rose-400'
                }`}>
                  GATE ENTRY STRICTLY PROHIBITED UNTIL APPROVED
                </p>

                {/* Supervisor Fast-Track Approval right at Gate */}
                {verification.status === 'PENDING_APPROVAL' && (user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                  <div className="mt-3 pt-3 border-t border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <div className="text-xs font-black text-white">Supervisor On-Site Authorization:</div>
                      <div className="text-[11px] text-amber-200">
                        You are authenticated as <strong>{user.name} ({user.role})</strong>. You have clearance to approve this pass.
                      </div>
                    </div>
                    <button
                      onClick={handleQuickApproveAtGate}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Approve Pass Now</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Visitor Details Display */}
            {verification.pass && (
              <div className="mt-4 space-y-4">
                {/* Photo & Primary info */}
                <div className="flex items-center gap-4 bg-black/30 p-3.5 rounded-xl border border-white/10">
                  <div className="h-16 w-16 rounded-xl bg-slate-800 border border-white/20 flex items-center justify-center overflow-hidden shrink-0">
                    {verification.pass.visitor_photo ? (
                      <img
                        src={verification.pass.visitor_photo}
                        alt={verification.pass.visitor_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-8 w-8 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Visitor:</span>
                    <h3 className="text-xl font-black text-white leading-tight truncate">
                      {verification.pass.visitor_name}
                    </h3>
                    <p className="text-xs font-semibold text-slate-200 truncate">
                      Company: {verification.pass.visitor_company || 'Independent Visitor'}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Pass No: <span className="text-white font-bold">{verification.pass.pass_number}</span>
                    </p>
                  </div>
                </div>

                {/* Structured Fields Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-black/20 p-3 rounded-xl border border-white/10">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Person to Visit:</span>
                    <span className="font-bold text-white text-sm">{verification.pass.host_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Department:</span>
                    <span className="font-semibold text-slate-200">{verification.pass.host_department}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Purpose:</span>
                    <span className="font-semibold text-slate-200">{verification.pass.purpose}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Visit Date:</span>
                    <span className="font-bold text-white">{verification.pass.visit_date}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Expected Arrival:</span>
                    <span className="font-semibold text-slate-200">{verification.pass.expected_arrival || '09:00'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Expected Exit:</span>
                    <span className="font-semibold text-slate-200">{verification.pass.expected_departure || '17:00'}</span>
                  </div>
                  {verification.pass.vehicle_number && (
                    <div className="col-span-2 pt-1 border-t border-white/10 flex items-center justify-between">
                      <span className="text-slate-400 text-[10px] uppercase font-semibold">Vehicle:</span>
                      <span className="font-mono font-bold text-white">{verification.pass.vehicle_number}</span>
                    </div>
                  )}
                  <div className="col-span-2 pt-1 border-t border-white/10 flex items-center justify-between">
                    <span className="text-slate-400 text-[10px] uppercase font-semibold">Current State:</span>
                    <span
                      className={`font-black uppercase px-2 py-0.5 rounded text-[11px] ${
                        verification.pass.status === 'INSIDE'
                          ? 'bg-amber-400 text-slate-950'
                          : verification.pass.status === 'ACTIVE'
                          ? 'bg-emerald-400 text-slate-950'
                          : verification.pass.status === 'EXITED'
                          ? 'bg-blue-400 text-slate-950'
                          : 'bg-rose-500 text-white'
                      }`}
                    >
                      {verification.pass.status}
                    </span>
                  </div>
                </div>

                {/* Entry Log info if currently inside */}
                {verification.status === 'INSIDE' && verification.lastEntry && (
                  <div className="bg-amber-900/40 p-3 rounded-xl border border-amber-600/50 text-xs text-amber-200">
                    <span className="font-bold block text-white uppercase text-[10px]">Entry Record:</span>
                    <div className="flex justify-between mt-1">
                      <span>Gate: {verification.lastEntry.gate_name || 'Main Gate'}</span>
                      <span>Time: {new Date(verification.lastEntry.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                )}

                {/* Optional Security Remarks field */}
                {(verification.canEnter || verification.canExit) && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Security Gate Remarks (Optional):
                    </label>
                    <input
                      type="text"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder={
                        verification.canEnter
                          ? 'e.g. Visitor badge #04 provided, PPE helmet verified'
                          : 'e.g. Visitor badge returned, exited through loading bay'
                      }
                      className="w-full bg-black/40 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-white"
                    />
                  </div>
                )}

                {/* ACTION BUTTONS (Section 6 & 7) */}
                {verification.canEnter && (
                  <button
                    onClick={handleRecordEntry}
                    disabled={isSubmittingAction}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-black text-lg rounded-2xl shadow-xl transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogIn className="h-6 w-6" />
                    <span>{isSubmittingAction ? 'RECORDING ENTRY...' : '[ RECORD ENTRY ]'}</span>
                  </button>
                )}

                {verification.canExit && (
                  <button
                    onClick={handleRecordExit}
                    disabled={isSubmittingAction}
                    className="w-full py-4 bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-black text-lg rounded-2xl shadow-xl transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogOut className="h-6 w-6" />
                    <span>{isSubmittingAction ? 'RECORDING EXIT...' : '[ RECORD EXIT ]'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* SCANNER INTERFACE (Camera or Manual Lookup) */
        <div className="bg-slate-900 rounded-3xl p-5 sm:p-7 shadow-xl border border-slate-800 text-white space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-extrabold tracking-tight">SCAN VISITOR QR</h2>
            <p className="text-xs text-slate-400 mt-1">
              Point your camera at the visitor pass QR code or enter pass ID manually
            </p>
          </div>

          {/* Camera Viewfinder */}
          <div className="relative mx-auto max-w-sm aspect-square bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-inner flex flex-col items-center justify-center">
            {cameraActive ? (
              <>
                <video ref={videoRef} className="h-full w-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />

                {/* Animated Scanner Targeting Overlay */}
                <div className="absolute inset-8 border-2 border-emerald-400 rounded-xl pointer-events-none shadow-[0_0_15px_rgba(16,185,129,0.5)] flex flex-col justify-between p-2">
                  <div className="flex justify-between">
                    <div className="h-4 w-4 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1"></div>
                    <div className="h-4 w-4 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1"></div>
                  </div>
                  <div className="w-full h-0.5 bg-emerald-400/80 shadow-[0_0_8px_#34d399] animate-pulse"></div>
                  <div className="flex justify-between">
                    <div className="h-4 w-4 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1"></div>
                    <div className="h-4 w-4 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1"></div>
                  </div>
                </div>

                <button
                  onClick={stopCamera}
                  className="absolute bottom-3 bg-slate-900/80 hover:bg-slate-900 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 backdrop-blur-sm transition flex items-center gap-1.5"
                >
                  <CameraOff className="h-3.5 w-3.5" />
                  <span>Turn Off Camera</span>
                </button>
              </>
            ) : (
              <div className="text-center p-6 space-y-3">
                <div className="h-16 w-16 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700">
                  <Camera className="h-8 w-8 text-emerald-400" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-200">Camera Scanner</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Mobile browser camera QR reader</p>
                </div>
                <button
                  onClick={startCamera}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition inline-flex items-center gap-2 cursor-pointer"
                >
                  <Camera className="h-4 w-4" />
                  <span>Start Camera Scan</span>
                </button>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 text-center">
              {cameraError}
            </div>
          )}

          {/* Manual Pass ID / Token Lookup (Section 18) */}
          <div className="pt-2 border-t border-slate-800">
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              [ Enter Pass ID or QR Token Manually ]
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verifyPass(manualInput);
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="e.g. VP-2026-000125 or token..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={!manualInput.trim() || isVerifying}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {isVerifying ? 'Verifying...' : 'Verify'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
