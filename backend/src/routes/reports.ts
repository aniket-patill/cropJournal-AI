import express from 'express';
import { requireAuth } from '../middleware/auth';
import { getSupabaseClient } from '../lib/supabase';
import { AppError } from '../utils/errors';

const router = express.Router();

// GET /api/reports/credits-over-time - Get credits over time data
router.get('/credits-over-time', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const days = parseInt(req.query.days as string) || 30;
    const supabase = getSupabaseClient();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: activities, error } = await supabase
      .from('activities')
      .select('credits_earned, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      throw new AppError(`Failed to fetch activities: ${error.message}`, 500);
    }

    // Group by date
    const dataByDate: Record<string, number> = {};
    const lastNDays = Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split('T')[0];
      dataByDate[dateStr] = 0;
      return dateStr;
    });

    activities?.forEach((activity) => {
      const activityDate = new Date(activity.created_at).toISOString().split('T')[0];
      if (dataByDate[activityDate] !== undefined) {
        dataByDate[activityDate] += activity.credits_earned || 0;
      }
    });

    const chartData = lastNDays.map((date) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      credits: dataByDate[date],
    }));

    res.json({ data: chartData });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/credits-by-category - Get credits by category
router.get('/credits-by-category', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const supabase = getSupabaseClient();

    const { data: activities, error } = await supabase
      .from('activities')
      .select('activity_type, credits_earned')
      .eq('user_id', userId);

    if (error) {
      throw new AppError(`Failed to fetch activities: ${error.message}`, 500);
    }

    const activityTypeLabels: Record<string, string> = {
      organic_input: 'Organic Input',
      water_conservation: 'Water Conservation',
      soil_health: 'Soil Health',
      pest_management: 'Pest Management',
      crop_rotation: 'Crop Rotation',
      other: 'Other',
    };

    const byCategory: Record<string, number> = {};
    activities?.forEach((activity) => {
      const type = activity.activity_type || 'other';
      if (!byCategory[type]) {
        byCategory[type] = 0;
      }
      byCategory[type] += activity.credits_earned || 0;
    });

    const chartData = Object.entries(byCategory).map(([type, credits]) => ({
      name: activityTypeLabels[type] || type,
      credits,
    }));

    res.json({ data: chartData });
  } catch (error) {
    next(error);
  }
});

export default router;

