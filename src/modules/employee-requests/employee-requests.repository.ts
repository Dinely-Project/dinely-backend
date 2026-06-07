import { supabase } from '../../config/supabase';
import {
  EmployeeRequest,
  EmployeeRequestWithEmployee,
  RequestStatus,
  RequestType,
} from '../../types';
import { EmployeeRequestSchema } from '../../types/schemas';

type RawEmployeeRequestRow = EmployeeRequest & {
  users?:
    | {
        name?: string | null;
        email?: string | null;
      }
    | Array<{
        name?: string | null;
        email?: string | null;
      }>
    | null;
};

const parseEmployeeRequest = (row: unknown): EmployeeRequest =>
  EmployeeRequestSchema.parse(row);

const enrichEmployeeRequest = (row: RawEmployeeRequestRow): EmployeeRequestWithEmployee => {
  const request = parseEmployeeRequest(row);
  const employee = Array.isArray(row.users) ? row.users[0] : row.users;

  return {
    ...request,
    employee_name: employee?.name ?? 'Unknown',
    employee_email: employee?.email ?? '',
  };
};

export const findPendingEmployeeRequest = async (
  employeeId: string,
  type: RequestType
): Promise<EmployeeRequest | null> => {
  const { data, error } = await supabase
    .from('employee_requests')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('type', type)
    .eq('status', 'PENDING')
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch pending request: ${error.message}`);
  }

  if (!data || data.length === 0) return null;
  return parseEmployeeRequest(data[0]);
};

export const insertEmployeeRequest = async (payload: {
  employee_id: string;
  type: RequestType;
  cover_letter: string | null;
}): Promise<EmployeeRequest> => {
  const { data, error } = await supabase
    .from('employee_requests')
    .insert({ ...payload, status: 'PENDING' })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create employee request: ${error?.message ?? 'No data returned'}`
    );
  }

  return parseEmployeeRequest(data);
};

export const getEmployeeRequestsByEmployee = async (
  employeeId: string,
  filters?: { status?: RequestStatus }
): Promise<EmployeeRequest[]> => {
  let query = supabase
    .from('employee_requests')
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch employee requests: ${error.message}`);
  }

  return ((data ?? []) as unknown[]).map((row) => parseEmployeeRequest(row));
};

export const getEmployeeRequestById = async (
  id: string
): Promise<EmployeeRequest | null> => {
  const { data, error } = await supabase
    .from('employee_requests')
    .select('*')
    .eq('id', id)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch employee request: ${error.message}`);
  }

  if (!data || data.length === 0) return null;
  return parseEmployeeRequest(data[0]);
};

export const getAllEmployeeRequests = async (filters?: {
  status?: RequestStatus;
  type?: RequestType;
}): Promise<EmployeeRequestWithEmployee[]> => {
  let query = supabase
    .from('employee_requests')
    .select('*, users!employee_id(name, email)')
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.type) {
    query = query.eq('type', filters.type);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch employee requests: ${error.message}`);
  }

  return ((data ?? []) as RawEmployeeRequestRow[]).map((row) =>
    enrichEmployeeRequest(row)
  );
};

export const getEmployeeRequestWithEmployeeById = async (
  id: string
): Promise<EmployeeRequestWithEmployee | null> => {
  const { data, error } = await supabase
    .from('employee_requests')
    .select('*, users!employee_id(name, email)')
    .eq('id', id)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch employee request detail: ${error.message}`);
  }

  if (!data || data.length === 0) return null;
  return enrichEmployeeRequest(data[0] as RawEmployeeRequestRow);
};

export const updateEmployeeRequestReview = async (
  id: string,
  payload: {
    status: Exclude<RequestStatus, 'PENDING'>;
    admin_feedback: string | null;
    reviewed_by: string;
    reviewed_at: string;
  }
): Promise<EmployeeRequest> => {
  const { data, error } = await supabase
    .from('employee_requests')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to review employee request: ${error?.message ?? 'No data returned'}`
    );
  }

  return parseEmployeeRequest(data);
};
