import { Request } from 'express';

export type UserRole = 'ADMIN' | 'STAFF' | 'EMPLOYEE' | 'CUSTOMER';
export type EmployeeRole = 'CHEF' | 'SERVER' | 'CLEANER' | 'MANAGER' | 'GENERAL';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'DEACTIVATED';

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  employee_role: EmployeeRole | null;
  employee_level: number | null;
  salary: number | null;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export type SafeUser = Omit<User, 'password_hash'>;

export interface JwtPayload {
  userId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  display_order: number | null;
  created_at: string;
  updated_at?: string;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  created_at: string;
  updated_at?: string;
}
