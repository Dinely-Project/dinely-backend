
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

//Order related types

export type OrderStatus = 'RECEIVED' | 'PREPARING' | 'READY' | 'FINISHED' | 'CANCELLED';

export interface Order {
  id: string;
  customer_id: string;
  status: OrderStatus;
  total_price: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  created_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  old_status: OrderStatus | null;
  new_status: OrderStatus;
  changed_by: string;
  changed_at: string;
}

export interface OrderItemDetail {
  id: string;
  menu_item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface OrderDetail extends Order {
  customer_name: string;
  customer_email: string;
  items: OrderItemDetail[];
  status_history: OrderStatusHistory[];
}

export interface OrderSummary extends Order {
  customer_name: string;
  item_count: number;
}

//Notifications
 
export interface Notification {
  id: string;
  user_id: string;
  type: string;
  message: string;
  is_read: boolean;
  reference_id: string | null;
  created_at: string;
}