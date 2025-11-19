import { Request, Response, NextFunction } from 'express';
import { getSupabaseClient } from '../lib/supabase';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: { message: 'Unauthorized', statusCode: 401 } });
    }

    const token = authHeader.substring(7);
    const supabase = getSupabaseClient();
    
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: { message: 'Invalid token', statusCode: 401 } });
    }

    req.userId = user.id;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: { message: 'Unauthorized', statusCode: 401 } });
  }
};
