import { Router } from 'express';
import {
  getMe,
  login,
  registerCustomer,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

export const authRoutes = Router();

authRoutes.post('/login', login);
authRoutes.post('/register', registerCustomer);
authRoutes.get('/me', authenticate, getMe);
