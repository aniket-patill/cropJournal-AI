# CropJournal AI Frontend

Frontend application for CropJournal AI built with React, TypeScript, Vite, and Clerk authentication.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

3. Start the development server:
```bash
npm run dev
```

The app will run on `http://localhost:5173` by default.

## Environment Variables

See `.env.example` for all required environment variables:

- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
- `VITE_API_URL` - Backend API URL (default: http://localhost:3001)

## Features

- Clerk authentication (Sign In/Sign Up)
- Activity logging with voice/audio upload support
- Dashboard with credits and statistics
- Marketplace for redeeming rewards
- Reports with charts
- Profile management

## Project Structure

- `src/pages/` - Page components
- `src/components/` - Reusable components
- `src/lib/` - Utilities (API client, etc.)
- `src/contexts/` - React contexts (Auth)
- `src/hooks/` - Custom hooks

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
