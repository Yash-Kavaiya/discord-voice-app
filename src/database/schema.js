const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseSchema {
  constructor(dbPath) {
    // Ensure data directory exists
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL'); // Better concurrency
    this.initializeTables();
  }

  initializeTables() {
    // Sessions table - tracks voice channel sessions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        guild_id TEXT NOT NULL,
        guild_name TEXT,
        channel_id TEXT NOT NULL,
        channel_name TEXT,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        duration INTEGER,
        participant_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Participants table - tracks who was in each session
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        joined_at INTEGER NOT NULL,
        left_at INTEGER,
        duration INTEGER,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id)
      )
    `);

    // Transcriptions table - stores transcribed text
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transcriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        audio_file TEXT,
        transcript TEXT NOT NULL,
        confidence REAL,
        language TEXT,
        timestamp INTEGER NOT NULL,
        duration REAL,
        word_count INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (session_id) REFERENCES sessions(session_id)
      )
    `);

    // Analytics table - stores computed analytics
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        total_words INTEGER DEFAULT 0,
        total_speakers INTEGER DEFAULT 0,
        most_active_speaker TEXT,
        most_active_speaker_count INTEGER DEFAULT 0,
        avg_speaking_duration REAL DEFAULT 0,
        topics TEXT,
        sentiment TEXT,
        keywords TEXT,
        computed_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (session_id) REFERENCES sessions(session_id)
      )
    `);

    // Reports table - tracks generated reports
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_id TEXT UNIQUE NOT NULL,
        session_id TEXT,
        report_type TEXT NOT NULL,
        report_date TEXT,
        content TEXT NOT NULL,
        sent_to_channel_id TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (session_id) REFERENCES sessions(session_id)
      )
    `);

    // Create indexes for better query performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_guild ON sessions(guild_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
      CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id);
      CREATE INDEX IF NOT EXISTS idx_participants_user ON participants(user_id);
      CREATE INDEX IF NOT EXISTS idx_transcriptions_session ON transcriptions(session_id);
      CREATE INDEX IF NOT EXISTS idx_transcriptions_timestamp ON transcriptions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics(session_id);
      CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
      CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(report_date);
    `);

    console.log('✅ Database schema initialized successfully');
  }

  getDatabase() {
    return this.db;
  }

  close() {
    this.db.close();
  }
}

module.exports = DatabaseSchema;
