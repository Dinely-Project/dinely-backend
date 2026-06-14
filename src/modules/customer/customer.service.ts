import { compare, hash } from 'bcryptjs';
import {
  getCustomerById,
  getUserByEmailExcludingId,
  updateCustomerById,
} from './customer.repository';
import { SafeUser, User } from '../../types';
import { UpdateProfileInput } from './customer.validator';

const toSafeUser = (user: User): SafeUser => {
  const { password_hash, ...safe } = user;
  return safe;
};

export const getCustomerProfile = async (customerId: string): Promise<SafeUser> => {
  const user = await getCustomerById(customerId);
  if (!user) {
    throw new Error('Profile not found');
  }

  return toSafeUser(user);
};

export const updateCustomerProfile = async (
  customerId: string,
  updates: UpdateProfileInput
): Promise<SafeUser> => {
  const existing = await getCustomerById(customerId);
  if (!existing) {
    throw new Error('Profile not found');
  }

  const payload: Partial<User> = {};

  if (updates.name !== undefined) {
    payload.name = updates.name;
  }

  if (updates.phone !== undefined) {
    payload.phone = updates.phone === '' ? null : updates.phone;
  }



  if (Object.keys(payload).length === 0) {
    return toSafeUser(existing);
  }

  const updated = await updateCustomerById(customerId, payload);
  return toSafeUser(updated);
};

export const updateCustomerEmail = async (
  customerId: string,
  newEmail: string,
  currentPassword: string
): Promise<SafeUser> => {
  const customer = await getCustomerById(customerId);
  if (!customer) {
    throw new Error('Profile not found');
  }

  const isPasswordValid = await compare(currentPassword, customer.password_hash);
  if (!isPasswordValid) {
    throw new Error('Incorrect password');
  }

  if (newEmail === customer.email) {
    return toSafeUser(customer);
  }

  const existing = await getUserByEmailExcludingId(newEmail, customerId);
  if (existing) {
    throw new Error('Email already in use');
  }

  const updated = await updateCustomerById(customerId, { email: newEmail });
  return toSafeUser(updated);
};

export const updateCustomerPassword = async (
  customerId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  const customer = await getCustomerById(customerId);
  if (!customer) {
    throw new Error('Profile not found');
  }

  const isPasswordValid = await compare(currentPassword, customer.password_hash);
  if (!isPasswordValid) {
    throw new Error('Incorrect password');
  }

  const password_hash = await hash(newPassword, 10);
  await updateCustomerById(customerId, { password_hash });
};
