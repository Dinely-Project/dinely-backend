import { supabase } from '../../config/supabase';
import { EmployeeRole, User } from '../../types';
import { UserSchema } from '../../types/schemas';

export const getUserByEmail = async (email: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch user by email: ${error.message}`);
  }

  if (!data || data.length === 0) return null;
  return UserSchema.parse(data[0]);
};

export const getUserById = async (id: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch user by id: ${error.message}`);
  }

  if (!data || data.length === 0) return null;
  return UserSchema.parse(data[0]);
};

export const createUser = async (
  payload: Omit<User, 'id' | 'created_at' | 'updated_at'>
): Promise<User> => {
  const { data, error } = await supabase.from('users').insert(payload).select('*').single();

  if (error || !data) {
    throw new Error(`Failed to create user: ${error?.message ?? 'No data returned'}`);
  }

  return UserSchema.parse(data);
};

export const updateUser = async (id: string, payload: Partial<User>): Promise<User> => {
  const { data, error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to update user: ${error?.message ?? 'No data returned'}`);
  }

  return UserSchema.parse(data);
};

export const getSalaryConfig = async (
  employee_role: EmployeeRole,
  level: number | null
): Promise<{ base_salary: number } | null> => {
  let query = supabase
    .from('role_salary_config')
    .select('base_salary')
    .eq('employee_role', employee_role);

  if (level === null) {
    query = query.is('employee_level', null);
  } else {
    query = query.eq('employee_level', level);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    throw new Error(`Failed to fetch salary configuration: ${error.message}`);
  }

  const rows = data as { base_salary: number }[] | null;
  return rows && rows.length > 0 ? rows[0] : null;
};

export const insertSalaryHistory = async (payload: {
  employee_id: string;
  old_salary: number;
  new_salary: number;
  trigger_type: string;
  changed_by: string;
}): Promise<void> => {
  const { error } = await supabase.from('salary_history').insert(payload);

  if (error) {
    throw new Error(`Failed to record salary history: ${error.message}`);
  }
};
