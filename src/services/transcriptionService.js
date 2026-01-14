const OpenAI = require('openai');
const fs = require('fs');

class TranscriptionService {
  constructor(apiKey) {
    this.openai = new OpenAI({
      apiKey: apiKey
    });
    this.model = process.env.TRANSCRIPTION_MODEL || 'whisper-1';
    this.language = process.env.TRANSCRIPTION_LANGUAGE || 'en';
  }

  async transcribeAudio(audioPath, options = {}) {
    try {
      console.log(`🎤 Transcribing audio: ${audioPath}`);

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

      // Whisper API has a 25MB file size limit
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (stats.size > maxSize) {
        console.warn(`⚠️  Audio file too large (${(stats.size / 1024 / 1024).toFixed(2)}MB), splitting required`);
        return await this.transcribeLargeFile(audioPath, options);
      }

      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: this.model,
        language: options.language || this.language,
        response_format: 'verbose_json',
        timestamp_granularities: ['word']
      });

      const wordCount = transcription.text ? transcription.text.split(/\s+/).filter(word => word.length > 0).length : 0;

      console.log(`✅ Transcription complete: ${wordCount} words`);

      return {
        text: transcription.text || '',
        language: transcription.language,
        duration: transcription.duration,
        wordCount: wordCount,
        words: transcription.words || [],
        confidence: this.calculateConfidence(transcription)
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
    // For large files, we would need to split them
    // For now, return an error message
    console.error('❌ Large file transcription not yet implemented');
    return {
      text: '[Audio file too large for transcription]',
      duration: 0,
      wordCount: 0,
      confidence: 0
    };
  }

  calculateConfidence(transcription) {
    // Whisper doesn't provide confidence scores directly
    // We can estimate based on the presence of words and duration
    if (!transcription.text || transcription.text.length === 0) {
      return 0;
    }

    // Basic heuristic: longer transcriptions with more words tend to be more reliable
    const wordCount = transcription.text.split(/\s+/).length;
    const hasWords = transcription.words && transcription.words.length > 0;

    if (hasWords && wordCount > 10) {
      return 0.9;
    } else if (wordCount > 5) {
      return 0.75;
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
}

module.exports = TranscriptionService;
