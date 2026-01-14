const { createWriteStream } = require('fs');
const { pipeline } = require('stream');
const { OpusEncoder } = require('@discordjs/opus');
const prism = require('prism-media');
const path = require('path');
const fs = require('fs');

class AudioRecorder {
  constructor() {
    this.recordings = new Map(); // Map of userId -> recording stream
    this.recordingsDir = path.join(process.cwd(), 'recordings');
    this.ensureRecordingsDir();
  }

  ensureRecordingsDir() {
    if (!fs.existsSync(this.recordingsDir)) {
      fs.mkdirSync(this.recordingsDir, { recursive: true });
    }
  }

  startRecording(userId, username, sessionId) {
    const timestamp = Date.now();
    const filename = `${sessionId}_${userId}_${timestamp}.pcm`;
    const filepath = path.join(this.recordingsDir, filename);

    const recording = {
      userId,
      username,
      sessionId,
      filename,
      filepath,
      startTime: timestamp,
      stream: createWriteStream(filepath),
      chunks: []
    };

    this.recordings.set(userId, recording);
    console.log(`📹 Started recording for ${username} (${userId})`);

    return recording;
  }

  handleAudioData(userId, audioChunk) {
    const recording = this.recordings.get(userId);
    if (recording && recording.stream) {
      recording.stream.write(audioChunk);
      recording.chunks.push(audioChunk);
    }
  }

  async stopRecording(userId) {
    const recording = this.recordings.get(userId);
    if (!recording) {
      return null;
    }

    return new Promise((resolve, reject) => {
      recording.stream.end(() => {
        recording.endTime = Date.now();
        recording.duration = (recording.endTime - recording.startTime) / 1000; // in seconds

        console.log(`⏹️  Stopped recording for ${recording.username} - Duration: ${recording.duration.toFixed(2)}s`);

        this.recordings.delete(userId);

        // Convert PCM to WAV format for better compatibility with transcription services
        this.convertToWav(recording)
          .then(wavPath => {
            recording.wavPath = wavPath;
            resolve(recording);
          })
          .catch(reject);
      });
    });
  }

  async convertToWav(recording) {
    const wavFilename = recording.filename.replace('.pcm', '.wav');
    const wavPath = path.join(this.recordingsDir, wavFilename);

    return new Promise((resolve, reject) => {
      const ffmpeg = require('fluent-ffmpeg');
      const ffmpegPath = require('ffmpeg-static');
      ffmpeg.setFfmpegPath(ffmpegPath);

      ffmpeg()
        .input(recording.filepath)
        .inputFormat('s16le') // PCM 16-bit little-endian
        .inputOptions([
          '-ar 48000', // Sample rate
          '-ac 2'      // Stereo
        ])
        .output(wavPath)
        .audioCodec('pcm_s16le')
        .on('end', () => {
          console.log(`✅ Converted ${recording.filename} to WAV format`);
          // Delete the PCM file to save space
          fs.unlink(recording.filepath, (err) => {
            if (err) console.error('Error deleting PCM file:', err);
          });
          resolve(wavPath);
        })
        .on('error', (err) => {
          console.error('Error converting to WAV:', err);
          reject(err);
        })
        .run();
    });
  }

  stopAllRecordings() {
    const recordings = Array.from(this.recordings.keys());
    const promises = recordings.map(userId => this.stopRecording(userId));
    return Promise.all(promises);
  }

  getActiveRecordings() {
    return Array.from(this.recordings.values());
  }

  isRecording(userId) {
    return this.recordings.has(userId);
  }

  cleanupOldRecordings(daysOld = 7) {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

    fs.readdir(this.recordingsDir, (err, files) => {
      if (err) {
        console.error('Error reading recordings directory:', err);
        return;
      }

      files.forEach(file => {
        const filepath = path.join(this.recordingsDir, file);
        fs.stat(filepath, (err, stats) => {
          if (err) {
            console.error('Error getting file stats:', err);
            return;
          }

          if (stats.mtimeMs < cutoffTime) {
            fs.unlink(filepath, (err) => {
              if (err) {
                console.error('Error deleting old recording:', err);
              } else {
                console.log(`🗑️  Deleted old recording: ${file}`);
              }
            });
          }
        });
      });
    });
  }
}

module.exports = AudioRecorder;
