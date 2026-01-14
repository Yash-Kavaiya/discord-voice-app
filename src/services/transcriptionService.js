const { GoogleGenerativeAI } = require('@google/generative-ai');
const { VertexAI } = require('@google-cloud/vertexai');
const fs = require('fs');

class TranscriptionService {
  constructor(apiKey) {
    this.useVertexAI = process.env.USE_VERTEX_AI === 'true';
    this.model = process.env.TRANSCRIPTION_MODEL || 'gemini-1.5-flash';
    this.language = process.env.TRANSCRIPTION_LANGUAGE || 'en';
    
    if (this.useVertexAI) {
      // Initialize Vertex AI
      const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;
      const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
      
      if (!projectId) {
        console.warn('⚠️  GOOGLE_CLOUD_PROJECT not set, falling back to API key');
        this.useVertexAI = false;
        this.genAI = new GoogleGenerativeAI(apiKey);
      } else {
        console.log(`✅ Using Vertex AI with project: ${projectId}, location: ${location}`);
        this.vertexAI = new VertexAI({
          project: projectId,
          location: location
        });
      }
    } else {
      // Use standard Gemini API with key
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  async transcribeAudio(audioPath, options = {}) {
    try {
      const serviceName = this.useVertexAI ? 'Vertex AI' : 'Gemini API';
      console.log(`🎤 Transcribing audio with ${serviceName}: ${audioPath}`);

      // Check if file exists and has content
      const stats = fs.statSync(audioPath);
      if (stats.size === 0) {
        console.warn('⚠️  Audio file is empty, skipping transcription');
        return {
          text: '',
          duration: 0,
          wordCount: 0,
          confidence: 0
        };
      }

      // File size limits (20MB for audio)
      const maxSize = 20 * 1024 * 1024; // 20MB
      if (stats.size > maxSize) {
        console.warn(`⚠️  Audio file too large (${(stats.size / 1024 / 1024).toFixed(2)}MB), splitting required`);
        return await this.transcribeLargeFile(audioPath, options);
      }

      // Read the audio file
      const audioData = fs.readFileSync(audioPath);
      const base64Audio = audioData.toString('base64');

      // Get the generative model
      let model;
      if (this.useVertexAI) {
        model = this.vertexAI.getGenerativeModel({
          model: this.model
        });
      } else {
        model = this.genAI.getGenerativeModel({
          model: this.model
        });
      }

      // Prepare the prompt for transcription
      const languageInstruction = options.language || this.language;
      const prompt = `Transcribe the following audio accurately.
The audio is in ${languageInstruction} language.
Provide only the transcription text without any additional commentary or formatting.
Be precise and include all spoken words.`;

      // Create the request with audio data
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: 'audio/wav',
            data: base64Audio
          }
        },
        { text: prompt }
      ]);

      const response = await result.response;
      const transcriptionText = response.text();

      // Calculate statistics
      const wordCount = transcriptionText ? transcriptionText.split(/\s+/).filter(word => word.length > 0).length : 0;

      // Estimate duration based on file size (approximate)
      const estimatedDuration = stats.size / (48000 * 2 * 2); // 48kHz, 16-bit, stereo

      console.log(`✅ ${serviceName} transcription complete: ${wordCount} words`);

      return {
        text: transcriptionText || '',
        language: languageInstruction,
        duration: estimatedDuration,
        wordCount: wordCount,
        confidence: this.calculateConfidence(transcriptionText, wordCount)
      };
    } catch (error) {
      console.error('❌ Transcription error:', error.message);

      // Return empty transcription on error
      return {
        text: `[Transcription failed: ${error.message}]`,
        duration: 0,
        wordCount: 0,
        confidence: 0,
        error: error.message
      };
    }
  }

  async transcribeLargeFile(audioPath, options = {}) {
    try {
      console.log('📦 Processing large audio file...');

      // For large files, we can chunk them
      // For now, try with the file directly but with a warning
      const stats = fs.statSync(audioPath);

      // If extremely large, reject
      if (stats.size > 50 * 1024 * 1024) {
        console.error('❌ Audio file too large (>50MB)');
        return {
          text: '[Audio file too large for transcription (max 50MB)]',
          duration: 0,
          wordCount: 0,
          confidence: 0
        };
      }

      // Try to transcribe anyway
      return await this.transcribeAudio(audioPath, options);
    } catch (error) {
      console.error('❌ Large file transcription error:', error);
      return {
        text: '[Large file transcription failed]',
        duration: 0,
        wordCount: 0,
        confidence: 0
      };
    }
  }

  calculateConfidence(transcriptionText, wordCount) {
    // Estimate confidence based on response quality
    if (!transcriptionText || transcriptionText.length === 0) {
      return 0;
    }

    // Check for error indicators
    if (transcriptionText.includes('[Transcription failed')) {
      return 0;
    }

    // Basic heuristic: longer transcriptions with more words tend to be more reliable
    if (wordCount > 20) {
      return 0.9;
    } else if (wordCount > 10) {
      return 0.8;
    } else if (wordCount > 5) {
      return 0.7;
    } else if (wordCount > 0) {
      return 0.6;
    }

    return 0.5;
  }

  async transcribeMultiple(audioPaths, options = {}) {
    const results = [];

    for (const audioPath of audioPaths) {
      const result = await this.transcribeAudio(audioPath, options);
      results.push({
        audioPath,
        ...result
      });
    }

    return results;
  }

  // Clean up audio files after transcription
  cleanupAudioFile(audioPath) {
    try {
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
        console.log(`🗑️  Cleaned up audio file: ${audioPath}`);
      }
    } catch (error) {
      console.error('Error cleaning up audio file:', error);
    }
  }

  // Alternative method using streaming for very large files
  async transcribeWithChunking(audioPath, options = {}) {
    // This could be implemented for files that need to be split into chunks
    // For now, return to standard method
    return await this.transcribeAudio(audioPath, options);
  }
}

module.exports = TranscriptionService;
