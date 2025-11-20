// Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { errorHandler } from './utils/errors';
import activitiesRouter from './routes/activities';
import rewardsRouter from './routes/rewards';
import redemptionsRouter from './routes/redemptions';
import creditsRouter from './routes/credits';
import profileRouter from './routes/profile';
import dashboardRouter from './routes/dashboard';
import reportsRouter from './routes/reports';
import demoRouter from './routes/demo';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';



// Middleware
app.use(cors({
  origin: [
    'http://localhost:8080',  // Your current frontend port
    'http://localhost:5173',  // Default Vite port (for future use)
    FRONTEND_URL,              // From environment variable
    'https://crop-journal-ai.vercel.app/',
  ].filter(Boolean), // Remove any undefined values
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing middleware
// Note: express.json() and express.urlencoded() won't interfere with multipart/form-data
// Multer will handle multipart/form-data requests automatically
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug middleware - log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    contentType: req.headers['content-type'],
    hasAuth: !!req.headers.authorization,
    url: req.url,
    originalUrl: req.originalUrl
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/activities', activitiesRouter);
app.use('/api/rewards', rewardsRouter);
app.use('/api/redemptions', redemptionsRouter);
app.use('/api/credits', creditsRouter);
app.use('/api/profile', profileRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportsRouter);
app.use('/api', demoRouter);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});