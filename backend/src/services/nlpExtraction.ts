import { groq } from '../lib/groq';
import { AppError } from '../utils/errors';

interface ExtractedData {
  activity_type: 'organic_input' | 'water_conservation' | 'soil_health' | 'pest_management' | 'crop_rotation' | 'other';
  crop_name: string | null;
  area: string | null;
  description: string;
}

export async function extractActivityData(text: string): Promise<ExtractedData> {
  try {
    const prompt = `Extract farming activity information from the following text. This text may be from a voice transcription, so it might have speech artifacts, filler words, or incomplete sentences. Focus on extracting the key information.

Return ONLY a valid JSON object with these exact fields:
{
  "activity_type": one of "organic_input", "water_conservation", "soil_health", "pest_management", "crop_rotation", or "other",
  "crop_name": the crop name if mentioned, or null,
  "area": the area/land size if mentioned (e.g., "2 acres", "5 hectares"), or null,
  "description": a cleaned and concise description of the activity (remove filler words, fix grammar if needed)
}

Text: "${text}"

Return ONLY the JSON object, no other text.`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that extracts structured farming activity data from text, including voice transcriptions. Handle speech artifacts, filler words, and incomplete sentences. Always return valid JSON only. Be accurate in extracting activity type, crop names, and area information.',
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

    return extracted;
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error('NLP extraction error:', error);
    
    // Fallback: return basic structure
    return {
      activity_type: 'other',
      crop_name: null,
      area: null,
      description: text.substring(0, 200),
    };
  }
}

