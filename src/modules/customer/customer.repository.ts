import { supabase } from '../../config/supabase';
import { User } from '../../types';
import { UserSchema } from '../../types/schemas';

export const getCustomerById = async (id: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .eq('role', 'CUSTOMER')
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch customer profile: ${error.message}`);
  }

  if (!data || data.length === 0) return null;
  return UserSchema.parse(data[0]);
};

export const getUserByEmailExcludingId = async (
  email: string,
  excludeId: string
): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .neq('id', excludeId)
    .limit(1);

  if (error) {
    throw new Error(`Failed to check email availability: ${error.message}`);
  }

  if (!data || data.length === 0) return null;
  return UserSchema.parse(data[0]);
};

export const updateCustomerById = async (id: string, payload: Partial<User>): Promise<User> => {
  const { data, error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', id)
    .eq('role', 'CUSTOMER')
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to update customer profile: ${error?.message ?? 'No data returned'}`);
  }

  return UserSchema.parse(data);
};
