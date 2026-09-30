export type UserRole = 'ADMIN' | 'MANAGER' | 'RECEPTION' | 'SECURITY';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: string;
  assignedGateId?: string;
}

export interface Gate {
  id: string;
  gate_name: string;
  gate_code: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at?: string;
}

export type PassStatus = 'PENDING_APPROVAL' | 'PENDING' | 'ACTIVE' | 'INSIDE' | 'EXITED' | 'EXPIRED' | 'CANCELLED' | 'REJECTED';

export interface VisitorPass {
  id: string;
  pass_number: string;
  visitor_id?: string;
  visitor_name: string;
  visitor_company?: string;
  visitor_mobile: string;
  visitor_email?: string;
  visitor_designation?: string;
  visitor_photo?: string;
  visitor_id_type?: string;
  visitor_id_number?: string;
  visitor_address?: string;
  host_name: string;
  host_department: string;
  purpose: string;
  visit_date: string;
  expected_arrival: string;
  expected_departure: string;
  number_of_visitors: number;
  vehicle_type: string;
  vehicle_number?: string;
  remarks?: string;
  qr_token: string;
  status: PassStatus;
  requires_approval?: boolean | number;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  approval_remarks?: string;
  cancel_reason?: string;
  creator_name?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  entry_time?: string;
  exit_time?: string;
  last_gate_name?: string;
}

export interface EntryExitLog {
  id: string;
  visitor_pass_id: string;
  action: 'ENTRY' | 'EXIT';
  gate_id: string;
  gate_name?: string;
  gate_code?: string;
  security_user_id: string;
  security_guard_name?: string;
  timestamp: string;
  device_information?: string;
  remarks?: string;
  duration_minutes?: number;
}

export interface VerificationResult {
  valid: boolean;
  status: 'VALID' | 'PENDING_APPROVAL' | 'INSIDE' | 'EXITED' | 'EXPIRED' | 'CANCELLED' | 'REJECTED' | 'FUTURE_DATE' | 'INVALID';
  title: string;
  message: string;
  reason?: string;
  canEnter?: boolean;
  canExit?: boolean;
  pass?: VisitorPass;
  lastEntry?: EntryExitLog | null;
  lastExit?: EntryExitLog | null;
  logs?: EntryExitLog[];
}

export interface DashboardStats {
  todayVisitors: number;
  currentlyInside: number;
  expectedToday: number;
  exitedToday: number;
  pendingApproval?: number;
}
