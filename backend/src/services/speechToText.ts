import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { AppError } from '../utils/errors';

/**
 * Transcribe audio using Sarvam AI API
 * Supports various audio formats: webm, mp3, wav, m4a
 * Sarvam AI is optimized for Indian languages including Hindi, Kannada, etc.
 */
export async function transcribeAudio(audioFilePath: string): Promise<string> {
  try {
    const sarvamApiKey = process.env.SARVAM_API_KEY;
    
    if (!sarvamApiKey) {
      throw new AppError(
        'Sarvam AI API key not configured. Please set SARVAM_API_KEY in your .env file.',
        500
      );
    }

    // Check if file exists
    if (!fs.existsSync(audioFilePath)) {
      throw new AppError('Audio file not found', 400);
    }

    // Read audio file
    const audioBuffer = fs.readFileSync(audioFilePath);
    const fileName = audioFilePath.split(/[/\\]/).pop() || 'audio.webm';
    const mimeType = getMimeType(fileName);

    // Create form data for Sarvam AI API
    const formData = new FormData();
    // Sarvam AI expects the file field to be named 'file'
    formData.append('file', audioBuffer, {
      filename: fileName,
      contentType: mimeType,
    });
    
    // Optional: Add language parameter - Sarvam AI supports Indian languages
    // Options: 'en-IN' (English), 'hi-IN' (Hindi), 'kn-IN' (Kannada), 'unknown' (auto-detect), etc.
    const language = process.env.SARVAM_LANGUAGE;
    if (language) {
      formData.append('language_code', language);
    }
    
    // Optional: Specify model (default is saarika:v2.5)
    const model = process.env.SARVAM_MODEL;
    if (model) {
      formData.append('model', model);
    }

    // Sarvam AI API endpoint (from official documentation)
    // POST https://api.sarvam.ai/speech-to-text
    const sarvamApiUrl = process.env.SARVAM_API_URL || 'https://api.sarvam.ai/speech-to-text';
    
    // Sarvam AI uses 'api-subscription-key' header for authentication
    const headers: Record<string, string> = {
      'api-subscription-key': sarvamApiKey,
      ...formData.getHeaders(),
    };
    
    console.log('Sending request to Sarvam AI:', {
      url: sarvamApiUrl,
      hasKey: !!sarvamApiKey,
      fileName: fileName,
      fileSize: audioBuffer.length,
    });
    
    const response = await fetch(sarvamApiUrl, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Sarvam AI transcription failed: ${response.statusText}`;
      
      try {
        const errorData = JSON.parse(errorText);
        // Handle different error response formats
        if (errorData.error) {
          errorMessage = errorData.error.message || errorData.error.code || errorMessage;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        }
      } catch {
        // If not JSON, use the text as is
        if (errorText) {
          errorMessage += `. ${errorText}`;
        }
      }
      
      console.error('Sarvam AI API error:', {
        status: response.status,
        statusText: response.statusText,
        url: sarvamApiUrl,
        errorMessage,
        errorText: errorText.substring(0, 200), // First 200 chars
      });
      
      // Provide helpful error message for 404
      if (response.status === 404) {
        throw new AppError(
          `Sarvam AI endpoint not found (404). Please check SARVAM_API_URL in your .env file. Current URL: ${sarvamApiUrl}. Error: ${errorMessage}`,
          response.status
        );
      }
      
      throw new AppError(errorMessage, response.status);
    }

    const data = await response.json() as any;
    
    // Extract transcription text from response
    // Sarvam AI response format (from official documentation):
    // {
    //   "request_id": "foo",
    //   "transcript": "नमस्ते, आप कैसे हैं?",
    //   "timestamps": {...},
    //   "diarized_transcript": {...},
    //   "language_code": "hi-IN"
    // }
    let transcription = '';
    
    if (data.transcript) {
      transcription = data.transcript;
    } else if (data.text) {
      // Fallback for other possible formats
      transcription = data.text;
    } else if (data.transcription) {
      transcription = data.transcription;
    } else {
      // Log the response for debugging
      console.warn('Unexpected Sarvam AI response format:', JSON.stringify(data, null, 2));
      throw new AppError('Unexpected response format from Sarvam AI - no transcript field found', 500);
    }
    
    // Log successful transcription (optional, for debugging)
    if (transcription) {
      console.log('Sarvam AI transcription successful:', {
        requestId: data.request_id,
        languageCode: data.language_code,
        transcriptLength: transcription.length,
      });
    }

    if (!transcription || transcription.trim() === '') {
      throw new AppError('Sarvam AI returned empty transcription', 500);
    }

    return transcription.trim();
  } catch (error: any) {
    // Clean up file on error
    if (fs.existsSync(audioFilePath)) {
      try {
        fs.unlinkSync(audioFilePath);
      } catch (cleanupError) {
        console.error('Error cleaning up audio file:', cleanupError);
      }
    }

    if (error instanceof AppError) {
      throw error;
    }

    console.error('Speech-to-Text error:', error);
    throw new AppError(`Speech-to-Text failed: ${error.message}`, 500);
  }
}

/**
 * Get MIME type from file extension
 */
function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    'webm': 'audio/webm',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'm4a': 'audio/m4a',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac',
  };

  return mimeTypes[ext || ''] || 'audio/webm';
}
