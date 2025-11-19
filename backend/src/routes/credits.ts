import express from 'express';
import { requireAuth } from '../middleware/auth';
import { getSupabaseClient } from '../lib/supabase';
import { AppError } from '../utils/errors';

const router = express.Router();

// GET /api/credits - Get user's current credit balance
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .rpc('get_user_credits', { p_user_id: userId });

    if (error) {
      throw new AppError(`Failed to fetch credits: ${error.message}`, 500);
    }

    res.json({ credits: data || 0 });
  } catch (error) {
    next(error);
  }
});

export default router;

