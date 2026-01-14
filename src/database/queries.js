class DatabaseQueries {
  constructor(db, saveCallback) {
    this.db = db;
    this.saveCallback = saveCallback;
  }

  // Helper method to run a query and save
  runAndSave(sql, params = []) {
    this.db.run(sql, params);
    if (this.saveCallback) {
      this.saveCallback();
    }
  }

  // Helper to get single row
  getOne(sql, params = []) {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }

  // Helper to get all rows
  getAll(sql, params = []) {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  // Session methods
  createSession(sessionData) {
    try {
      this.runAndSave(
        `INSERT INTO sessions (session_id, guild_id, guild_name, channel_id, channel_name, start_time, participant_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionData.session_id,
          sessionData.guild_id,
          sessionData.guild_name,
          sessionData.channel_id,
          sessionData.channel_name,
          sessionData.start_time,
          sessionData.participant_count
        ]
      );
      return { changes: 1 };
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  endSession(sessionId, endTime, duration, participantCount) {
    try {
      this.runAndSave(
        `UPDATE sessions
         SET end_time = ?, duration = ?, status = ?, participant_count = ?
         WHERE session_id = ?`,
        [endTime, duration, 'completed', participantCount, sessionId]
      );
      return { changes: 1 };
    } catch (error) {
      console.error('Error ending session:', error);
      throw error;
    }
  }

  findActiveSession(channelId) {
    try {
      return this.getOne(
        `SELECT * FROM sessions WHERE channel_id = ? AND status = 'active' LIMIT 1`,
        [channelId]
      );
    } catch (error) {
      console.error('Error finding active session:', error);
      throw error;
    }
  }

  findSessionById(sessionId) {
    try {
      return this.getOne(
        `SELECT * FROM sessions WHERE session_id = ?`,
        [sessionId]
      );
    } catch (error) {
      console.error('Error finding session:', error);
      throw error;
    }
  }

  // Alias for findSessionById
  getSession(sessionId) {
    return this.findSessionById(sessionId);
  }

  // Get daily activity
  getDailyActivity(date) {
    try {
      return this.getAll(
        `SELECT * FROM sessions WHERE DATE(start_time) = DATE(?) ORDER BY start_time`,
        [date]
      );
    } catch (error) {
      console.error('Error getting daily activity:', error);
      throw error;
    }
  }

  // Participant methods
  addParticipant(participantData) {
    try {
      this.runAndSave(
        `INSERT INTO participants (session_id, user_id, username, joined_at)
         VALUES (?, ?, ?, ?)`,
        [
          participantData.session_id,
          participantData.user_id,
          participantData.username,
          participantData.joined_at
        ]
      );
      return { changes: 1 };
    } catch (error) {
      console.error('Error adding participant:', error);
      throw error;
    }
  }

  removeParticipant(sessionId, userId, leftAt, duration) {
    try {
      this.runAndSave(
        `UPDATE participants
         SET left_at = ?, duration = ?
         WHERE session_id = ? AND user_id = ? AND left_at IS NULL`,
        [leftAt, duration, sessionId, userId]
      );
      return { changes: 1 };
    } catch (error) {
      console.error('Error removing participant:', error);
      throw error;
    }
  }

  getParticipants(sessionId) {
    try {
      return this.getAll(
        `SELECT * FROM participants WHERE session_id = ? ORDER BY joined_at`,
        [sessionId]
      );
    } catch (error) {
      console.error('Error getting participants:', error);
      throw error;
    }
  }

  // Transcription methods
  addTranscription(transcriptionData) {
    try {
      this.runAndSave(
        `INSERT INTO transcriptions (session_id, user_id, username, audio_file, transcript, confidence, language, timestamp, duration, word_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transcriptionData.session_id,
          transcriptionData.user_id,
          transcriptionData.username,
          transcriptionData.audio_file,
          transcriptionData.transcript,
          transcriptionData.confidence,
          transcriptionData.language,
          transcriptionData.timestamp,
          transcriptionData.duration,
          transcriptionData.word_count
        ]
      );
      return { changes: 1 };
    } catch (error) {
      console.error('Error adding transcription:', error);
      throw error;
    }
  }

  getTranscriptions(sessionId) {
    try {
      return this.getAll(
        `SELECT * FROM transcriptions WHERE session_id = ? ORDER BY timestamp`,
        [sessionId]
      );
    } catch (error) {
      console.error('Error getting transcriptions:', error);
      throw error;
    }
  }

  getTranscriptionsByDate(startTime, endTime) {
    try {
      return this.getAll(
        `SELECT t.*, s.guild_id, s.channel_name
         FROM transcriptions t
         JOIN sessions s ON t.session_id = s.session_id
         WHERE t.timestamp BETWEEN ? AND ?
         ORDER BY t.timestamp`,
        [startTime, endTime]
      );
    } catch (error) {
      console.error('Error getting transcriptions by date:', error);
      throw error;
    }
  }

  // Analytics methods
  saveAnalytics(analyticsData) {
    try {
      this.runAndSave(
        `INSERT INTO analytics (session_id, total_words, total_speakers, most_active_speaker, most_active_speaker_count, avg_speaking_duration, topics, sentiment, keywords)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          analyticsData.session_id,
          analyticsData.total_words,
          analyticsData.total_speakers,
          analyticsData.most_active_speaker,
          analyticsData.most_active_speaker_count,
          analyticsData.avg_speaking_duration,
          analyticsData.topics,
          analyticsData.sentiment,
          analyticsData.keywords
        ]
      );
      return { changes: 1 };
    } catch (error) {
      console.error('Error saving analytics:', error);
      throw error;
    }
  }

  getAnalytics(sessionId) {
    try {
      return this.getOne(
        `SELECT * FROM analytics WHERE session_id = ?`,
        [sessionId]
      );
    } catch (error) {
      console.error('Error getting analytics:', error);
      throw error;
    }
  }

  // Report methods
  saveReport(reportData) {
    try {
      this.runAndSave(
        `INSERT INTO reports (report_id, session_id, report_type, report_date, content, sent_to_channel_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          reportData.report_id,
          reportData.session_id,
          reportData.report_type,
          reportData.report_date,
          reportData.content,
          reportData.sent_to_channel_id
        ]
      );
      return { changes: 1 };
    } catch (error) {
      console.error('Error saving report:', error);
      throw error;
    }
  }

  getReports(reportType) {
    try {
      return this.getAll(
        `SELECT * FROM reports WHERE report_type = ? ORDER BY created_at DESC`,
        [reportType]
      );
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

      const sessions = this.getOne(
        `SELECT COUNT(*) as count, SUM(duration) as total_duration
         FROM sessions
         WHERE start_time BETWEEN ? AND ?`,
        [startOfDay, endOfDay]
      );

      const transcriptions = this.getOne(
        `SELECT COUNT(*) as count, SUM(word_count) as total_words
         FROM transcriptions
         WHERE timestamp BETWEEN ? AND ?`,
        [startOfDay, endOfDay]
      );

      const uniqueSpeakers = this.getOne(
        `SELECT COUNT(DISTINCT user_id) as count
         FROM transcriptions
         WHERE timestamp BETWEEN ? AND ?`,
        [startOfDay, endOfDay]
      );

      return {
        sessions: sessions?.count || 0,
        totalDuration: sessions?.total_duration || 0,
        transcriptions: transcriptions?.count || 0,
        totalWords: transcriptions?.total_words || 0,
        uniqueSpeakers: uniqueSpeakers?.count || 0
      };
    } catch (error) {
      console.error('Error getting daily stats:', error);
      throw error;
    }
  }
}

module.exports = DatabaseQueries;
