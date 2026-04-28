import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './config/supabase';
import { authRoutes } from './routes/auth.routes';
import { internalRoutes } from './routes/internal.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Test Supabase connection
supabase
  .from('users')
  .select('count')
  .then(({ error }) => {
    if (error) console.error('❌ Supabase error:', error.message);
    else console.log('✅ Supabase connected');
  });

app.get('/', (req, res) => {
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