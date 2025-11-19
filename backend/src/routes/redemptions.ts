import express from 'express';
import { requireAuth } from '../middleware/auth';
import { getSupabaseClient } from '../lib/supabase';
import { AppError } from '../utils/errors';

const router = express.Router();

// POST /api/redeem - Redeem a reward
router.post('/redeem', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const { rewardId } = req.body;
    const supabase = getSupabaseClient();

    if (!rewardId) {
      throw new AppError('Reward ID is required', 400);
    }

    // Get reward details
    const { data: reward, error: rewardError } = await supabase
      .from('rewards')
      .select('*')
      .eq('id', rewardId)
      .eq('available', true)
      .single();

    if (rewardError || !reward) {
      throw new AppError('Reward not found or unavailable', 404);
    }

    // Get user's current credits
    const { data: userCredits, error: creditsError } = await supabase
      .rpc('get_user_credits', { p_user_id: userId });

    if (creditsError) {
      throw new AppError(`Failed to fetch credits: ${creditsError.message}`, 500);
    }

    const currentCredits = userCredits || 0;

    if (currentCredits < reward.credits_cost) {
      throw new AppError(
        `Insufficient credits. You have ${currentCredits} credits, but need ${reward.credits_cost}`,
        400
      );
    }

    // Create redemption record
    const { data: redemption, error: redemptionError } = await supabase
      .from('redemptions')
      .insert({
        user_id: userId,
        reward_id: rewardId,
        credits_spent: reward.credits_cost,
      })
      .select()
      .single();

    if (redemptionError) {
      throw new AppError(`Failed to create redemption: ${redemptionError.message}`, 500);
    }

    // Get updated credits
    const { data: updatedCredits } = await supabase
      .rpc('get_user_credits', { p_user_id: userId });

    res.status(201).json({
      redemption,
      reward,
      remaining_credits: updatedCredits || 0,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

