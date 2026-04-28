# Dinely Backend

REST API for the Dinely restaurant management platform.

## Tech Stack
- Node.js + Express + TypeScript
- Supabase (PostgreSQL)
- Custom JWT Authentication
- bcryptjs, Zod

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
Create a `.env` file in the root:
PORT=5000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret

### 3. Run the development server
```bash
npm run dev
```

Server runs on `http://localhost:5000`

## Scripts
| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled output |