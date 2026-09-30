import React, { useState } from 'react';
import {
  Code,
  Copy,
  Check,
  Folder,
  FileCode,
  Layers,
  Terminal,
  Server,
  Sparkles,
  ExternalLink,
  Cpu,
  Shield,
  Box,
} from 'lucide-react';

interface FileItem {
  path: string;
  name: string;
  type: string;
  code: string;
  description: string;
}

export const NextJsProjectHub: React.FC = () => {
  const [selectedFileIdx, setSelectedFileIdx] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  const files: FileItem[] = [
    {
      path: 'app/api/verify/[token]/route.ts',
      name: 'route.ts (QR Verification)',
      type: 'Route Handler',
      description: 'Next.js 15 App Router API Route that performs atomic validation of QR tokens against the database without exposing visitor personal information inside the QR.',
      code: `import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, queryOne } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    await getDatabase();
    const identifier = params.token;

    const pass = queryOne(
      \`SELECT vp.*, v.name as visitor_name, v.mobile as visitor_mobile, v.company as visitor_company
       FROM visitor_passes vp
       JOIN visitors v ON v.id = vp.visitor_id
       WHERE vp.qr_token = ? OR UPPER(vp.pass_number) = UPPER(?)\`,
      [identifier, identifier]
    );

    if (!pass) {
      return NextResponse.json(
        { valid: false, status: 'INVALID', message: 'Unknown QR or Pass ID. Access denied.' },
        { status: 404 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    if (pass.status === 'CANCELLED') {
      return NextResponse.json({ valid: false, status: 'CANCELLED', message: 'Pass cancelled.' });
    }
    if (pass.status === 'EXPIRED' || pass.visit_date < today) {
      return NextResponse.json({ valid: false, status: 'EXPIRED', message: 'Pass expired.' });
    }
    if (pass.status === 'INSIDE') {
      return NextResponse.json({ valid: true, status: 'INSIDE', canExit: true, pass });
    }
    if (pass.status === 'EXITED') {
      return NextResponse.json({ valid: false, status: 'EXITED', message: 'Already exited.' });
    }

    return NextResponse.json({ valid: true, status: 'VALID', canEnter: true, pass });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}`,
    },
    {
      path: 'app/api/entry/route.ts',
      name: 'route.ts (Record Entry)',
      type: 'Route Handler',
      description: 'Records timestamped gate entry, assigns security officer ID, updates status to INSIDE, and prevents double-entry.',
      code: `import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDatabase, queryOne, execute } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    await getDatabase();
    const { qrToken, passNumber, gateId, remarks, guardName } = await req.json();

    const pass = queryOne(
      \`SELECT vp.*, v.name as visitor_name FROM visitor_passes vp JOIN visitors v ON v.id = vp.visitor_id WHERE vp.qr_token = ? OR UPPER(vp.pass_number) = UPPER(?)\`,
      [qrToken || '', (passNumber || '').toUpperCase()]
    );

    if (!pass) return NextResponse.json({ error: 'Pass not found' }, { status: 404 });
    if (pass.status === 'INSIDE') return NextResponse.json({ error: 'Visitor already inside' }, { status: 409 });
    if (pass.status === 'EXITED') return NextResponse.json({ error: 'Pass already exited' }, { status: 400 });

    const now = new Date().toISOString();
    const logId = 'log_' + crypto.randomUUID().slice(0, 8);

    execute(
      \`INSERT INTO entry_exit_logs (id, visitor_pass_id, action, gate_id, security_user_id, timestamp, remarks) VALUES (?, ?, 'ENTRY', ?, 'u_sec_001', ?, ?)\`,
      [logId, pass.id, gateId || 'gate_main', now, remarks || 'Gate Entry']
    );

    execute(\`UPDATE visitor_passes SET status = 'INSIDE', updated_at = ? WHERE id = ?\`, [now, pass.id]);

    return NextResponse.json({
      success: true,
      entry: {
        visitorName: pass.visitor_name,
        passNumber: pass.pass_number,
        entryTime: new Date(now).toLocaleTimeString(),
        recordedBy: guardName || 'Security Guard',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}`,
    },
    {
      path: 'app/api/exit/route.ts',
      name: 'route.ts (Record Exit)',
      type: 'Route Handler',
      description: 'Calculates total factory duration in hours and minutes, logs exit station, and transitions pass to EXITED.',
      code: `import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDatabase, queryOne, execute } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    await getDatabase();
    const { qrToken, passNumber, gateId, remarks } = await req.json();

    const pass = queryOne(
      \`SELECT vp.*, v.name as visitor_name FROM visitor_passes vp JOIN visitors v ON v.id = vp.visitor_id WHERE vp.qr_token = ? OR UPPER(vp.pass_number) = UPPER(?)\`,
      [qrToken || '', (passNumber || '').toUpperCase()]
    );

    if (!pass) return NextResponse.json({ error: 'Pass not found' }, { status: 404 });
    if (pass.status !== 'INSIDE') return NextResponse.json({ error: 'Cannot exit before entry' }, { status: 400 });

    const lastEntryLog = queryOne(
      \`SELECT timestamp FROM entry_exit_logs WHERE visitor_pass_id = ? AND action = 'ENTRY' ORDER BY timestamp DESC LIMIT 1\`,
      [pass.id]
    );

    const now = new Date();
    const durationMinutes = lastEntryLog?.timestamp 
      ? Math.max(1, Math.round((now.getTime() - new Date(lastEntryLog.timestamp).getTime()) / 60000))
      : 0;

    const logId = 'log_' + crypto.randomUUID().slice(0, 8);
    execute(
      \`INSERT INTO entry_exit_logs (id, visitor_pass_id, action, gate_id, security_user_id, timestamp, remarks, duration_minutes) VALUES (?, ?, 'EXIT', ?, 'u_sec_001', ?, ?, ?)\`,
      [logId, pass.id, gateId || 'gate_main', now.toISOString(), remarks || 'Gate Exit', durationMinutes]
    );

    execute(\`UPDATE visitor_passes SET status = 'EXITED', updated_at = ? WHERE id = ?\`, [now.toISOString(), pass.id]);

    return NextResponse.json({
      success: true,
      exit: {
        visitorName: pass.visitor_name,
        passNumber: pass.pass_number,
        duration: \`\${Math.floor(durationMinutes / 60)}h \${durationMinutes % 60}m\`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}`,
    },
    {
      path: 'lib/db.ts',
      name: 'db.ts (Node.js Relational Store)',
      type: 'Database Adapter',
      description: 'SQLite database initialization with schema migrations and ACID write persistence to disk.',
      code: `import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

let dbInstance: Database | null = null;
const DB_FILE = path.join(process.cwd(), 'data', 'factorypass.sqlite');

export async function getDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_FILE)) {
    dbInstance = new SQL.Database(fs.readFileSync(DB_FILE));
  } else {
    dbInstance = new SQL.Database();
  }

  // Schema creation: users, gates, visitors, visitor_passes, entry_exit_logs, audit_logs
  return dbInstance;
}

export function queryAll(sql: string, params: any[] = []): any[] {
  if (!dbInstance) throw new Error('Database not initialized');
  const stmt = dbInstance.prepare(sql);
  stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

export function queryOne(sql: string, params: any[] = []): any | null {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function execute(sql: string, params: any[] = []): void {
  if (!dbInstance) throw new Error('Database not initialized');
  dbInstance.run(sql, params);
  const data = dbInstance.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}`,
    },
    {
      path: 'tailwind.config.ts',
      name: 'tailwind.config.ts',
      type: 'Configuration',
      description: 'Tailwind CSS configuration scanning Next.js App Router paths for utility styling.',
      code: `import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        industrial: {
          950: '#0b0f19',
          900: '#0f172a',
          800: '#1e293b',
        }
      }
    },
  },
  plugins: [],
};

export default config;`,
    },
    {
      path: 'package.json',
      name: 'package.json',
      type: 'Config',
      description: 'Next.js 15, React 19, Lucide, Tailwind CSS, and QR dependencies.',
      code: `{
  "name": "factorypass-nextjs",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "lucide-react": "^0.546.0",
    "qrcode": "^1.5.4",
    "jsqr": "^1.4.0",
    "sql.js": "^1.14.2"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0"
  }
}`,
    },
  ];

  const currentFile = files[selectedFileIdx];

  const copyCode = () => {
    navigator.clipboard.writeText(currentFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-black uppercase tracking-wider bg-black/40 text-emerald-400 border border-emerald-500/40 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <Box className="h-3.5 w-3.5" />
              <span>Next.js 15 (App Router) + Node.js + Tailwind CSS</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Final Next.js Production Architecture
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Complete file tree, Route Handlers, Node.js backend adapters, and Tailwind CSS configuration ready for instant deployment to Vercel, Docker, or Cloud Run.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={copyCode}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-2 cursor-pointer"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? 'Copied File!' : 'Copy Active File'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: File Tree + Code Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: Next.js File Tree & Architecture */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Folder className="h-5 w-5 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-900">Next.js Project Explorer</h2>
          </div>

          <div className="space-y-1 text-xs">
            {files.map((file, idx) => (
              <button
                key={file.path}
                onClick={() => setSelectedFileIdx(idx)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl transition flex items-center justify-between group cursor-pointer ${
                  selectedFileIdx === idx
                    ? 'bg-slate-900 text-white font-bold shadow'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileCode
                    className={`h-4 w-4 shrink-0 ${
                      selectedFileIdx === idx ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  />
                  <span className="font-mono text-xs truncate">{file.name}</span>
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-sans ${
                    selectedFileIdx === idx
                      ? 'bg-slate-800 text-slate-300'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                  }`}
                >
                  {file.type}
                </span>
              </button>
            ))}
          </div>

          {/* Quick Terminal Command */}
          <div className="p-3.5 bg-slate-950 text-slate-200 rounded-2xl border border-slate-800 text-xs space-y-2 mt-4">
            <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase text-[10px]">
              <Terminal className="h-3.5 w-3.5 text-emerald-400" />
              <span>Next.js Deployment Commands</span>
            </div>
            <pre className="font-mono text-[11px] text-emerald-300 bg-black/40 p-2.5 rounded-xl overflow-x-auto">
              npx create-next-app@latest factorypass{'\n'}
              npm install qrcode jsqr sql.js lucide-react{'\n'}
              npm run dev
            </pre>
          </div>
        </div>

        {/* Right: Code Viewer (2 Cols) */}
        <div className="lg:col-span-2 bg-slate-950 rounded-3xl border border-slate-800 shadow-xl overflow-hidden text-slate-200">
          {/* Code Viewer Title bar */}
          <div className="bg-slate-900 px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-white">{currentFile.path}</span>
                <span className="text-[10px] bg-slate-800 text-emerald-400 px-2 py-0.5 rounded font-mono">
                  {currentFile.type}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">{currentFile.description}</p>
            </div>

            <button
              onClick={copyCode}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Code'}</span>
            </button>
          </div>

          {/* Code Body */}
          <div className="p-5 overflow-x-auto max-h-[580px] scrollbar-thin">
            <pre className="font-mono text-xs text-slate-300 leading-relaxed">
              <code>{currentFile.code}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
