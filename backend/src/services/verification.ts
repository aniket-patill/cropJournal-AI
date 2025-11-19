import { AppError } from '../utils/errors';
import { getSupabaseClient } from '../lib/supabase';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface VerificationResult {
  passed: boolean;
  fraudScore: number;
  reasons: string[];
  flagged: boolean;
}

interface ActivityData {
  user_id: string;
  activity_type: string;
  created_at: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Verify location is valid and within reasonable range
 */
export async function verifyLocation(
  location: LocationData,
  userId: string
): Promise<{ valid: boolean; score: number; reasons: string[] }> {
  const reasons: string[] = [];
  let score = 0;

  // Check if location is provided
  if (!location.latitude || !location.longitude) {
    return { valid: false, score: 100, reasons: ['Location not provided'] };
  }

  // Check location accuracy
  if (location.accuracy && location.accuracy > 50) {
    score += 20;
    reasons.push(`Location accuracy is low (${location.accuracy}m)`);
  }

  // Check if location is within reasonable bounds (valid coordinates)
  if (location.latitude < -90 || location.latitude > 90) {
    return { valid: false, score: 100, reasons: ['Invalid latitude'] };
  }
  if (location.longitude < -180 || location.longitude > 180) {
    return { valid: false, score: 100, reasons: ['Invalid longitude'] };
  }

  // Check for duplicate location within same time window (potential GPS spoofing)
  const supabase = getSupabaseClient();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const { data: recentActivities } = await supabase
    .from('activities')
    .select('id, latitude, longitude, created_at')
    .eq('user_id', userId)
    .gte('created_at', fiveMinutesAgo)
    .limit(10);

  if (recentActivities) {
    const sameLocation = recentActivities.find(activity => {
      if (!activity.latitude || !activity.longitude) return false;
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        activity.latitude,
        activity.longitude
      );
      return distance < 10; // Within 10 meters
    });

    if (sameLocation) {
      score += 15;
      reasons.push('Same location used for multiple activities recently');
    }
  }

  return { valid: true, score, reasons };
}

/**
 * Verify timestamp and frequency constraints
 */
export async function verifyTimestampAndFrequency(
  userId: string,
  activityType: string
): Promise<{ valid: boolean; score: number; reasons: string[] }> {
  const reasons: string[] = [];
  let score = 0;

  const supabase = getSupabaseClient();
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Check for duplicate activity type within 1 hour
  const { data: recentSameType } = await supabase
    .from('activities')
    .select('id, created_at')
    .eq('user_id', userId)
    .eq('activity_type', activityType)
    .gte('created_at', oneHourAgo.toISOString())
    .limit(1);

  if (recentSameType && recentSameType.length > 0) {
    score += 30;
    reasons.push(`Same activity type logged within 1 hour`);
  }

  // Check total activities in last 24 hours
  const { data: dailyActivities } = await supabase
    .from('activities')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', oneDayAgo.toISOString());

  const dailyCount = dailyActivities?.length || 0;
  if (dailyCount >= 10) {
    score += 25;
    reasons.push(`Too many activities today (${dailyCount}/10 limit)`);
  } else if (dailyCount >= 8) {
    score += 10;
    reasons.push(`High activity count today (${dailyCount})`);
  }

  // Check for rapid-fire activities (more than 5 in last 10 minutes)
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const { data: rapidActivities } = await supabase
    .from('activities')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', tenMinutesAgo.toISOString());

  const rapidCount = rapidActivities?.length || 0;
  if (rapidCount >= 5) {
    score += 40;
    reasons.push(`Suspicious: ${rapidCount} activities in last 10 minutes`);
  }

  return { valid: score < 50, score, reasons };
}

/**
 * Verify activity pattern matches user history
 */
export async function verifyActivityPattern(
  userId: string,
  activityType: string,
  cropName: string | null
): Promise<{ valid: boolean; score: number; reasons: string[] }> {
  const reasons: string[] = [];
  let score = 0;

  const supabase = getSupabaseClient();

  // Get user's activity history
  const { data: userActivities } = await supabase
    .from('activities')
    .select('activity_type, crop_name, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!userActivities || userActivities.length === 0) {
    // New user, no pattern to verify
    return { valid: true, score: 0, reasons: [] };
  }

  // Check if this activity type is unusual for this user
  const typeCount = userActivities.filter(a => a.activity_type === activityType).length;
  const totalCount = userActivities.length;
  const typePercentage = (typeCount / totalCount) * 100;

  // If activity type represents less than 5% of history and user has > 10 activities, flag it
  if (totalCount > 10 && typePercentage < 5) {
    score += 15;
    reasons.push(`Unusual activity type for this user`);
  }

  // Check crop consistency
  if (cropName) {
    const cropActivities = userActivities.filter(a => a.crop_name === cropName);
    if (cropActivities.length === 0 && totalCount > 5) {
      score += 10;
      reasons.push(`New crop not seen in user history`);
    }
  }

  return { valid: score < 30, score, reasons };
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Main verification function that combines all checks
 */
export async function verifyActivity(
  userId: string,
  activityData: {
    activity_type: string;
    crop_name: string | null;
    location?: LocationData;
  }
): Promise<VerificationResult> {
  const allReasons: string[] = [];
  let totalScore = 0;

  // Location verification
  if (activityData.location) {
    const locationCheck = await verifyLocation(activityData.location, userId);
    totalScore += locationCheck.score;
    allReasons.push(...locationCheck.reasons);
  } else {
    totalScore += 10;
    allReasons.push('No location provided');
  }

  // Timestamp and frequency verification
  const timeCheck = await verifyTimestampAndFrequency(userId, activityData.activity_type);
  totalScore += timeCheck.score;
  allReasons.push(...timeCheck.reasons);

  // Pattern verification
  const patternCheck = await verifyActivityPattern(
    userId,
    activityData.activity_type,
    activityData.crop_name
  );
  totalScore += patternCheck.score;
  allReasons.push(...patternCheck.reasons);

  // Determine verification status
  const passed = totalScore < 50;
  const flagged = totalScore >= 30 || allReasons.length >= 3;

  return {
    passed,
    fraudScore: Math.min(totalScore, 100),
    reasons: allReasons,
    flagged,
  };
}

