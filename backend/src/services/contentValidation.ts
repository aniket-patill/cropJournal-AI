/**
 * Content validation and quality scoring for farming activity submissions
 */

// Farming-related keywords that indicate actual farming content
const FARMING_KEYWORDS = [
  // Crops
  'crop', 'crops', 'rice', 'wheat', 'corn', 'maize', 'cotton', 'sugarcane', 'vegetable', 'vegetables',
  'fruit', 'fruits', 'tomato', 'potato', 'onion', 'cabbage', 'mango', 'banana', 'paddy',
  // Activities
  'farming', 'farm', 'agriculture', 'cultivation', 'planting', 'harvesting', 'irrigation', 'watering',
  'fertilizer', 'fertiliser', 'organic', 'compost', 'manure', 'soil', 'field', 'land', 'acre', 'acres',
  'hectare', 'hectares', 'plough', 'plow', 'sowing', 'seeding', 'weeding', 'pest', 'pests', 'disease',
  'pesticide', 'herbicide', 'crop rotation', 'organic farming', 'sustainable', 'sustainability',
  // Water-related
  'water', 'rainwater', 'drip', 'sprinkler', 'irrigation', 'conservation',
  // Soil-related
  'soil health', 'soil testing', 'nutrients', 'ph', 'organic matter',
  // Common Indian terms
  'khet', 'zameen', 'fasal', 'beej', 'khad', 'paani',
];

// Meaningless filler words and patterns
const FILLER_WORDS = ['um', 'uh', 'er', 'ah', 'oh', 'hello', 'hi', 'hey', 'test', 'testing', 'yes', 'no', 'ok', 'okay'];

// Activity indicator words that suggest actual activities being performed
const ACTIVITY_INDICATORS = [
  'did', 'done', 'applied', 'used', 'added', 'spread', 'planted', 'sowed', 'harvested',
  'irrigated', 'watered', 'treated', 'sprayed', 'mixed', 'prepared', 'cultivated', 'rotated',
];

// Minimum meaningful length after cleaning (in characters)
const MIN_MEANINGFUL_LENGTH = 15;

/**
 * Check if text contains farming-related content
 */
function hasFarmingKeywords(text: string): boolean {
  const lowerText = text.toLowerCase();
  return FARMING_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

/**
 * Check if text contains activity indicators
 */
function hasActivityIndicators(text: string): boolean {
  const lowerText = text.toLowerCase();
  return ACTIVITY_INDICATORS.some(indicator => lowerText.includes(indicator));
}

/**
 * Check if text is only filler words
 */
function isOnlyFillerWords(text: string): boolean {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return true;
  
  // If all words are filler words, it's invalid
  return words.every(word => FILLER_WORDS.includes(word));
}

/**
 * Check if text is mostly repeated characters or words
 */
function isRepeatedContent(text: string): boolean {
  const words = text.trim().split(/\s+/);
  
  // Check for repeated single characters (e.g., "aaaa", "test test test")
  if (words.length >= 3) {
    const uniqueWords = new Set(words);
    if (uniqueWords.size <= 2 && words.length >= 5) {
      return true; // Too many repeated words
    }
  }
  
  // Check for repeated characters (e.g., "aaaa")
  const charPattern = /(.)\1{4,}/; // Same character repeated 5+ times
  if (charPattern.test(text)) {
    return true;
  }
  
  return false;
}

/**
 * Check if text is too short to be meaningful
 */
function isTooShort(text: string): boolean {
  // Remove whitespace and check length
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length < MIN_MEANINGFUL_LENGTH;
}

/**
 * Calculate content quality score (0-100)
 */
export function calculateContentQualityScore(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  const cleaned = text.trim();
  
  // Empty or whitespace only
  if (cleaned.length === 0) {
    return 0;
  }

  let score = 0;

  // Length score (0-30 points)
  // Longer meaningful content = higher score
  const length = cleaned.replace(/\s+/g, ' ').length;
  if (length >= 100) {
    score += 30;
  } else if (length >= 50) {
    score += 20;
  } else if (length >= 30) {
    score += 15;
  } else if (length >= MIN_MEANINGFUL_LENGTH) {
    score += 10;
  } else {
    return 0; // Too short to be meaningful
  }

  // Farming keywords (0-40 points)
  if (hasFarmingKeywords(cleaned)) {
    const keywordMatches = FARMING_KEYWORDS.filter(keyword => 
      cleaned.toLowerCase().includes(keyword)
    ).length;
    score += Math.min(keywordMatches * 5, 40); // Max 40 points
  }

  // Activity indicators (0-20 points)
  if (hasActivityIndicators(cleaned)) {
    score += 20;
  }

  // Penalties
  // Repeated content penalty (-30)
  if (isRepeatedContent(cleaned)) {
    score -= 30;
  }

  // Only filler words penalty (-50)
  if (isOnlyFillerWords(cleaned)) {
    score -= 50;
  }

  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * Check if text represents valid farming content
 */
export function isValidFarmingContent(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const cleaned = text.trim();

  // Empty or whitespace only
  if (cleaned.length === 0) {
    return false;
  }

  // Too short
  if (isTooShort(cleaned)) {
    return false;
  }

  // Only filler words
  if (isOnlyFillerWords(cleaned)) {
    return false;
  }

  // Repeated content
  if (isRepeatedContent(cleaned)) {
    return false;
  }

  // Calculate quality score
  const qualityScore = calculateContentQualityScore(cleaned);

  // Require minimum quality score (30) for valid content
  if (qualityScore < 30) {
    return false;
  }

  // Require at least some farming keywords or activity indicators
  if (!hasFarmingKeywords(cleaned) && !hasActivityIndicators(cleaned)) {
    // Allow if quality score is very high (might be valid farming content in different language)
    if (qualityScore < 70) {
      return false;
    }
  }

  return true;
}

/**
 * Extract farming keywords from text
 */
export function extractFarmingKeywords(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const lowerText = text.toLowerCase();
  return FARMING_KEYWORDS.filter(keyword => lowerText.includes(keyword));
}


