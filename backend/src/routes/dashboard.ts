import express from 'express';
import { requireAuth } from '../middleware/auth';
import { getSupabaseClient } from '../lib/supabase';
import { AppError } from '../utils/errors';

const router = express.Router();

// GET /api/dashboard - Get dashboard data
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const supabase = getSupabaseClient();

    // Get total credits
    const { data: credits, error: creditsError } = await supabase
      .rpc('get_user_credits', { p_user_id: userId });

    if (creditsError) {
      throw new AppError(`Failed to fetch credits: ${creditsError.message}`, 500);
    }

    // Get recent activities (last 5)
    const { data: recentActivities, error: activitiesError } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (activitiesError) {
      throw new AppError(`Failed to fetch activities: ${activitiesError.message}`, 500);
    }

    // Get weekly stats (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: weeklyActivities, error: weeklyError } = await supabase
      .from('activities')
      .select('credits_earned, created_at')
      .eq('user_id', userId)
      .gte('created_at', weekAgo.toISOString());

    if (weeklyError) {
      throw new AppError(`Failed to fetch weekly stats: ${weeklyError.message}`, 500);
    }

    const weeklyStats = {
      activities: weeklyActivities?.length || 0,
      credits: weeklyActivities?.reduce((sum, a) => sum + (a.credits_earned || 0), 0) || 0,
    };

    res.json({
      credits: credits || 0,
      recent_activities: recentActivities || [],
      weekly_stats: weeklyStats,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

