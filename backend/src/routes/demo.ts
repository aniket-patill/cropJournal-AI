import express from 'express';
import { requireAuth } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { transcribeAudio } from '../services/speechToText';
import { extractActivityData, isValidFarmingExtraction } from '../services/nlpExtraction';
import { calculateCredits } from '../services/creditCalculator';
import { isValidFarmingContent, calculateContentQualityScore } from '../services/contentValidation';
import { AppError } from '../utils/errors';
import fs from 'fs';

const router = express.Router();

// Activity type labels for formatting
const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  organic_input: 'Organic farming',
  water_conservation: 'Water conservation',
  soil_health: 'Soil health improvement',
  pest_management: 'Pest management',
  crop_rotation: 'Crop rotation',
  other: 'Farming activity',
};

// Helper function to format bot response message
function formatBotResponse(extractedData: any, creditsEarned: number): string {
  const activityLabel = ACTIVITY_TYPE_LABELS[extractedData.activity_type] || ACTIVITY_TYPE_LABELS.other;
  
  const parts: string[] = [];
  parts.push(`Detected: ${activityLabel}`);
  
  if (extractedData.crop_name) {
    parts.push(`for ${extractedData.crop_name}`);
  }
  
  if (extractedData.area) {
    parts.push(`on ${extractedData.area}`);
  }
  
  const message = parts.join(' ');
  return `${message}. You earned ${creditsEarned} credits.`;
}

// POST /api/demo-process - Process text or audio for demo (no DB save)
router.post(
  '/demo-process',
  requireAuth,
  upload.single('audio'),
  async (req, res, next) => {
    console.log('POST /api/demo-process - Route hit!', {
      hasFile: !!req.file,
      hasText: !!req.body.text,
      userId: req.userId,
    });

    let audioFile = req.file;
    let transcription: string | null = null;

    try {
      const { text } = req.body;

      // Validate input - require audio OR text
      if (!audioFile && (!text || text.trim() === '')) {
        throw new AppError('Text message or audio file is required', 400);
      }

      let rawText = text || '';

      // Step 1: If audio file provided, transcribe it
      if (audioFile) {
        try {
          transcription = await transcribeAudio(audioFile.path);
          rawText = transcription;

          if (!rawText || rawText.trim() === '') {
            throw new AppError('Audio transcription failed - no text extracted', 400);
          }
        } catch (error: any) {
          // Clean up file on error
          if (audioFile && fs.existsSync(audioFile.path)) {
            fs.unlinkSync(audioFile.path);
          }

          if (error instanceof AppError) {
            throw error;
          }

          // If transcription fails and no text provided, throw error
          if (!text) {
            throw new AppError('Audio processing failed and no text provided', 400);
          }
          // Otherwise continue with provided text
        }
      }

      if (!rawText || rawText.trim() === '') {
        throw new AppError('Text or valid audio transcription is required', 400);
      }

      // Step 2: Validate content quality before processing
      const qualityScore = calculateContentQualityScore(rawText);
      const isValidContent = isValidFarmingContent(rawText);

      if (!isValidContent) {
        throw new AppError(
          'Please provide a meaningful description of your farming activity. Your input is too short, meaningless, or does not appear to be related to farming.',
          400
        );
      }

      // Step 3: Extract structured data using NLP
      let extractedData;
      try {
        extractedData = await extractActivityData(rawText);
      } catch (error: any) {
        console.error('NLP extraction error:', error);
        throw new AppError('Failed to process your activity description. Please provide a clearer description.', 400);
      }

      // Step 4: Validate extracted data indicates farming content
      if (!isValidFarmingExtraction(extractedData)) {
        throw new AppError(
          'The provided content does not appear to describe a farming activity. Please describe an actual sustainable farming practice.',
          400
        );
      }

      // Step 5: Calculate credits with quality score
      const creditsEarned = calculateCredits(extractedData, {
        qualityScore,
        requireFarmingContent: true,
      });

      // If credits are 0 after validation, it means content didn't pass quality checks
      if (creditsEarned === 0) {
        throw new AppError(
          'Unable to award credits. Please provide a more detailed description of your farming activity.',
          400
        );
      }

      // Step 6: Format bot response message
      const formattedMessage = formatBotResponse(extractedData, creditsEarned);

      // Clean up audio file after processing
      if (audioFile && fs.existsSync(audioFile.path)) {
        try {
          fs.unlinkSync(audioFile.path);
        } catch (cleanupError) {
          console.error('Error cleaning up audio file:', cleanupError);
        }
      }

      // Return formatted response (NO DATABASE SAVE)
      res.json({
        message: formattedMessage,
        extracted_data: extractedData,
        credits_earned: creditsEarned,
        ...(transcription && { transcription }),
      });
    } catch (error) {
      // Clean up audio file on any error
      if (audioFile && fs.existsSync(audioFile.path)) {
        try {
          fs.unlinkSync(audioFile.path);
        } catch (cleanupError) {
          console.error('Error cleaning up audio file:', cleanupError);
        }
      }
      next(error);
    }
  }
);

export default router;

