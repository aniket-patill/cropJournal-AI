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

    // Validate that at least one field is being updated
    const updateData: any = {};
    if (full_name !== undefined) {
      updateData.full_name = full_name || null;
    }
    if (language !== undefined) {
      // Normalize language value (handle empty strings and null)
      const normalizedLanguage = language && language.trim() !== '' ? language.trim() : 'en';
      
      // Validate language value
      if (!['en', 'kn', 'mr'].includes(normalizedLanguage)) {
        throw new AppError('Invalid language value. Must be "en", "kn", or "mr"', 400);
      }
      updateData.language = normalizedLanguage;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      throw new AppError('No fields provided to update', 400);
    }

    const supabase = getSupabaseClient();

    // First, check if profile exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // If profile doesn't exist, create it
    if (fetchError && fetchError.code === 'PGRST116') {
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          full_name: updateData.full_name !== undefined ? updateData.full_name : null,
          language: updateData.language !== undefined ? updateData.language : 'en',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Profile creation error:', insertError);
        throw new AppError(`Failed to create profile: ${insertError.message}`, 500);
      }

      return res.json({ profile: newProfile });
    }

    // If fetch error but not "not found", throw it
    if (fetchError) {
      console.error('Profile fetch error:', fetchError);
      throw new AppError(`Failed to fetch profile: ${fetchError.message}`, 500);
    }

    // Update existing profile
    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Profile update error:', error);
      // If no rows found, create the profile
      if (error.code === 'PGRST116') {
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            full_name: updateData.full_name !== undefined ? updateData.full_name : null,
            language: updateData.language !== undefined ? updateData.language : 'en',
          })
          .select()
          .single();

        if (insertError) {
          console.error('Profile creation error:', insertError);
          throw new AppError(`Failed to create profile: ${insertError.message}`, 500);
        }

        return res.json({ profile: newProfile });
      }
      throw new AppError(`Failed to update profile: ${error.message}`, 500);
    }

    // Check if update actually updated a row (shouldn't happen with .single(), but just in case)
    if (!data) {
      // Try to create the profile if it doesn't exist
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          full_name: updateData.full_name !== undefined ? updateData.full_name : null,
          language: updateData.language !== undefined ? updateData.language : 'en',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Profile creation error:', insertError);
        throw new AppError('Profile not found and could not be created', 500);
      }

      return res.json({ profile: newProfile });
    }

    res.json({ profile: data });
  } catch (error) {
    next(error);
  }
});

export default router;

