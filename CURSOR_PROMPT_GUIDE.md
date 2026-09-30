# Cursor AI Specification & Implementation Guide
## Factory Visitor Gate Pass Management System (React + Node.js)

This document contains the prompt and system architecture tailored for **Cursor IDE** (Composer / Agent mode) using **React (Vite + TypeScript + Tailwind CSS)** and **Node.js (Express + TypeScript + SQLite/PostgreSQL)**.

---

### Optimized Cursor System Prompt (.cursorrules)

```markdown
You are a senior full-stack software engineer building a production-ready Factory Visitor Gate Pass Management System.
The system is mobile-first, high-contrast industrial grade, and powered by QR code entry/exit verification.

Core Stack:
- Frontend: React 19, TypeScript, Tailwind CSS v4, Lucide React Icons, jsQR (browser webcam decoder), qrcode (generator)
- Backend: Node.js (Express), TypeScript (tsx), SQLite / PostgreSQL relational tables
- Authentication: Role-Based Access Control (Admin, Reception/HR, Security Guard) with secure signed session tokens

Strict Architecture Rules:
1. QR Verification Rule: Never trust QR payload content. QR contains only an unguessable 256-bit token. The backend verifies validity, expiration, and current entry/exit state.
2. State Transition Machine:
   - ACTIVE pass + RECORD ENTRY -> INSIDE
   - INSIDE pass + RECORD EXIT -> EXITED (with duration calculation)
   - Disallow re-entry after exit unless explicitly renewed
   - Disallow EXIT before ENTRY
   - Disallow ENTRY on EXPIRED or CANCELLED passes
3. Security Guard UX:
   - Auto-default to scanner view
   - Active Gate selector (Main Gate, North Gate, South Gate, etc.)
   - Web camera scanner with instant audio beep feedback
   - Manual Pass ID lookup fallback (e.g. VP-2026-000125)
   - Large green [ RECORD ENTRY ] and amber [ RECORD EXIT ] buttons
4. Emergency Muster List:
   - Dedicated "Currently Inside" headcount view with real-time poll
   - 1-click evacuation muster checklist and printable roster for safety wardens
5. Printable & Mobile Passes:
   - Printable pass with factory branding, visitor photo, safety rules, and QR badge
   - Mobile wallet view accessible via public URL
```

---

### Testing Acceptance Checklist (Scenario Verification)

1. **Admin Login**:
   - Email: `admin@example.com` / `admin123`
2. **Create Pass**:
   - Create visitor `Md. Rahim Ahmed` (ABC Trading Ltd.), Host: `Mr. Karim` (Purchase).
   - Generates pass number `VP-2026-000125` and QR code.
3. **Security Guard Login & Scan**:
   - Switch role to `Security Guard` (`security@example.com` / `security123`).
   - Open scanner, scan or enter `VP-2026-000125`.
   - Server verifies pass -> Shows large green **[ RECORD ENTRY ]**.
   - Guard presses `[ RECORD ENTRY ]` -> Gate `Main Gate`, guard name, and timestamp logged.
   - Status changes to `INSIDE`.
4. **Emergency Evacuation Check**:
   - Navigate to "Currently Inside" -> `Md. Rahim Ahmed` is listed with live entry timestamp.
5. **Visitor Exit**:
   - Security scans `VP-2026-000125` again -> Shows **[ RECORD EXIT ]** with entry time.
   - Guard presses `[ RECORD EXIT ]` -> Status changes to `EXITED` and visit duration is calculated.
6. **Double-Scan Protection**:
   - Scanning the pass again displays `ALREADY EXITED` and forbids further entries.
