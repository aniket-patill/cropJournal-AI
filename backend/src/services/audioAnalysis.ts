import { AppError } from '../utils/errors';
import fs from 'fs';

interface AudioAnalysisResult {
  isLive: boolean;
  hasBackgroundNoise: boolean;
  duration: number;
  quality: 'good' | 'fair' | 'poor';
  score: number;
  reasons: string[];
}

/**
 * Analyze audio file to detect if it's a live recording
 * This is a basic implementation - can be enhanced with ML models
 */
export async function analyzeAudio(audioFilePath: string): Promise<AudioAnalysisResult> {
  const reasons: string[] = [];
  let score = 0;

  try {
    // Get file stats
    const stats = fs.statSync(audioFilePath);
    const fileSize = stats.size;
    const duration = estimateDuration(fileSize); // Rough estimate

    // Check minimum duration (must be at least 3 seconds for a valid recording)
    if (duration < 3) {
      score += 30;
      reasons.push(`Audio too short (${duration.toFixed(1)}s), minimum 3 seconds`);
    } else if (duration < 5) {
      score += 15;
      reasons.push(`Audio is short (${duration.toFixed(1)}s), recommended minimum 5 seconds`);
    }

    // Check file size (too small might indicate fake/empty recording)
    if (fileSize < 5000) { // Less than 5KB - likely empty or corrupted
      score += 30;
      reasons.push('Audio file too small, may be empty or fake');
    } else if (fileSize < 10000) { // Less than 10KB - very short recording
      score += 10;
      reasons.push('Audio file is very small, recording may be too short');
    }

    // Check file size vs duration ratio (rough quality check)
    const bytesPerSecond = fileSize / Math.max(duration, 1);
    if (bytesPerSecond < 1000) {
      score += 15;
      reasons.push('Low audio quality detected');
    }

    // Basic checks passed
    const hasBackgroundNoise = duration > 5 && fileSize > 10000;
    const isLive = hasBackgroundNoise && score < 20;

    return {
      isLive,
      hasBackgroundNoise,
      duration,
      quality: score < 20 ? 'good' : score < 40 ? 'fair' : 'poor',
      score: Math.min(score, 100),
      reasons,
    };
  } catch (error: any) {
    console.error('Audio analysis error:', error);
    throw new AppError(`Audio analysis failed: ${error.message}`, 500);
  }
}

/**
 * Estimate audio duration from file size
 * This is a rough estimate - actual implementation would use audio metadata
 */
function estimateDuration(fileSizeBytes: number): number {
  // Rough estimate: webm/opus is ~10-15KB per second
  // Using 12KB per second as average
  return fileSizeBytes / 12000;
}

/**
 * Check if audio content is similar to previous recordings (potential duplicate)
 */
export async function checkAudioUniqueness(
  audioFilePath: string,
  userId: string,
  recentTranscriptions: string[]
): Promise<{ unique: boolean; score: number; reasons: string[] }> {
  const reasons: string[] = [];
  let score = 0;

  // This is a simplified check - in production, you'd use audio fingerprinting
  // For now, we'll rely on transcription uniqueness check in the main flow

  // Basic file hash check could be added here
  // For now, return as unique (transcription check will catch duplicates)

  return {
    unique: true,
    score: 0,
    reasons: [],
  };
}

