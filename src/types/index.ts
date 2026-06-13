
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

export type RequestType = 'PROMOTION' | 'SALARY_INCREASE' | 'RESIGNATION';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'DECLINED';

export interface EmployeeRequest {
  id: string;
  employee_id: string;
  type: RequestType;
  cover_letter: string | null;
  status: RequestStatus;
  admin_feedback: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface EmployeeRequestWithEmployee extends EmployeeRequest {
  employee_name: string;
  employee_email: string;
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
  created_at?: string;
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

export interface AdminOrderSummary extends Order {
  customer_name: string;
  customer_email: string;
  item_count: number;
}

export interface AdminOrdersListResult {
  data: AdminOrderSummary[];
  meta: { total: number; limit: number; offset: number };
}

export interface DailyRevenueBucket {
  date: string;
  revenue: number;
  order_count: number;
}

export interface TopSellingItem {
  menu_item_id: string;
  name: string;
  total_quantity_sold: number;
  total_revenue: number;
}

export interface CategoryRevenue {
  category_id: string;
  category_name: string;
  total_revenue: number;
  order_count: number;
}

export interface AnalyticsSummary {
  period: { from: string; to: string };
  revenue: {
    total: number;
    daily_average: number;
    by_day: DailyRevenueBucket[];
  };
  orders: {
    total: number;
    by_status: Record<OrderStatus, number>;
    completion_rate: number;
  };
  top_items: TopSellingItem[];
  customers: {
    total_registered: number;
    new_in_period: number;
    active_in_period: number;
  };
  employees: {
    total: number;
    by_role: Partial<Record<EmployeeRole, number>>;
  };
  revenue_by_category: CategoryRevenue[];
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

// ─────────────────────────────────────────────────────────────────────────────
// INVOICES
// ─────────────────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'ISSUED' | 'PAID' | 'REFUNDED' | 'VOID';

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string;
  customer_id: string;
  total_amount: number;
  status: InvoiceStatus;
  pdf_url: string | null;
  pdf_generated_at: string | null;
  notes: string | null;
  issued_at: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

/** Full invoice detail, including customer info and line items (joined from orders/order_items). */
export interface InvoiceDetail extends Invoice {
  customer_name: string;
  customer_email: string;
  items: InvoiceLineItem[];
}

/** Lightweight summary row used in list endpoints. */
export interface InvoiceListItem {
  id: string;
  invoice_number: string;
  order_id: string;
  total_amount: number;
  status: InvoiceStatus;
  issued_at: string;
}
