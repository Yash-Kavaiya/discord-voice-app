class DatabaseQueries {
  constructor(db) {
    this.db = db;
    this.prepareStatements();
  }

  prepareStatements() {
    // Session queries
    this.insertSession = this.db.prepare(`
      INSERT INTO sessions (session_id, guild_id, guild_name, channel_id, channel_name, start_time, participant_count)
      VALUES (@session_id, @guild_id, @guild_name, @channel_id, @channel_name, @start_time, @participant_count)
    `);

    this.updateSessionEnd = this.db.prepare(`
      UPDATE sessions
      SET end_time = @end_time, duration = @duration, status = @status, participant_count = @participant_count
      WHERE session_id = @session_id
    `);

    this.getActiveSession = this.db.prepare(`
      SELECT * FROM sessions WHERE channel_id = @channel_id AND status = 'active' LIMIT 1
    `);

    this.getSessionById = this.db.prepare(`
      SELECT * FROM sessions WHERE session_id = @session_id
    `);

    // Participant queries
    this.insertParticipant = this.db.prepare(`
      INSERT INTO participants (session_id, user_id, username, joined_at)
      VALUES (@session_id, @user_id, @username, @joined_at)
    `);

    this.updateParticipantLeft = this.db.prepare(`
      UPDATE participants
      SET left_at = @left_at, duration = @duration
      WHERE session_id = @session_id AND user_id = @user_id AND left_at IS NULL
    `);

    this.getSessionParticipants = this.db.prepare(`
      SELECT * FROM participants WHERE session_id = @session_id ORDER BY joined_at
    `);

    // Transcription queries
    this.insertTranscription = this.db.prepare(`
      INSERT INTO transcriptions (session_id, user_id, username, audio_file, transcript, confidence, language, timestamp, duration, word_count)
      VALUES (@session_id, @user_id, @username, @audio_file, @transcript, @confidence, @language, @timestamp, @duration, @word_count)
    `);

    this.getSessionTranscriptions = this.db.prepare(`
      SELECT * FROM transcriptions WHERE session_id = @session_id ORDER BY timestamp
    `);

    this.getTranscriptionsByDateRange = this.db.prepare(`
      SELECT t.*, s.guild_id, s.channel_name
      FROM transcriptions t
      JOIN sessions s ON t.session_id = s.session_id
      WHERE t.timestamp BETWEEN @start_time AND @end_time
      ORDER BY t.timestamp
    `);

    // Analytics queries
    this.insertAnalytics = this.db.prepare(`
      INSERT INTO analytics (session_id, total_words, total_speakers, most_active_speaker, most_active_speaker_count, avg_speaking_duration, topics, sentiment, keywords)
      VALUES (@session_id, @total_words, @total_speakers, @most_active_speaker, @most_active_speaker_count, @avg_speaking_duration, @topics, @sentiment, @keywords)
    `);

    this.getSessionAnalytics = this.db.prepare(`
      SELECT * FROM analytics WHERE session_id = @session_id
    `);

    // Report queries
    this.insertReport = this.db.prepare(`
      INSERT INTO reports (report_id, session_id, report_type, report_date, content, sent_to_channel_id)
      VALUES (@report_id, @session_id, @report_type, @report_date, @content, @sent_to_channel_id)
    `);

    this.getReportsByType = this.db.prepare(`
      SELECT * FROM reports WHERE report_type = @report_type ORDER BY created_at DESC
    `);
  }

  // Session methods
  createSession(sessionData) {
    try {
      return this.insertSession.run(sessionData);
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  endSession(sessionId, endTime, duration, participantCount) {
    try {
      return this.updateSessionEnd.run({
        session_id: sessionId,
        end_time: endTime,
        duration: duration,
        status: 'completed',
        participant_count: participantCount
      });
    } catch (error) {
      console.error('Error ending session:', error);
      throw error;
    }
  }

  findActiveSession(channelId) {
    try {
      return this.getActiveSession.get({ channel_id: channelId });
    } catch (error) {
      console.error('Error finding active session:', error);
      throw error;
    }
  }

  findSessionById(sessionId) {
    try {
      return this.getSessionById.get({ session_id: sessionId });
    } catch (error) {
      console.error('Error finding session:', error);
      throw error;
    }
  }

  // Participant methods
  addParticipant(participantData) {
    try {
      return this.insertParticipant.run(participantData);
    } catch (error) {
      console.error('Error adding participant:', error);
      throw error;
    }
  }

  removeParticipant(sessionId, userId, leftAt, duration) {
    try {
      return this.updateParticipantLeft.run({
        session_id: sessionId,
        user_id: userId,
        left_at: leftAt,
        duration: duration
      });
    } catch (error) {
      console.error('Error removing participant:', error);
      throw error;
    }
  }

  getParticipants(sessionId) {
    try {
      return this.getSessionParticipants.all({ session_id: sessionId });
    } catch (error) {
      console.error('Error getting participants:', error);
      throw error;
    }
  }

  // Transcription methods
  addTranscription(transcriptionData) {
    try {
      return this.insertTranscription.run(transcriptionData);
    } catch (error) {
      console.error('Error adding transcription:', error);
      throw error;
    }
  }

  getTranscriptions(sessionId) {
    try {
      return this.getSessionTranscriptions.all({ session_id: sessionId });
    } catch (error) {
      console.error('Error getting transcriptions:', error);
      throw error;
    }
  }

  getTranscriptionsByDate(startTime, endTime) {
    try {
      return this.getTranscriptionsByDateRange.all({
        start_time: startTime,
        end_time: endTime
      });
    } catch (error) {
      console.error('Error getting transcriptions by date:', error);
      throw error;
    }
  }

  // Analytics methods
  saveAnalytics(analyticsData) {
    try {
      return this.insertAnalytics.run(analyticsData);
    } catch (error) {
      console.error('Error saving analytics:', error);
      throw error;
    }
  }

  getAnalytics(sessionId) {
    try {
      return this.getSessionAnalytics.get({ session_id: sessionId });
    } catch (error) {
      console.error('Error getting analytics:', error);
      throw error;
    }
  }

  // Report methods
  saveReport(reportData) {
    try {
      return this.insertReport.run(reportData);
    } catch (error) {
      console.error('Error saving report:', error);
      throw error;
    }
  }

  getReports(reportType) {
    try {
      return this.getReportsByType.all({ report_type: reportType });
    } catch (error) {
      console.error('Error getting reports:', error);
      throw error;
    }
  }

  // Stats queries
  getDailyStats(date) {
    try {
      const startOfDay = Math.floor(new Date(date).setHours(0, 0, 0, 0) / 1000);
      const endOfDay = Math.floor(new Date(date).setHours(23, 59, 59, 999) / 1000);

      const sessions = this.db.prepare(`
        SELECT COUNT(*) as count, SUM(duration) as total_duration
        FROM sessions
        WHERE start_time BETWEEN ? AND ?
      `).get(startOfDay, endOfDay);

      const transcriptions = this.db.prepare(`
        SELECT COUNT(*) as count, SUM(word_count) as total_words
        FROM transcriptions
        WHERE timestamp BETWEEN ? AND ?
      `).get(startOfDay, endOfDay);

      const uniqueSpeakers = this.db.prepare(`
        SELECT COUNT(DISTINCT user_id) as count
        FROM transcriptions
        WHERE timestamp BETWEEN ? AND ?
      `).get(startOfDay, endOfDay);

      return {
        sessions: sessions.count || 0,
        totalDuration: sessions.total_duration || 0,
        transcriptions: transcriptions.count || 0,
        totalWords: transcriptions.total_words || 0,
        uniqueSpeakers: uniqueSpeakers.count || 0
      };
    } catch (error) {
      console.error('Error getting daily stats:', error);
      throw error;
    }
  }
}

module.exports = DatabaseQueries;
