import express from 'express';
import { requireAuth } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { getSupabaseClient } from '../lib/supabase';
import { transcribeAudio } from '../services/speechToText';
import { extractActivityData, isValidFarmingExtraction } from '../services/nlpExtraction';
import { calculateCredits } from '../services/creditCalculator';
import { verifyActivity } from '../services/verification';
import { analyzeAudio } from '../services/audioAnalysis';
import { isValidFarmingContent, calculateContentQualityScore } from '../services/contentValidation';
import { AppError } from '../utils/errors';
import fs from 'fs';

const router = express.Router();

// Debug: Log all routes being registered
console.log('Activities router: registering routes');

// GET /api/activities - Get user's activities
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const activityType = req.query.activity_type as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const supabase = getSupabaseClient();

    let query = supabase
      .from('activities')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (activityType && activityType !== 'all') {
      query = query.eq('activity_type', activityType);
    }

    const { data, error } = await query;

    if (error) {
      throw new AppError(`Failed to fetch activities: ${error.message}`, 500);
    }

    res.json({ activities: data || [] });
  } catch (error) {
    next(error);
  }
});

// POST /api/activities/log-activity - Create new activity with full pipeline and verification
// Note: Middleware order matters - requireAuth first, then upload.single('audio')
router.post('/log-activity', 
  requireAuth, 
  upload.single('audio'), 
  async (req, res, next) => {
  console.log('POST /api/activities/log-activity - Route hit!', {
    hasFile: !!req.file,
    body: req.body,
    userId: req.userId
  });
  try {
    const userId = req.userId!;
    const { description, crop, area, latitude, longitude, location_accuracy } = req.body;
    const audioFile = req.file;

    // Step 1: Validate input - require audio OR description
    if (!audioFile && (!description || description.trim() === '')) {
      throw new AppError('Audio recording or description is required', 400);
    }

    // Fetch user profile to get language preference
    const supabase = getSupabaseClient();
    let userLanguage: string | null = null;
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('language')
        .eq('id', userId)
        .single();
      
      if (!profileError && profile?.language) {
        userLanguage = profile.language;
      }
    } catch (profileError) {
      // If profile doesn't exist or error fetching, default to null (will use default language)
      console.warn('Could not fetch user profile for language preference:', profileError);
    }

    let rawText = description || '';
    let transcription = null;
    let audioAnalysisResult = null;

    // Step 2: If audio file provided, analyze and transcribe it
    if (audioFile) {
      try {
        // Analyze audio for fraud detection
        audioAnalysisResult = await analyzeAudio(audioFile.path);
        
        // Only reject if score is very high (>= 60) - allow shorter recordings with warnings
        if (audioAnalysisResult.score >= 60) {
          // High fraud score from audio analysis
          throw new AppError(
            `Audio verification failed: ${audioAnalysisResult.reasons.join(', ')}`,
            400
          );
        }
        
        // Log warning for moderate scores but continue processing
        if (audioAnalysisResult.score >= 30 && audioAnalysisResult.score < 60) {
          console.warn('Audio quality warning:', audioAnalysisResult.reasons.join(', '));
        }

        // Transcribe audio with user's language preference
        transcription = await transcribeAudio(audioFile.path, userLanguage);
        rawText = transcription;

        if (!rawText || rawText.trim() === '') {
          throw new AppError('Audio transcription failed - no text extracted', 400);
        }
      } catch (error: any) {
        console.error('Audio processing error:', error);
        // Clean up file
        if (audioFile && fs.existsSync(audioFile.path)) {
          fs.unlinkSync(audioFile.path);
        }
        
        if (error instanceof AppError) {
          throw error;
        }
        
        // If transcription fails and no description, throw error
        if (!description) {
          throw new AppError('Audio processing failed and no description provided', 400);
        }
        // Otherwise continue with description
      }
    }

    if (!rawText || rawText.trim() === '') {
      throw new AppError('Description or valid audio transcription is required', 400);
    }

    // Step 3: Validate content quality before processing
    const qualityScore = calculateContentQualityScore(rawText);
    const isValidContent = isValidFarmingContent(rawText);

    if (!isValidContent) {
      // Clean up audio file on validation error
      if (audioFile && fs.existsSync(audioFile.path)) {
        fs.unlinkSync(audioFile.path);
      }
      throw new AppError(
        'Please provide a meaningful description of your farming activity. Your input is too short, meaningless, or does not appear to be related to farming.',
        400
      );
    }

    // Step 4: Extract structured data using NLP
    let extractedData;
    try {
      extractedData = await extractActivityData(rawText);
      
      // Override with manual inputs if provided
      if (crop) extractedData.crop_name = crop;
      if (area) extractedData.area = area;
      if (description && !audioFile) extractedData.description = description;
    } catch (error: any) {
      console.error('NLP extraction error:', error);
      // Clean up audio file on error
      if (audioFile && fs.existsSync(audioFile.path)) {
        fs.unlinkSync(audioFile.path);
      }
      throw new AppError('Failed to process your activity description. Please provide a clearer description.', 400);
    }

    // Step 5: Validate extracted data indicates farming content
    if (!isValidFarmingExtraction(extractedData)) {
      // Clean up audio file on validation error
      if (audioFile && fs.existsSync(audioFile.path)) {
        fs.unlinkSync(audioFile.path);
      }
      throw new AppError(
        'The provided content does not appear to describe a farming activity. Please describe an actual sustainable farming practice.',
        400
      );
    }

    // Step 6: Verify activity (anti-fraud checks)
    const locationData = latitude && longitude ? {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      accuracy: location_accuracy ? parseFloat(location_accuracy) : undefined,
    } : undefined;

    const verificationResult = await verifyActivity(userId, {
      activity_type: extractedData.activity_type,
      crop_name: extractedData.crop_name,
      location: locationData,
    });

    // Add audio analysis score to fraud score
    if (audioAnalysisResult) {
      verificationResult.fraudScore += audioAnalysisResult.score;
      verificationResult.reasons.push(...audioAnalysisResult.reasons);
    }

    // If fraud score is too high, reject or flag
    if (verificationResult.fraudScore >= 70) {
      // Clean up audio file
      if (audioFile && fs.existsSync(audioFile.path)) {
        fs.unlinkSync(audioFile.path);
      }
      
      throw new AppError(
        `Activity verification failed: ${verificationResult.reasons.join(', ')}`,
        400
      );
    }

    // Step 7: Calculate credits with quality score
    const creditsEarned = calculateCredits(extractedData, {
      qualityScore,
      requireFarmingContent: true,
    });

    // If credits are 0 after validation, it means content didn't pass quality checks
    if (creditsEarned === 0) {
      // Clean up audio file
      if (audioFile && fs.existsSync(audioFile.path)) {
        fs.unlinkSync(audioFile.path);
      }
      throw new AppError(
        'Unable to award credits. Please provide a more detailed description of your farming activity.',
        400
      );
    }

    // Step 8: Save to database with verification data
    // Note: supabase client was already initialized above for profile fetch
    const activityData = {
      user_id: userId,
      description: extractedData.description,
      crop_name: extractedData.crop_name,
      area: extractedData.area,
      activity_type: extractedData.activity_type,
      raw_text: rawText,
      transcription: transcription,
      latitude: locationData?.latitude || null,
      longitude: locationData?.longitude || null,
      location_accuracy: locationData?.accuracy || null,
      verification_status: verificationResult.flagged ? 'flagged' : verificationResult.passed ? 'verified' : 'pending',
      fraud_score: verificationResult.fraudScore,
      verification_metadata: {
        extracted: extractedData,
        manual_inputs: {
          crop: crop || null,
          area: area || null,
        },
        audio_analysis: audioAnalysisResult,
        verification_reasons: verificationResult.reasons,
      },
      flagged_for_review: verificationResult.flagged,
      credits_earned: creditsEarned,
    };

    const { data: activity, error: insertError } = await supabase
      .from('activities')
      .insert(activityData)
      .select()
      .single();

    if (insertError) {
      // Clean up audio file on error
      if (audioFile && fs.existsSync(audioFile.path)) {
        fs.unlinkSync(audioFile.path);
      }
      throw new AppError(`Failed to save activity: ${insertError.message}`, 500);
    }

    // Clean up audio file after successful save
    if (audioFile && fs.existsSync(audioFile.path)) {
      try {
        fs.unlinkSync(audioFile.path);
      } catch (cleanupError) {
        console.error('Error cleaning up audio file:', cleanupError);
      }
    }

    // Get updated credits
    const { data: creditsData, error: creditsError } = await supabase
      .rpc('get_user_credits', { p_user_id: userId });

    if (creditsError) {
      console.error('Error fetching credits:', creditsError);
    }

    res.status(201).json({
      activity,
      credits_earned: creditsEarned,
      total_credits: creditsData || 0,
      verification_status: verificationResult.flagged ? 'flagged' : verificationResult.passed ? 'verified' : 'pending',
      fraud_score: verificationResult.fraudScore,
    });
  } catch (error) {
    // Clean up audio file on any error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up audio file:', cleanupError);
      }
    }
    next(error);
  }
});

export default router;

