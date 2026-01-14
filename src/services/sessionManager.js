const { v4: uuidv4 } = require('crypto').randomUUID ? require('crypto') : { v4: () => require('crypto').randomBytes(16).toString('hex') };

class SessionManager {
  constructor(dbQueries, audioRecorder, transcriptionService, analyticsEngine, reportGenerator) {
    this.db = dbQueries;
    this.audioRecorder = audioRecorder;
    this.transcriptionService = transcriptionService;
    this.analyticsEngine = analyticsEngine;
    this.reportGenerator = reportGenerator;
    this.activeSessions = new Map(); // channelId -> session data
    this.userSessions = new Map(); // userId -> { sessionId, startTime }
  }

  createSession(channel, guild) {
    const sessionId = this.generateSessionId();
    const startTime = Math.floor(Date.now() / 1000);

    const sessionData = {
      session_id: sessionId,
      guild_id: guild.id,
      guild_name: guild.name,
      channel_id: channel.id,
      channel_name: channel.name,
      start_time: startTime,
      participant_count: 0
    };

    // Save to database
    this.db.createSession(sessionData);

    // Store in active sessions
    this.activeSessions.set(channel.id, {
      ...sessionData,
      participants: new Set(),
      recordings: new Map()
    });

    console.log(`✅ Created session: ${sessionId} in ${channel.name}`);

    return sessionId;
  }

  async endSession(channelId) {
    const session = this.activeSessions.get(channelId);
    if (!session) {
      console.warn('No active session found for channel:', channelId);
      return null;
    }

    const endTime = Math.floor(Date.now() / 1000);
    const duration = endTime - session.start_time;

    console.log(`⏹️  Ending session: ${session.session_id}`);

    // Stop all recordings
    const recordings = await this.audioRecorder.stopAllRecordings();

    // Process recordings and transcribe
    const transcriptionPromises = recordings.map(recording =>
      this.processRecording(recording, session.session_id)
    );

    await Promise.all(transcriptionPromises);

    // Update participants who are still in the session
    for (const userId of session.participants) {
      const userSession = this.userSessions.get(userId);
      if (userSession && userSession.sessionId === session.session_id) {
        const participantDuration = endTime - userSession.startTime;
        this.db.removeParticipant(session.session_id, userId, endTime, participantDuration);
        this.userSessions.delete(userId);
      }
    }

    // Update session in database
    this.db.endSession(session.session_id, endTime, duration, session.participants.size);

    // Remove from active sessions
    this.activeSessions.delete(channelId);

    console.log(`✅ Session ended: ${session.session_id} - Duration: ${duration}s`);

    return {
      sessionId: session.session_id,
      duration,
      participantCount: session.participants.size
    };
  }

  addParticipant(sessionId, user, channelId) {
    const session = this.activeSessions.get(channelId);
    if (!session) {
      console.warn('Cannot add participant: No active session');
      return;
    }

    // Skip bots
    if (user.bot) return;

    const joinedAt = Math.floor(Date.now() / 1000);

    session.participants.add(user.id);

    // Add to database
    this.db.addParticipant({
      session_id: sessionId,
      user_id: user.id,
      username: user.username,
      joined_at: joinedAt
    });

    // Track user session
    this.userSessions.set(user.id, {
      sessionId,
      startTime: joinedAt
    });

    // Start recording for this user
    this.audioRecorder.startRecording(user.id, user.username, sessionId);

    console.log(`👤 ${user.username} joined session ${sessionId}`);
  }

  async removeParticipant(sessionId, userId, channelId) {
    const session = this.activeSessions.get(channelId);
    if (!session) return;

    const leftAt = Math.floor(Date.now() / 1000);
    const userSession = this.userSessions.get(userId);

    if (!userSession) return;

    const duration = leftAt - userSession.startTime;

    // Stop recording and process
    const recording = await this.audioRecorder.stopRecording(userId);
    if (recording) {
      await this.processRecording(recording, sessionId);
    }

    // Update database
    this.db.removeParticipant(sessionId, userId, leftAt, duration);

    // Remove from tracking
    session.participants.delete(userId);
    this.userSessions.delete(userId);

    console.log(`👋 User ${userId} left session ${sessionId}`);
  }

  async processRecording(recording, sessionId) {
    try {
      if (!recording.wavPath) {
        console.warn('No WAV file available for transcription');
        return;
      }

      // Transcribe the audio
      const transcription = await this.transcriptionService.transcribeAudio(recording.wavPath);

      if (!transcription.text || transcription.text.trim().length === 0) {
        console.log(`⚠️  No speech detected in recording for ${recording.username}`);
        // Clean up the audio file
        this.transcriptionService.cleanupAudioFile(recording.wavPath);
        return;
      }

      // Save transcription to database
      this.db.addTranscription({
        session_id: sessionId,
        user_id: recording.userId,
        username: recording.username,
        audio_file: recording.wavPath,
        transcript: transcription.text,
        confidence: transcription.confidence,
        language: transcription.language,
        timestamp: Math.floor(recording.startTime / 1000),
        duration: transcription.duration,
        word_count: transcription.wordCount
      });

      console.log(`💾 Saved transcription for ${recording.username}: ${transcription.wordCount} words`);

      // Clean up audio file after successful transcription
      // this.transcriptionService.cleanupAudioFile(recording.wavPath);
    } catch (error) {
      console.error('Error processing recording:', error);
    }
  }

  getActiveSession(channelId) {
    return this.activeSessions.get(channelId);
  }

  hasActiveSession(channelId) {
    return this.activeSessions.has(channelId);
  }

  generateSessionId() {
    // Generate a UUID v4
    if (typeof require('crypto').randomUUID === 'function') {
      return require('crypto').randomUUID();
    } else {
      // Fallback for older Node versions
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  }

  async generateSessionReport(sessionId, channel) {
    try {
      // Check minimum duration requirement
      const session = this.db.findSessionById(sessionId);
      const minDuration = parseInt(process.env.MIN_SESSION_DURATION) || 60;

      if (session && session.duration < minDuration) {
        console.log(`⏭️  Session too short (${session.duration}s < ${minDuration}s), skipping report`);
        return null;
      }

      // Analyze the session
      const analysisData = await this.analyticsEngine.analyzeSession(sessionId);

      // Generate report embed
      const reportEmbed = this.reportGenerator.generateSessionReport(analysisData);

      // Generate transcript
      const transcript = this.reportGenerator.generateTranscriptText(analysisData.transcriptions);

      return {
        embed: reportEmbed,
        transcript,
        analysisData
      };
    } catch (error) {
      console.error('Error generating session report:', error);
      throw error;
    }
  }
}

module.exports = SessionManager;
