import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { supabase } from './config/supabase';
import { env } from './config/env';
import { authRoutes } from './modules/auth/auth.routes';
import { internalRoutes } from './modules/auth/auth.internal.routes';

dotenv.config();

const app = express();
const PORT = env.PORT;

app.use(cors({ origin: env.ALLOWED_ORIGIN }));
app.use(express.json({ limit: '10kb' }));
app.use(helmet());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});
if (process.env.NODE_ENV !== 'test') {
  app.use('/api/auth', authLimiter);
}

app.get('/health', async (_req, res) => {
  const { error } = await supabase.from('users').select('count').limit(1);
  if (error) {
    return res.status(503).json({ status: 'error', message: error.message });
  }
  return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (_req, res) => {
  res.json({ message: 'Dinely API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/internal', internalRoutes);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

export default app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}