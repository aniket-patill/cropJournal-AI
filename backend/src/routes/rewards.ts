import express from 'express';
import { getSupabaseClient } from '../lib/supabase';
import { AppError } from '../utils/errors';

const router = express.Router();

// GET /api/rewards - Get all available rewards
router.get('/', async (req, res, next) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('available', true)
      .order('credits_cost', { ascending: true });

    if (error) {
      throw new AppError(`Failed to fetch rewards: ${error.message}`, 500);
    }

    res.json({ rewards: data || [] });
  } catch (error) {
    next(error);
  }
});

export default router;

