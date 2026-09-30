import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { formatDate, formatTime, formatDateTime } from '../utils/qr.ts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';
import {
  FileText,
  Download,
  Building,
  Users,
  Briefcase,
  Calendar,
  CheckCircle,
  RefreshCw,
  TrendingUp,
  FileSpreadsheet,
  Printer,
  Shield,
  Clock,
  ChevronDown,
  ListFilter,
  Lock,
  Activity,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { token, user } = useAuth();
  const [reportData, setReportData] = useState<any>({
    byCompany: [],
    byDepartment: [],
    byHost: [],
    detailedLogs: [],
  });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'visitor_history' | 'audit_logs'>('visitor_history');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [exportNotice, setExportNotice] = useState<string>('');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);

  const fetchReports = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (startDate && endDate) {
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      }
      const res = await fetch(`/api/reports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

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
    fetchReports();
    if (user?.role === 'ADMIN') {
      fetchAuditLogs();
    }
  }, [token]);

  // Record audit log for export action
  const logExportAction = (format: string, type: string, count: number) => {
    if (!token) return;
    fetch('/api/audit-logs/custom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: `EXPORT_${format.toUpperCase()}`,
        entity_type: 'REPORT',
        new_value: `Exported ${type} in ${format} format (${count} records)`,
      }),
    }).catch(() => {});
  };

  // ========================================================
  // 1. VISITOR HISTORY CSV EXPORT (using PapaParse)
  // ========================================================
  const exportVisitorHistoryCSV = () => {
    if (!reportData.detailedLogs || reportData.detailedLogs.length === 0) {
      setExportNotice('No visitor history records found for this period to export.');
      setTimeout(() => setExportNotice(''), 3500);
      return;
    }

    const formattedData = reportData.detailedLogs.map((log: any) => {
      const durMins = log.duration_minutes || 0;
      const formattedDur = durMins > 0 ? `${Math.floor(durMins / 60)}h ${durMins % 60}m` : '--';
      return {
        'Pass Number': log.pass_number,
        'Visitor Name': log.visitor_name,
        'Company / Organization': log.company || 'Individual',
        'Mobile Number': log.mobile || '',
        'Email Address': log.email || '',
        'Host Personnel': log.host_name || '',
        'Host Department': log.host_department || '',
        'Purpose of Visit': log.purpose || '',
        'Visit Date': log.visit_date,
        'Expected Arrival': log.expected_arrival || '',
        'Expected Departure': log.expected_departure || '',
        'Pass Status': log.status,
        'Entry Timestamp': log.entry_time || '',
        'Entry Gate Station': log.entry_gate || '',
        'Exit Timestamp': log.exit_time || '',
        'Exit Gate Station': log.exit_gate || '',
        'Stay Duration (Minutes)': durMins,
        'Stay Duration (Formatted)': formattedDur,
      };
    });

    const csvContent = Papa.unparse(formattedData, {
      quotes: true,
      header: true,
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `FengQun_Visitor_History_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportNotice(`Exported ${formattedData.length} visitor history records to CSV (PapaParse).`);
    setTimeout(() => setExportNotice(''), 3500);
    logExportAction('CSV', 'Historical Visitor Registry', formattedData.length);
  };

  // ========================================================
  // 2. AUDIT LOGS CSV EXPORT (using PapaParse)
  // ========================================================
  const exportAuditLogsCSV = async () => {
    try {
      setExportNotice('Preparing system audit logs for export...');
      let logs = auditLogs;
      if (!logs || logs.length === 0) {
        const res = await fetch('/api/audit-logs', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          logs = await res.json();
          setAuditLogs(logs);
        }
      }

      if (!logs || logs.length === 0) {
        setExportNotice('No audit log entries available to export.');
        setTimeout(() => setExportNotice(''), 3500);
        return;
      }

      const formattedLogs = logs.map((log: any) => ({
        'Log ID': log.id,
        'Timestamp': log.timestamp,
        'Actor / User ID': log.user_id || 'SYSTEM',
        'Actor / User Name': log.user_name || 'System Auto',
        'Security Action': log.action,
        'Entity Type': log.entity_type,
        'Entity ID': log.entity_id || '',
        'Old Value': log.old_value || '',
        'New Value / Details': log.new_value || '',
        'IP Address': log.ip_address || '',
      }));

      const csvContent = Papa.unparse(formattedLogs, {
        quotes: true,
        header: true,
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute('href', url);
      link.setAttribute('download', `FengQun_Security_Audit_Logs_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportNotice(`Exported ${formattedLogs.length} audit log events to CSV (PapaParse).`);
      setTimeout(() => setExportNotice(''), 3500);
      logExportAction('CSV', 'System Security Audit Trail', formattedLogs.length);
    } catch (err: any) {
      console.error('Audit logs CSV export error:', err);
      setExportNotice('Failed to export audit logs CSV: ' + err.message);
      setTimeout(() => setExportNotice(''), 4000);
    }
  };

  // ========================================================
  // 3. DEPARTMENT & HOST SUMMARY CSV (using PapaParse)
  // ========================================================
  const exportSummaryCSV = () => {
    if (!reportData.byDepartment || reportData.byDepartment.length === 0) {
      setExportNotice('No summary data available to export.');
      setTimeout(() => setExportNotice(''), 3000);
      return;
    }

    const deptRows = (reportData.byDepartment || []).map((d: any) => ({
      Category: 'Department Volume',
      Identifier: d.host_department,
      Secondary: '',
      'Total Passes': d.total_visits,
    }));

    const compRows = (reportData.byCompany || []).map((c: any) => ({
      Category: 'Visiting Organization',
      Identifier: c.company,
      Secondary: '',
      'Total Passes': c.total_visits,
    }));

    const hostRows = (reportData.byHost || []).map((h: any) => ({
      Category: 'Host Personnel',
      Identifier: h.host_name,
      Secondary: h.host_department,
      'Total Passes': h.total_visits,
    }));

    const allSummary = [...deptRows, ...compRows, ...hostRows];

    const csvContent = Papa.unparse(allSummary, {
      quotes: true,
      header: true,
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `FengQun_Department_Analytics_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportNotice('Department & Host Analytics CSV exported (PapaParse).');
    setTimeout(() => setExportNotice(''), 3500);
    logExportAction('CSV', 'Department & Organization Analytics', allSummary.length);
  };

  // ========================================================
  // 4. VISITOR HISTORY PDF EXPORT (using jsPDF + autoTable)
  // ========================================================
  const exportVisitorHistoryPDF = () => {
    if (!reportData.detailedLogs || reportData.detailedLogs.length === 0) {
      setExportNotice('No visitor records available to generate PDF report.');
      setTimeout(() => setExportNotice(''), 3000);
      return;
    }

    try {
      // Landscape A4 for wide table presentation
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Industrial Header Bar
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 64, 'F');

      // Accent Stripe (Emerald)
      doc.setFillColor(16, 185, 129); // emerald-500
      doc.rect(0, 64, pageWidth, 4, 'F');

      // Title & Subtitle
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('FENG QUN MANUFACTURING COMPLEX', 40, 30);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text('OFFICIAL VISITOR SECURITY AUDIT & ACCESS CONTROL REPORT', 40, 48);

      // Security Classification Stamp
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(52, 211, 153); // emerald-400
      doc.text('CONFIDENTIAL / LEVEL 1 AUDIT', pageWidth - 220, 30);
      doc.setTextColor(203, 213, 225);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 220, 44);
      doc.text(`Auditor: ${user?.name || 'Security Admin'} (${user?.role || 'ADMIN'})`, pageWidth - 220, 56);

      // KPI Executive Summary Cards
      const totalLogs = reportData.detailedLogs.length;
      const completedExits = reportData.detailedLogs.filter((l: any) => l.status === 'EXITED').length;
      const currentlyInside = reportData.detailedLogs.filter((l: any) => l.status === 'INSIDE').length;
      const activePreRegistered = reportData.detailedLogs.filter((l: any) => l.status === 'ACTIVE').length;

      let avgMins = 0;
      const completedWithDuration = reportData.detailedLogs.filter((l: any) => l.duration_minutes > 0);
      if (completedWithDuration.length > 0) {
        const sumMins = completedWithDuration.reduce((acc: number, curr: any) => acc + curr.duration_minutes, 0);
        avgMins = Math.round(sumMins / completedWithDuration.length);
      }
      const avgDurationText = avgMins > 0 ? `${Math.floor(avgMins / 60)}h ${avgMins % 60}m` : '--';

      // Summary block
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.roundedRect(40, 80, pageWidth - 80, 42, 6, 6, 'FD');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);

      const colW = (pageWidth - 80) / 5;
      doc.text(`Total Passes: ${totalLogs}`, 55, 105);
      doc.text(`Completed Visits: ${completedExits}`, 55 + colW, 105);
      doc.setTextColor(217, 119, 6); // amber-600
      doc.text(`Currently Inside: ${currentlyInside}`, 55 + colW * 2, 105);
      doc.setTextColor(30, 41, 59);
      doc.text(`Pre-Registered: ${activePreRegistered}`, 55 + colW * 3, 105);
      doc.text(`Avg Stay Duration: ${avgDurationText}`, 55 + colW * 4, 105);

      // Filter Range Note
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      const filterText = startDate && endDate ? `Filter Date Range: ${startDate} to ${endDate}` : 'Filter Date Range: All Historical Records';
      doc.text(filterText, 40, 134);

      // Table Data Preparation
      const tableHeaders = [
        ['Pass #', 'Visitor Name', 'Company', 'Host / Department', 'Purpose', 'Date', 'Entry Gate & Time', 'Exit Gate & Time', 'Duration', 'Status'],
      ];

      const tableRows = reportData.detailedLogs.map((log: any) => {
        const entryStr = log.entry_time
          ? `${formatTime(log.entry_time)}\n(${log.entry_gate || 'Gate'})`
          : '--';
        const exitStr = log.exit_time
          ? `${formatTime(log.exit_time)}\n(${log.exit_gate || 'Gate'})`
          : '--';
        const durStr = log.duration_minutes
          ? `${Math.floor(log.duration_minutes / 60)}h ${log.duration_minutes % 60}m`
          : '--';

        return [
          log.pass_number,
          log.visitor_name,
          log.company || 'Individual',
          `${log.host_name}\n${log.host_department || ''}`,
          log.purpose || 'General',
          log.visit_date,
          entryStr,
          exitStr,
          durStr,
          log.status,
        ];
      });

      // Render AutoTable
      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: 142,
        theme: 'striped',
        styles: {
          fontSize: 7.5,
          cellPadding: 4,
          textColor: [15, 23, 42],
          lineColor: [226, 232, 240],
          lineWidth: 0.5,
          valign: 'middle',
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 70 }, // Pass #
          1: { fontStyle: 'bold', cellWidth: 85 }, // Visitor
          2: { cellWidth: 80 }, // Company
          3: { cellWidth: 85 }, // Host
          4: { cellWidth: 80 }, // Purpose
          5: { cellWidth: 55 }, // Date
          6: { cellWidth: 80 }, // Entry
          7: { cellWidth: 80 }, // Exit
          8: { cellWidth: 50, halign: 'center' }, // Duration
          9: { cellWidth: 60, halign: 'center', fontStyle: 'bold' }, // Status
        },
        didDrawPage: (data) => {
          // Page Numbering Footer
          const str = `Page ${data.pageNumber} of ${doc.getNumberOfPages()}  |  Feng Qun Manufacturing Complex Gate Pass System  |  Confidential Audit Record`;
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(str, pageWidth / 2, pageHeight - 15, { align: 'center' });
        },
      });

      // Save PDF
      const filename = `FengQun_Visitor_History_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);

      setExportNotice('Visitor History PDF report downloaded.');
      setTimeout(() => setExportNotice(''), 3500);
      logExportAction('PDF', 'Visitor History Security Report', reportData.detailedLogs.length);
    } catch (err: any) {
      console.error('PDF generation error:', err);
      setExportNotice('Failed to generate PDF: ' + err.message);
      setTimeout(() => setExportNotice(''), 4000);
    }
  };

  // ========================================================
  // 5. SYSTEM AUDIT LOGS PDF EXPORT (using jsPDF + autoTable)
  // ========================================================
  const exportAuditLogsPDF = async () => {
    try {
      setExportNotice('Generating System Audit Logs PDF report...');
      let logs = auditLogs;
      if (!logs || logs.length === 0) {
        const res = await fetch('/api/audit-logs', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          logs = await res.json();
          setAuditLogs(logs);
        }
      }

      if (!logs || logs.length === 0) {
        setExportNotice('No audit records available for PDF.');
        setTimeout(() => setExportNotice(''), 3000);
        return;
      }

      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Top Industrial Header Bar
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 60, 'F');
      doc.setFillColor(16, 185, 129); // emerald-500 accent stripe
      doc.rect(0, 60, pageWidth, 4, 'F');

      // Title & Subtitle
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('FENG QUN MANUFACTURING COMPLEX', 40, 28);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(148, 163, 184);
      doc.text('SYSTEM AUDIT TRAIL & SECURITY EVENT LOG', 40, 46);

      // Security Classification
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(52, 211, 153);
      doc.text('CONFIDENTIAL / SYSTEM AUDIT', pageWidth - 230, 28);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225);
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 230, 42);
      doc.text(`Auditor: ${user?.name || 'Administrator'} (${user?.role || 'ADMIN'})`, pageWidth - 230, 54);

      const tableHeaders = [
        ['Timestamp', 'Actor / User', 'Action', 'Entity Type', 'Entity ID', 'Details / Value Changes', 'IP Address'],
      ];

      const tableRows = logs.map((log: any) => [
        formatDateTime(log.timestamp),
        `${log.user_name || 'System'}\n(${log.user_id || 'SYSTEM'})`,
        log.action,
        log.entity_type,
        log.entity_id || '--',
        log.new_value || log.old_value || '--',
        log.ip_address || '127.0.0.1',
      ]);

      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: 76,
        theme: 'striped',
        styles: {
          fontSize: 7.5,
          cellPadding: 4.5,
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 105 },
          1: { cellWidth: 95 },
          2: { cellWidth: 85, fontStyle: 'bold' },
          3: { cellWidth: 75 },
          4: { cellWidth: 70 },
          5: { cellWidth: 240 },
          6: { cellWidth: 70 },
        },
        didDrawPage: (data) => {
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `Page ${data.pageNumber} of ${doc.getNumberOfPages()}  |  Feng Qun Manufacturing Complex  |  Official Security Audit Trail`,
            pageWidth / 2,
            pageHeight - 15,
            { align: 'center' }
          );
        },
      });

      const dateStr = new Date().toISOString().slice(0, 10);
      doc.save(`FengQun_Security_Audit_Logs_${dateStr}.pdf`);
      setExportNotice('Security Audit Logs PDF downloaded successfully.');
      setTimeout(() => setExportNotice(''), 3500);
      logExportAction('PDF', 'System Audit Trail', logs.length);
    } catch (err: any) {
      console.error('Audit PDF error:', err);
      setExportNotice('Failed to generate Audit PDF: ' + err.message);
      setTimeout(() => setExportNotice(''), 4000);
    }
  };

  // ========================================================
  // 6. GATE ACTIVITY CHECKPOINT LEDGER (PDF)
  // ========================================================
  const exportActivityLedgerPDF = () => {
    if (!reportData.detailedLogs || reportData.detailedLogs.length === 0) {
      setExportNotice('No records available for activity log PDF.');
      setTimeout(() => setExportNotice(''), 3000);
      return;
    }

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Header
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 56, 'F');
      doc.setFillColor(59, 130, 246); // blue-500
      doc.rect(0, 56, pageWidth, 3, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('FENG QUN GATE ACTIVITY & CHECKPOINT LEDGER', 35, 28);
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(`Official Access Registry  •  Generated on ${new Date().toLocaleDateString()}`, 35, 44);

      const tableHeaders = [['Pass Number', 'Visitor Name', 'Company', 'Gate Action', 'Timestamp', 'Duration']];
      const tableRows = reportData.detailedLogs.map((log: any) => {
        const actionText = log.exit_time
          ? `EXITED (${log.exit_gate || 'Gate'})`
          : log.entry_time
          ? `INSIDE (${log.entry_gate || 'Gate'})`
          : 'ISSUED';
        const timeText = log.exit_time
          ? formatTime(log.exit_time)
          : log.entry_time
          ? formatTime(log.entry_time)
          : log.visit_date;
        const durText = log.duration_minutes
          ? `${Math.floor(log.duration_minutes / 60)}h ${log.duration_minutes % 60}m`
          : '--';

        return [log.pass_number, log.visitor_name, log.company || 'Individual', actionText, timeText, durText];
      });

      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: 75,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 5 },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
        didDrawPage: (data) => {
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `Page ${data.pageNumber} of ${doc.getNumberOfPages()}  •  Feng Qun Gate Activity Ledger`,
            pageWidth / 2,
            pageHeight - 15,
            { align: 'center' }
          );
        },
      });

      doc.save(`FengQun_Gate_Activity_Log_${new Date().toISOString().slice(0, 10)}.pdf`);
      setExportNotice('Gate Activity Log PDF downloaded.');
      setTimeout(() => setExportNotice(''), 3000);
      logExportAction('PDF', 'Gate Activity Ledger', reportData.detailedLogs.length);
    } catch (err: any) {
      console.error('Activity ledger PDF error:', err);
      setExportNotice('Failed to generate Activity PDF: ' + err.message);
      setTimeout(() => setExportNotice(''), 4000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Shield className="h-3 w-3 text-emerald-600" />
              <span>Audit & Compliance Center</span>
            </span>
            <span className="text-[11px] font-bold text-slate-500">Feng Qun Complex</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Security & Visitor Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Download certified audit trails, visitor registries, and facility access history in CSV (PapaParse) and PDF (jsPDF) formats.
          </p>
        </div>

        {/* Action Button Group */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Direct CSV Button */}
          <button
            onClick={activeTab === 'visitor_history' ? exportVisitorHistoryCSV : exportAuditLogsCSV}
            className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-2 cursor-pointer"
            title="Download CSV via PapaParse"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export CSV</span>
          </button>

          {/* Direct PDF Button */}
          <button
            onClick={activeTab === 'visitor_history' ? exportVisitorHistoryPDF : exportAuditLogsPDF}
            className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-2 cursor-pointer border border-slate-700"
            title="Download PDF via jsPDF"
          >
            <Download className="h-4 w-4 text-emerald-400" />
            <span>Export PDF Report</span>
          </button>

          {/* More Export Formats Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="px-3 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>More Options</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-30 animate-in fade-in zoom-in-95 text-xs">
                <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Visitor History Exports (PapaParse & jsPDF)
                </div>
                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    exportVisitorHistoryCSV();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 flex items-center gap-2 text-slate-800 font-semibold"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div>
                    <div>Visitor History (CSV)</div>
                    <div className="text-[10px] text-slate-400 font-normal">PapaParse formatted raw visitor registry</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    exportVisitorHistoryPDF();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 flex items-center gap-2 text-slate-800 font-semibold"
                >
                  <FileText className="h-4 w-4 text-rose-600 shrink-0" />
                  <div>
                    <div>Visitor History (PDF)</div>
                    <div className="text-[10px] text-slate-400 font-normal">Landscape A4 executive report with KPI cards</div>
                  </div>
                </button>

                <div className="border-t border-slate-100 my-1.5"></div>
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  System Audit Logs Exports
                </div>
                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    exportAuditLogsCSV();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 flex items-center gap-2 text-slate-800 font-semibold"
                >
                  <FileSpreadsheet className="h-4 w-4 text-blue-600 shrink-0" />
                  <div>
                    <div>System Audit Logs (CSV)</div>
                    <div className="text-[10px] text-slate-400 font-normal">PapaParse compliance security events</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    exportAuditLogsPDF();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 flex items-center gap-2 text-slate-800 font-semibold"
                >
                  <FileText className="h-4 w-4 text-indigo-600 shrink-0" />
                  <div>
                    <div>System Audit Logs (PDF)</div>
                    <div className="text-[10px] text-slate-400 font-normal">Official jsPDF certified security audit trail</div>
                  </div>
                </button>

                <div className="border-t border-slate-100 my-1.5"></div>
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Additional Analytics
                </div>
                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    exportSummaryCSV();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 flex items-center gap-2 text-slate-800 font-semibold"
                >
                  <Building className="h-4 w-4 text-teal-600 shrink-0" />
                  <div>
                    <div>Department Summary (CSV)</div>
                    <div className="text-[10px] text-slate-400 font-normal">Aggregated host & department volume</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    exportActivityLedgerPDF();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 flex items-center gap-2 text-slate-800 font-semibold"
                >
                  <Clock className="h-4 w-4 text-purple-600 shrink-0" />
                  <div>
                    <div>Gate Activity Ledger (PDF)</div>
                    <div className="text-[10px] text-slate-400 font-normal">Chronological checkpoint scan logs</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {exportNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs text-emerald-900 font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{exportNotice}</span>
          </div>
          <button onClick={() => setExportNotice('')} className="text-emerald-700 hover:text-emerald-900 text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Tabs Selector: Visitor History vs Audit Logs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('visitor_history')}
          className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'visitor_history'
              ? 'bg-slate-900 text-white shadow'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Visitor History & Analytics</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-emerald-400">
            {reportData.detailedLogs?.length || 0}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('audit_logs');
            if (auditLogs.length === 0) fetchAuditLogs();
          }}
          className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'audit_logs'
              ? 'bg-slate-900 text-white shadow'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Activity className="h-4 w-4 text-emerald-400" />
          <span>System Audit Logs</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-blue-300">
            {auditLogs.length || '•'}
          </span>
        </button>
      </div>

      {activeTab === 'visitor_history' ? (
        <>
          {/* Date Filter Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-emerald-600" />
                Filter Period:
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={fetchReports}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Apply Filter
              </button>
              {(startDate || endDate) && (
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    fetchReports();
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="text-[11px] text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-900">{reportData.detailedLogs?.length || 0}</span> recorded visitor logs
            </div>
          </div>

          {/* Analytics Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Visitors by Department */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">Visits by Department</h3>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">{reportData.byDepartment?.length || 0} depts</span>
              </div>
              <div className="space-y-2 text-xs max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                {reportData.byDepartment?.length > 0 ? (
                  reportData.byDepartment.map((dept: any) => (
                    <div key={dept.host_department} className="flex justify-between items-center p-2 rounded-xl bg-slate-50">
                      <span className="font-semibold text-slate-800">{dept.host_department}</span>
                      <span className="font-bold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full text-[11px]">
                        {dept.total_visits} passes
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 py-6 text-center">No data available</div>
                )}
              </div>
            </div>

            {/* Visitors by Company */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">Top Visiting Organizations</h3>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">{reportData.byCompany?.length || 0} orgs</span>
              </div>
              <div className="space-y-2 text-xs max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                {reportData.byCompany?.length > 0 ? (
                  reportData.byCompany.map((comp: any) => (
                    <div key={comp.company} className="flex justify-between items-center p-2 rounded-xl bg-slate-50">
                      <span className="font-semibold text-slate-800 truncate max-w-[170px]" title={comp.company}>
                        {comp.company || 'Direct Individuals'}
                      </span>
                      <span className="font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[11px]">
                        {comp.total_visits} visits
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 py-6 text-center">No data available</div>
                )}
              </div>
            </div>

            {/* Top Host Personnel */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-600" />
                  <h3 className="text-sm font-bold text-slate-900">Most Visited Hosts</h3>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">{reportData.byHost?.length || 0} hosts</span>
              </div>
              <div className="space-y-2 text-xs max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                {reportData.byHost?.length > 0 ? (
                  reportData.byHost.map((host: any) => (
                    <div key={host.host_name} className="flex justify-between items-center p-2 rounded-xl bg-slate-50">
                      <div>
                        <div className="font-semibold text-slate-800">{host.host_name}</div>
                        <div className="text-[10px] text-slate-400">{host.host_department}</div>
                      </div>
                      <span className="font-bold bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full text-[11px]">
                        {host.total_visits} visits
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 py-6 text-center">No data available</div>
                )}
              </div>
            </div>
          </div>

          {/* Complete Entry / Exit Ledger */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Official Entry & Exit Audit Ledger</h3>
                <p className="text-xs text-slate-500">Chronological history with stay durations and gate check-in/out stations</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={exportVisitorHistoryCSV}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  title="Export Visitor History to CSV using PapaParse"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>CSV (PapaParse)</span>
                </button>
                <button
                  onClick={exportVisitorHistoryPDF}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  title="Export Visitor History to PDF using jsPDF"
                >
                  <FileText className="h-3.5 w-3.5 text-rose-600" />
                  <span>PDF (jsPDF)</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Pass No</th>
                    <th className="px-4 py-3">Visitor</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Host</th>
                    <th className="px-4 py-3">Visit Date</th>
                    <th className="px-4 py-3">Entry Log</th>
                    <th className="px-4 py-3">Exit Log</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {reportData.detailedLogs?.length > 0 ? (
                    reportData.detailedLogs.map((log: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {log.pass_number}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">{log.visitor_name}</td>
                        <td className="px-4 py-3 text-slate-600">{log.company || 'Individual'}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{log.host_name}</div>
                          <div className="text-[10px] text-slate-400">{log.host_department}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(log.visit_date)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {log.entry_time ? (
                            <div>
                              <div className="font-semibold text-emerald-700">{formatTime(log.entry_time)}</div>
                              <div className="text-[10px] text-slate-400">{log.entry_gate}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {log.exit_time ? (
                            <div>
                              <div className="font-semibold text-blue-700">{formatTime(log.exit_time)}</div>
                              <div className="text-[10px] text-slate-400">{log.exit_gate}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap">
                          {log.duration_minutes > 0 ? (
                            <span className="font-semibold text-slate-800">
                              {Math.floor(log.duration_minutes / 60)}h {log.duration_minutes % 60}m
                            </span>
                          ) : log.entry_time && !log.exit_time ? (
                            <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              Active
                            </span>
                          ) : (
                            <span className="text-slate-400">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.status === 'EXITED'
                                ? 'bg-slate-100 text-slate-700'
                                : log.status === 'INSIDE'
                                ? 'bg-amber-100 text-amber-800 animate-pulse'
                                : log.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.status === 'PENDING_APPROVAL'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        {isLoading ? 'Loading records...' : 'No activity records found matching filters'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* SYSTEM AUDIT LOGS VIEW */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Certified System Audit Trail</h3>
              </div>
              <p className="text-xs text-slate-500">
                Immutable chronological event log of pass approvals, security gate actions, and administrative activities.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchAuditLogs}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                title="Refresh audit logs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingAudit ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={exportAuditLogsCSV}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                title="Download Audit Logs as CSV with PapaParse"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" />
                <span>Export CSV (PapaParse)</span>
              </button>
              <button
                onClick={exportAuditLogsPDF}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                title="Download Official Audit PDF with jsPDF"
              >
                <FileText className="h-3.5 w-3.5 text-emerald-400" />
                <span>Export PDF (jsPDF)</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor / User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity Type</th>
                  <th className="px-4 py-3">Entity ID</th>
                  <th className="px-4 py-3">Details / Value Changes</th>
                  <th className="px-4 py-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {auditLogs.length > 0 ? (
                  auditLogs.map((log: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap text-slate-600">
                        {formatDateTime(log.timestamp)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{log.user_name || 'System'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{log.user_id || 'SYSTEM'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono ${
                            log.action === 'ENTRY'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.action === 'EXIT'
                              ? 'bg-slate-200 text-slate-800'
                              : log.action === 'CREATE_PASS'
                              ? 'bg-blue-100 text-blue-800'
                              : log.action === 'APPROVE_PASS'
                              ? 'bg-teal-100 text-teal-800'
                              : log.action === 'REJECT_PASS' || log.action === 'CANCEL_PASS'
                              ? 'bg-rose-100 text-rose-800'
                              : log.action === 'EXPIRE_PASS'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{log.entity_type}</td>
                      <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{log.entity_id || '--'}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={log.new_value || log.old_value}>
                        {log.new_value || log.old_value || '--'}
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{log.ip_address || '127.0.0.1'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      {isLoadingAudit ? 'Loading audit trail...' : 'No system audit logs recorded yet'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
export default ReportsPage;
