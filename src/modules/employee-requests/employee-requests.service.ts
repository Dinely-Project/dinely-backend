import { insertNotification } from '../notifications/notification.repository';
import {
  EmployeeRequest,
  EmployeeRequestWithEmployee,
  RequestStatus,
  RequestType,
} from '../../types';
import {
  findPendingEmployeeRequest,
  getAllEmployeeRequests,
  getEmployeeRequestById,
  getEmployeeRequestsByEmployee,
  getEmployeeRequestWithEmployeeById,
  insertEmployeeRequest,
  updateEmployeeRequestReview,
} from './employee-requests.repository';

export const submitEmployeeRequest = async (
  employeeId: string,
  payload: { type: RequestType; cover_letter?: string }
): Promise<EmployeeRequest> => {
  const pendingRequest = await findPendingEmployeeRequest(employeeId, payload.type);

  if (pendingRequest) {
    throw new Error('You already have a pending request of this type');
  }

  return insertEmployeeRequest({
    employee_id: employeeId,
    type: payload.type,
    cover_letter: payload.cover_letter ?? null,
  });
};

export const getMyEmployeeRequests = async (
  employeeId: string,
  filters?: { status?: RequestStatus }
): Promise<EmployeeRequest[]> => {
  return getEmployeeRequestsByEmployee(employeeId, filters);
};

export const getMyEmployeeRequestById = async (
  employeeId: string,
  requestId: string
): Promise<EmployeeRequest> => {
  const request = await getEmployeeRequestById(requestId);

  if (!request || request.employee_id !== employeeId) {
    throw new Error('Request not found');
  }

  return request;
};

export const listEmployeeRequests = async (filters?: {
  status?: RequestStatus;
  type?: RequestType;
}): Promise<EmployeeRequestWithEmployee[]> => {
  return getAllEmployeeRequests(filters);
};

export const getEmployeeRequestDetail = async (
  requestId: string
): Promise<EmployeeRequestWithEmployee> => {
  const request = await getEmployeeRequestWithEmployeeById(requestId);

  if (!request) {
    throw new Error('Request not found');
  }

  return request;
};

export const reviewEmployeeRequest = async (
  requestId: string,
  payload: { status: Exclude<RequestStatus, 'PENDING'>; admin_feedback?: string },
  adminId: string
): Promise<EmployeeRequest> => {
  const request = await getEmployeeRequestById(requestId);

  if (!request) {
    throw new Error('Request not found');
  }

  if (request.status !== 'PENDING') {
    throw new Error('Request has already been reviewed');
  }

  const updatedRequest = await updateEmployeeRequestReview(requestId, {
    status: payload.status,
    admin_feedback: payload.admin_feedback ?? null,
    reviewed_by: adminId,
    reviewed_at: new Date().toISOString(),
  });

  const outcome = payload.status === 'APPROVED' ? 'approved' : 'declined';
  const feedback = payload.admin_feedback
    ? ` Feedback: ${payload.admin_feedback}`
    : '';

  await insertNotification({
    user_id: request.employee_id,
    type: 'EMPLOYEE_REQUEST_REVIEWED',
    message: `Your ${request.type} request has been ${outcome}.${feedback}`,
    reference_id: request.id,
  });

  return updatedRequest;
};
