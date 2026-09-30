import crypto from 'crypto';
import { queryAll, execute } from './db.ts';

export interface PassExpiryCandidate {
  id: string;
  pass_number: string;
  visitor_id: string;
  host_name: string;
  status: string;
  visit_date: string;
  expected_departure?: string | null;
  expires_at?: string | null;
}

/**
 * Determines if a pass is expired based on its visit_date and expected_departure time.
 * A pass is expired if:
 * 1. visit_date is strictly before the current date (e.g. yesterday or earlier), OR
 * 2. visit_date is today AND the current time exceeds expected_departure (e.g. 17:00).
 */
export function isPassExpired(
  pass: any,
  now = new Date()
): boolean {
  if (!pass || !pass.visit_date) return false;

  const todayIso = now.toISOString().slice(0, 10);

  // 1. If visit date is before today, it is strictly expired
  if (pass.visit_date < todayIso) {
    return true;
  }

  // 2. If visit date is strictly in the future, it is not expired
  if (pass.visit_date > todayIso) {
    return false;
  }

  // 3. If visit date is today, check expected_departure
  // Extract current time in HH:MM (both UTC and local hours)
  const currentUtcHours = now.getUTCHours().toString().padStart(2, '0');
  const currentUtcMinutes = now.getUTCMinutes().toString().padStart(2, '0');
  const currentUtcTime = `${currentUtcHours}:${currentUtcMinutes}`;

  const currentLocalHours = now.getHours().toString().padStart(2, '0');
  const currentLocalMinutes = now.getMinutes().toString().padStart(2, '0');
  const currentLocalTime = `${currentLocalHours}:${currentLocalMinutes}`;

  const departure = (pass.expected_departure || '').trim();

  if (departure && /^\d{1,2}:\d{2}/.test(departure)) {
    const normDep = departure.length === 4 ? `0${departure}` : departure.slice(0, 5);
    // If either local time or UTC time has passed the expected departure on today's date
    if (currentLocalTime > normDep || currentUtcTime > normDep) {
      return true;
    }
  }

  // Also check explicit expires_at if provided
  if (pass.expires_at) {
    const expDate = new Date(pass.expires_at);
    if (!isNaN(expDate.getTime()) && now > expDate) {
      return true;
    }
  }

  return false;
}

/**
 * Checks all passes with status 'ACTIVE', 'PENDING', 'PENDING_APPROVAL', or 'APPROVAL_PENDING'
 * and automatically transitions any expired passes to 'EXPIRED'.
 * Inserts an audit log entry for each transition.
 */
export function checkAndTransitionExpiredPasses(now = new Date()): {
  expiredCount: number;
  transitionedPasses: Array<{ id: string; passNumber: string; oldStatus: string }>;
} {
  const candidates = queryAll(
    `SELECT id, pass_number, visitor_id, host_name, status, visit_date, expected_departure, expires_at
     FROM visitor_passes
     WHERE status IN ('ACTIVE', 'PENDING', 'PENDING_APPROVAL', 'APPROVAL_PENDING')`
  ) as unknown as PassExpiryCandidate[];

  const nowIso = now.toISOString();
  const transitioned: Array<{ id: string; passNumber: string; oldStatus: string }> = [];

  for (const pass of candidates) {
    if (isPassExpired(pass, now)) {
      // Transition to EXPIRED
      execute(
        `UPDATE visitor_passes 
         SET status = 'EXPIRED', updated_at = ?
         WHERE id = ?`,
        [nowIso, pass.id]
      );

      // Audit log entry
      execute(
        `INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, old_value, new_value, ip_address, timestamp)
         VALUES (?, 'SYSTEM', 'AUTO_EXPIRY_ENGINE', 'EXPIRE_PASS', 'VISITOR_PASS', ?, ?, 'EXPIRED', '127.0.0.1', ?)`,
        [
          'aud_' + crypto.randomUUID().slice(0, 8),
          pass.id,
          `${pass.status} (Visit date: ${pass.visit_date}, departure: ${pass.expected_departure || 'N/A'})`,
          nowIso,
        ]
      );

      transitioned.push({
        id: pass.id,
        passNumber: pass.pass_number,
        oldStatus: pass.status,
      });
    }
  }

  if (transitioned.length > 0) {
    console.log(`[AutoExpiryEngine] Automatically transitioned ${transitioned.length} pass(es) to EXPIRED:`, transitioned.map((p) => `${p.passNumber} (${p.oldStatus} -> EXPIRED)`).join(', '));
  }

  return {
    expiredCount: transitioned.length,
    transitionedPasses: transitioned,
  };
}

let lastCheckTime = 0;
const THROTTLE_MS = 10000; // Check at most once every 10 seconds on middleware hits

/**
 * Express middleware that checks and transitions expired passes before processing API requests.
 */
export function autoExpireMiddleware(req: any, res: any, next: any) {
  const now = Date.now();
  if (now - lastCheckTime > THROTTLE_MS) {
    lastCheckTime = now;
    try {
      checkAndTransitionExpiredPasses();
    } catch (err) {
      console.error('[AutoExpiryEngine] Middleware error checking expired passes:', err);
    }
  }
  next();
}

let expiryIntervalTimer: NodeJS.Timeout | null = null;

/**
 * Starts the server-side scheduled background interval (runs every intervalMs, default 30s).
 */
export function startExpiryScheduledJob(intervalMs = 30000): NodeJS.Timeout {
  if (expiryIntervalTimer) {
    clearInterval(expiryIntervalTimer);
  }

  // Initial immediate run
  try {
    checkAndTransitionExpiredPasses();
  } catch (err) {
    console.error('[AutoExpiryEngine] Initial run error:', err);
  }

  // Recurring scheduled job
  expiryIntervalTimer = setInterval(() => {
    try {
      checkAndTransitionExpiredPasses();
    } catch (err) {
      console.error('[AutoExpiryEngine] Scheduled job error:', err);
    }
  }, intervalMs);

  console.log(`[AutoExpiryEngine] Server-side scheduled expiry job active (every ${intervalMs / 1000}s).`);
  return expiryIntervalTimer;
}
