import express from 'express';
import { requireAuth } from '../middleware/auth';
import { getSupabaseClient } from '../lib/supabase';
import { AppError } from '../utils/errors';

const router = express.Router();

// GET /api/profile - Get user profile
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      // If profile doesn't exist, create one
      if (error.code === 'PGRST116') {
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            full_name: null,
            language: 'en',
          })
          .select()
          .single();

        if (insertError) {
          throw new AppError(`Failed to create profile: ${insertError.message}`, 500);
        }

        return res.json({ profile: newProfile });
      }

      throw new AppError(`Failed to fetch profile: ${error.message}`, 500);
    }

    res.json({ profile: data });
  } catch (error) {
    next(error);
  }
});

// PUT /api/profile - Update user profile
router.put('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const { full_name, language } = req.body;

    const updateData: any = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (language !== undefined) updateData.language = language;

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      // If profile doesn't exist, create it
      if (error.code === 'PGRST116') {
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            full_name: full_name || null,
            language: language || 'en',
          })
          .select()
          .single();

        if (insertError) {
          throw new AppError(`Failed to create profile: ${insertError.message}`, 500);
        }

        return res.json({ profile: newProfile });
      }

      throw new AppError(`Failed to update profile: ${error.message}`, 500);
    }

    res.json({ profile: data });
  } catch (error) {
    next(error);
  }
});

export default router;

