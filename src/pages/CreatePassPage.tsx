import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { VisitorPass } from '../types.ts';
import {
  User,
  Building,
  Phone,
  Mail,
  CreditCard,
  MapPin,
  Calendar,
  Clock,
  Car,
  FileText,
  Camera,
  Upload,
  CheckCircle,
  X,
  Shield,
} from 'lucide-react';

interface CreatePassPageProps {
  onSuccess: (newPass: VisitorPass) => void;
  onCancel: () => void;
}

export const CreatePassPage: React.FC<CreatePassPageProps> = ({ onSuccess, onCancel }) => {
  const { token, user } = useAuth();

  const today = new Date().toISOString().slice(0, 10);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    company: '',
    designation: '',
    photo: '',
    id_type: 'NATIONAL_ID',
    id_number: '',
    address: '',
    host_name: '',
    host_department: 'Purchase',
    purpose: 'Business Meeting',
    visit_date: today,
    expected_arrival: '10:00',
    expected_departure: '16:00',
    number_of_visitors: 1,
    vehicle_type: 'NONE',
    vehicle_number: '',
    remarks: '',
  });

  const [requiresApproval, setRequiresApproval] = useState<boolean>(true);
  const [autoApprove, setAutoApprove] = useState<boolean>(user?.role === 'ADMIN' || user?.role === 'MANAGER');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Camera capture modal state
  const [isTakingPhoto, setIsTakingPhoto] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const startWebcam = async () => {
    setIsTakingPhoto(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 320, facingMode: 'user' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Webcam access error:', err);
      setIsTakingPhoto(false);
      setErrorMsg('Could not access webcam for visitor photo capture. You can upload an image file instead.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, 300, 300);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setFormData((prev) => ({ ...prev, photo: dataUrl }));
    }
    stopWebcam();
  };

  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
    setIsTakingPhoto(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === 'string') {
        setFormData((prev) => ({ ...prev, photo: result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.name.trim() || !formData.mobile.trim() || !formData.host_name.trim() || !formData.purpose.trim()) {
      setErrorMsg('Please complete all mandatory fields marked with an asterisk (*).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/passes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          requiresApproval,
          autoApprove: (user?.role === 'ADMIN' || user?.role === 'MANAGER') ? autoApprove : false,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create pass');
      }

      onSuccess(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create visitor pass');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Form Header */}
        <div className="bg-slate-900 text-white p-6 sm:p-8 flex items-center justify-between border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                Gate Clearance Pass
              </span>
            </div>
            <h1 className="text-2xl font-black text-white mt-1">Create Visitor Gate Pass</h1>
            <p className="text-xs text-slate-400 mt-1">
              Issue an official digital and printable QR gate pass for factory entry
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {errorMsg && (
          <div className="m-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
          {/* SECTION 1: VISITOR INFORMATION */}
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200 mb-5">
              <User className="h-5 w-5 text-emerald-600" />
              <h2 className="text-base font-extrabold text-slate-900">1. Visitor Personal & Contact Information</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {/* Photo Upload/Camera */}
              <div className="flex flex-col items-center text-center p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                <div className="h-28 w-28 rounded-2xl bg-white border-2 border-slate-200 flex items-center justify-center overflow-hidden mb-3 shadow-inner relative group">
                  {formData.photo ? (
                    <img src={formData.photo} alt="Visitor" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-12 w-12 text-slate-300" />
                  )}
                  {formData.photo && (
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, photo: '' }))}
                      className="absolute inset-0 bg-slate-900/60 text-white text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {isTakingPhoto ? (
                  <div className="space-y-2">
                    <video ref={videoRef} className="h-28 w-28 object-cover rounded-xl border border-slate-300 mx-auto" />
                    <div className="flex gap-1 justify-center">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg"
                      >
                        Snap
                      </button>
                      <button
                        type="button"
                        onClick={stopWebcam}
                        className="px-2 py-1 bg-slate-300 text-slate-700 text-xs font-bold rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={startWebcam}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-sm"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span>Take Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-300 flex items-center gap-1 shadow-sm"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>Upload</span>
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                )}
                <span className="text-[10px] text-slate-400 mt-2">Optional visitor badge photo</span>
              </div>

              {/* Visitor Fields */}
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Visitor Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Md. Rahim Ahmed"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mobile Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    placeholder="e.g. +1 555-019-2831"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Company / Organization</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="e.g. ABC Trading Ltd."
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Designation / Role</label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g. Procurement Specialist"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. rahim@abctrading.com"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Identification Document</label>
                  <div className="flex gap-2">
                    <select
                      value={formData.id_type}
                      onChange={(e) => setFormData({ ...formData, id_type: e.target.value })}
                      className="bg-white border border-slate-300 rounded-xl px-2.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="NATIONAL_ID">NID</option>
                      <option value="PASSPORT">Passport</option>
                      <option value="DRIVING_LICENSE">License</option>
                      <option value="COMPANY_ID">Company ID</option>
                      <option value="OTHER">Other</option>
                    </select>
                    <input
                      type="text"
                      value={formData.id_number}
                      onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                      placeholder="Document / ID #"
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Visitor Address / City</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="e.g. 124 Industrial Avenue, Sector 4"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: VISIT DETAILS & HOST */}
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200 mb-5">
              <Building className="h-5 w-5 text-blue-600" />
              <h2 className="text-base font-extrabold text-slate-900">2. Visit Details & Host Allocation</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Host / Person to Visit <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.host_name}
                  onChange={(e) => setFormData({ ...formData, host_name: e.target.value })}
                  placeholder="e.g. Mr. Karim"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Host Department</label>
                <select
                  value={formData.host_department}
                  onChange={(e) => setFormData({ ...formData, host_department: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="Purchase">Purchase & Procurement</option>
                  <option value="Engineering">Engineering & Robotics</option>
                  <option value="Operations">Operations & Production</option>
                  <option value="Quality Assurance">Quality Assurance (QA)</option>
                  <option value="Facilities">Facilities & Maintenance</option>
                  <option value="Logistics">Logistics & Supply Chain</option>
                  <option value="Human Resources">Human Resources (HR)</option>
                  <option value="Executive Management">Executive Management</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Purpose of Visit <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="Business Meeting">Business Meeting</option>
                  <option value="Machine Calibration & Repair">Machine Calibration & Repair</option>
                  <option value="Material Delivery / Pickup">Material Delivery / Pickup</option>
                  <option value="Safety & Compliance Audit">Safety & Compliance Audit</option>
                  <option value="Contractor Maintenance">Contractor Maintenance</option>
                  <option value="Technical Inspection">Technical Inspection</option>
                  <option value="Official Interview">Official Interview</option>
                  <option value="Factory Tour / Inspection">Factory Tour / Inspection</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Visit Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.visit_date}
                  onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Expected Arrival Time</label>
                <input
                  type="time"
                  value={formData.expected_arrival}
                  onChange={(e) => setFormData({ ...formData, expected_arrival: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Expected Departure Time</label>
                <input
                  type="time"
                  value={formData.expected_departure}
                  onChange={(e) => setFormData({ ...formData, expected_departure: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: VEHICLE & LOGISTICS */}
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200 mb-5">
              <Car className="h-5 w-5 text-amber-600" />
              <h2 className="text-base font-extrabold text-slate-900">3. Vehicle & Gate Clearance</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Vehicle Type</label>
                <select
                  value={formData.vehicle_type}
                  onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="NONE">No Vehicle (Pedestrian Entry)</option>
                  <option value="CAR">Passenger Car</option>
                  <option value="VAN">Van / Utility Vehicle</option>
                  <option value="TRUCK">Heavy Transport / Freight Truck</option>
                  <option value="MOTORCYCLE">Motorcycle / Scooter</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Vehicle Registration Number</label>
                <input
                  type="text"
                  value={formData.vehicle_number}
                  onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                  placeholder="e.g. DHAKA-METRO-GA-12-3456"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Number of Visitors</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={formData.number_of_visitors}
                  onChange={(e) => setFormData({ ...formData, number_of_visitors: parseInt(e.target.value) || 1 })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">Gate Pass Remarks / Equipment</label>
                <input
                  type="text"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="e.g. Bringing calibration instruments, safety gear clearance granted"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: MANAGER & ADMIN APPROVAL WORKFLOW RULES */}
          <div className="bg-amber-50/80 border border-amber-200 p-5 sm:p-6 rounded-3xl space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Security Clearance & Approval Rules</h3>
                  <p className="text-[11px] text-slate-500">
                    Passes must be approved by either a Department Manager or Factory Admin before gate entry
                  </p>
                </div>
              </div>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                Rule Policy
              </span>
            </div>

            <div className="pt-2 border-t border-amber-200/80 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                  className="mt-0.5 h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <div>
                  <span>Require Department Manager or Admin approval before gate clearance</span>
                  <p className="text-[10px] text-slate-500 font-normal">
                    When checked, the pass status starts as <strong>PENDING APPROVAL</strong> and the visitor will be held at the gate until approved.
                  </p>
                </div>
              </label>

              {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                <div className="pl-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-emerald-900 bg-emerald-100/70 hover:bg-emerald-100 px-3.5 py-2 rounded-xl border border-emerald-300 transition">
                    <input
                      type="checkbox"
                      checked={autoApprove}
                      onChange={(e) => setAutoApprove(e.target.checked)}
                      className="h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>
                      Grant immediate approval now as authorized {user.role === 'ADMIN' ? 'Administrator' : 'Department Manager'}
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer"
            >
              <Shield className="h-4 w-4 text-emerald-400" />
              <span>{isSubmitting ? 'Generating Pass & QR...' : 'Issue & Generate Gate Pass'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
