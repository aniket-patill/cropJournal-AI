type ActivityType = 'organic_input' | 'water_conservation' | 'soil_health' | 'pest_management' | 'crop_rotation' | 'other';

interface CreditCalculationInput {
  activity_type: ActivityType;
  crop_name: string | null;
  area: string | null;
  description: string;
}

interface CreditCalculationOptions {
  qualityScore?: number;
  requireFarmingContent?: boolean;
}

// Base credits for each activity type
const BASE_CREDITS: Record<ActivityType, number> = {
  organic_input: 50,
  water_conservation: 40,
  soil_health: 60,
  pest_management: 45,
  crop_rotation: 55,
  other: 30,
};

// Crop multipliers (some crops are more valuable)
const CROP_MULTIPLIERS: Record<string, number> = {
  'rice': 1.2,
  'wheat': 1.1,
  'corn': 1.15,
  'cotton': 1.3,
  'sugarcane': 1.25,
  'vegetables': 1.0,
  'fruits': 1.1,
};

// Extract numeric area value from string (e.g., "2 acres" -> 2)
function extractAreaValue(area: string | null): number {
  if (!area) return 1;

  const match = area.match(/(\d+\.?\d*)/);
  if (match) {
    return parseFloat(match[1]);
  }
  return 1;
}

// Calculate area multiplier (capped at 5x for very large areas)
function getAreaMultiplier(area: string | null): number {
  const areaValue = extractAreaValue(area);
  // Scale: 1 acre = 1x, 2 acres = 1.5x, 5+ acres = 2x (capped)
  const multiplier = Math.min(1 + (areaValue * 0.1), 2);
  return multiplier;
}

export function calculateCredits(
  input: CreditCalculationInput,
  options: CreditCalculationOptions = {}
): number {
  const { qualityScore, requireFarmingContent = true } = options;

  // Return 0 credits if quality score is too low
  if (qualityScore !== undefined && qualityScore < 30) {
    return 0;
  }

  // Return 0 credits if 'other' type and no quality indicators or low quality
  // This prevents meaningless content from getting credits
  if (input.activity_type === 'other') {
    if (qualityScore === undefined || qualityScore < 50) {
      // If no quality score provided, still allow but with lower credits
      // If quality score is provided but low, return 0
      if (qualityScore !== undefined) {
        return 0;
      }
    }
    // If 'other' type and requireFarmingContent is true, validate description
    if (requireFarmingContent && (!input.description || input.description.trim().length < 15)) {
      return 0;
    }
  }

  const baseCredits = BASE_CREDITS[input.activity_type] || BASE_CREDITS.other;

  // Apply crop multiplier
  let cropMultiplier = 1;
  if (input.crop_name) {
    const cropLower = input.crop_name.toLowerCase();
    for (const [crop, multiplier] of Object.entries(CROP_MULTIPLIERS)) {
      if (cropLower.includes(crop)) {
        cropMultiplier = multiplier;
        break;
      }
    }
  }

  // Apply area multiplier
  const areaMultiplier = getAreaMultiplier(input.area);

  // Calculate base credits
  let credits = baseCredits * cropMultiplier * areaMultiplier;

  // Apply quality multiplier if quality score is provided
  // Quality multiplier ranges from 0.5x (low quality) to 1.5x (high quality)
  if (qualityScore !== undefined) {
    const qualityMultiplier = 0.5 + (qualityScore / 100) * 1.0; // Maps 0-100 to 0.5-1.5
    credits *= qualityMultiplier;
  }

  // Round final credits
  credits = Math.round(credits);

  // No minimum guarantee - return 0 if content is invalid
  // However, ensure legitimate farming activities get at least 5 credits minimum
  // Only apply minimum if quality score is good or not provided
  if (credits > 0 && (qualityScore === undefined || qualityScore >= 50)) {
    return Math.max(credits, 5);
  }

  return Math.max(credits, 0);
}

