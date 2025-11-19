# CropJournal AI Backend API

Backend API for CropJournal AI built with Node.js, Express, TypeScript, Clerk authentication, and Supabase database.

## Features

- Supabase authentication with JWT verification
- Supabase database integration
- Speech-to-Text using Sarvam AI
- NLP extraction using Groq Llama 3.3
- Credit calculation algorithm
- RESTful API endpoints for all features

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

3. Run database migrations:
   - Apply the migration in `supabase/migrations/20250120000000_update_for_clerk.sql` to your Supabase project

4. Start the development server:
```bash
npm run dev
```

The server will run on `http://localhost:3001` by default.

## Environment Variables

See `.env.example` for all required environment variables:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for admin operations)
- `SARVAM_API_KEY` - Sarvam AI API key for Speech-to-Text transcription
- `SARVAM_API_URL` - Sarvam AI API endpoint (optional, defaults to https://api.sarvam.ai/v1/speech-to-text)
- `SARVAM_LANGUAGE` - Language code for transcription (optional, defaults to 'en-IN', can be 'hi-IN', 'kn-IN', etc.)
- `GROQ_API_KEY` - Groq API key for NLP extraction
- `PORT` - Server port (default: 3001)
- `FRONTEND_URL` - Frontend URL for CORS
- `UPLOAD_DIR` - Directory for temporary audio file storage

## API Endpoints

### Activities
- `GET /api/activities` - Get user's activities
- `POST /api/activities/log-activity` - Log new activity (supports audio upload)

### Rewards
- `GET /api/rewards` - Get all available rewards

### Redemptions
- `POST /api/redemptions/redeem` - Redeem a reward

### Credits
- `GET /api/credits` - Get user's credit balance

### Profile
- `GET /api/profile` - Get user profile
- `PUT /api/profile` - Update user profile

### Dashboard
- `GET /api/dashboard` - Get dashboard data

### Reports
- `GET /api/reports/credits-over-time` - Get credits over time chart data
- `GET /api/reports/credits-by-category` - Get credits by category chart data

## Authentication

All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <supabase_access_token>
```

The token should be obtained from the Supabase client session after user authentication.

## Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run type-check` - Type check without building

