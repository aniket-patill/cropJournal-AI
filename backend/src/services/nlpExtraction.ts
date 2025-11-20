import { groq } from '../lib/groq';
import { AppError } from '../utils/errors';

export interface ExtractedData {
  activity_type: 'organic_input' | 'water_conservation' | 'soil_health' | 'pest_management' | 'crop_rotation' | 'other';
  crop_name: string | null;
  area: string | null;
  description: string;
}

export async function extractActivityData(text: string): Promise<ExtractedData> {
  try {
    const prompt = `Extract farming activity information from the following text. This text may be from a voice transcription in English, Kannada (ಕನ್ನಡ), or Marathi (मराठी), so it might have speech artifacts, filler words, or incomplete sentences. Focus on extracting the key information.

IMPORTANT: 
- The text may be in English, Kannada, or Marathi. Handle all three languages.
- If the text does NOT describe a farming activity, is too short, meaningless, or contains only filler words (like "hello", "test", "uh" in English; "ಹಲೋ", "ಪರೀಕ್ಷೆ" in Kannada; or "नमस्कार", "चाचणी" in Marathi), return activity_type as "other" and ensure the description clearly indicates this is not a valid farming activity.
- For Kannada or Marathi text, extract crop names and activity details in their original language form, but ensure the description is clear and understandable.

Return ONLY a valid JSON object with these exact fields:
{
  "activity_type": one of "organic_input", "water_conservation", "soil_health", "pest_management", "crop_rotation", or "other" (use "other" only if it's a valid farming activity that doesn't fit other categories, NOT for non-farming content),
  "crop_name": the crop name if mentioned (preserve original language), or null,
  "area": the area/land size if mentioned (e.g., "2 acres", "5 hectares" in English; "2 ಎಕರೆ", "5 ಹೆಕ್ಟೇರ್" in Kannada; or "2 एकर", "5 हेक्टर" in Marathi), or null,
  "description": a cleaned and concise description of the activity (remove filler words, fix grammar if needed, preserve original language). If text is not about farming, include "NOT_FARMING" in description.
}

Text: "${text}"

Return ONLY the JSON object, no other text.`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that extracts structured farming activity data from text in multiple languages, including English, Kannada (ಕನ್ನಡ), and Marathi (मराठी). The text may come from voice transcriptions, so handle speech artifacts, filler words, and incomplete sentences. Always return valid JSON only. Be accurate in extracting activity type, crop names, and area information from English, Kannada, and Marathi text. Preserve the original language in crop names and descriptions. IMPORTANT: If the text is not about farming activities (e.g., "hello"/"ಹಲೋ"/"नमस्कार", "test"/"ಪರೀಕ್ಷೆ"/"चाचणी", meaningless text), return activity_type as "other" and include "NOT_FARMING" in the description field.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 500,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    
    // Try to extract JSON from the response
    let jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new AppError('Failed to extract JSON from NLP response', 500);
    }

    const extracted = JSON.parse(jsonMatch[0]) as ExtractedData;

    // Validate activity_type
    const validTypes = ['organic_input', 'water_conservation', 'soil_health', 'pest_management', 'crop_rotation', 'other'];
    if (!validTypes.includes(extracted.activity_type)) {
      extracted.activity_type = 'other';
    }

    // Ensure description is present
    if (!extracted.description || extracted.description.trim() === '') {
      extracted.description = text.substring(0, 200); // Fallback to original text
    }

    // Check if NLP indicated this is not farming content
    const descriptionLower = extracted.description.toLowerCase();
    if (descriptionLower.includes('not_farming') || descriptionLower.includes('not a farming') || descriptionLower.includes('not farming')) {
      // Mark as invalid - will be handled by validation
      extracted.activity_type = 'other';
      extracted.description = 'NOT_FARMING: ' + extracted.description;
    }

    return extracted;
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error('NLP extraction error:', error);
    
    // Fallback: return basic structure only if text seems valid
    // Otherwise, mark as invalid
    const fallbackDescription = text.substring(0, 200);
    return {
      activity_type: 'other',
      crop_name: null,
      area: null,
      description: fallbackDescription,
    };
  }
}

/**
 * Check if extracted data indicates valid farming content
 */
export function isValidFarmingExtraction(extractedData: ExtractedData): boolean {
  const descriptionLower = extractedData.description.toLowerCase();
  
  // Check if marked as not farming
  if (descriptionLower.includes('not_farming') || 
      descriptionLower.includes('not a farming') || 
      descriptionLower.includes('not farming')) {
    return false;
  }
  
  // If activity_type is 'other' and description is too short or generic, might be invalid
  if (extractedData.activity_type === 'other' && extractedData.description.length < 20) {
    return false;
  }
  
  return true;
}

