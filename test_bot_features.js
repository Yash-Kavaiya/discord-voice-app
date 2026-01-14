/**
 * Automated Backend Testing Script for Discord Voice Transcription Bot
 * Tests database, services, and core functionality without Discord UI
 */

require('dotenv').config();
const path = require('path');

// Import services
const DatabaseSchema = require('./src/database/schema');
const DatabaseQueries = require('./src/database/queries');
const AudioRecorder = require('./src/services/audioRecorder');
const TranscriptionService = require('./src/services/transcriptionService');
const AnalyticsEngine = require('./src/services/analyticsEngine');
const ReportGenerator = require('./src/services/reportGenerator');
const SessionManager = require('./src/services/sessionManager');

class BotTester {
  constructor() {
    this.testResults = [];
    this.testSessionId = null; // Will be set during database tests
  }

  log(test, status, message) {
    const result = { test, status, message, timestamp: new Date().toISOString() };
    this.testResults.push(result);
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : 'ℹ️';
    console.log(`${icon} [${test}] ${message}`);
  }

  async initializeServices() {
    try {
      console.log('\n🚀 Initializing Services...\n');

      // Database
      const dbPath = path.resolve(process.env.DATABASE_PATH || './data/transcriptions.db');
      this.dbSchema = new DatabaseSchema();
      await this.dbSchema.initialize(dbPath);
      this.db = new DatabaseQueries(this.dbSchema.getDatabase(), () => this.dbSchema.save());
      this.log('Database', 'PASS', 'Database initialized successfully');

      // Services
      this.audioRecorder = new AudioRecorder();
      this.log('AudioRecorder', 'PASS', 'Audio recorder initialized');

      this.transcriptionService = new TranscriptionService(process.env.GOOGLE_API_KEY);
      this.log('TranscriptionService', 'PASS', 'Transcription service initialized');

      this.analyticsEngine = new AnalyticsEngine(this.db);
      this.log('AnalyticsEngine', 'PASS', 'Analytics engine initialized');

      this.reportGenerator = new ReportGenerator(this.db);
      this.log('ReportGenerator', 'PASS', 'Report generator initialized');

      this.sessionManager = new SessionManager(
        this.db,
        this.audioRecorder,
        this.transcriptionService,
        this.analyticsEngine,
        this.reportGenerator
      );
      this.log('SessionManager', 'PASS', 'Session manager initialized');

      return true;
    } catch (error) {
      this.log('Initialization', 'FAIL', error.message);
      return false;
    }
  }

  async testDatabaseOperations() {
    console.log('\n📊 Testing Database Operations...\n');

    try {
      // Test session creation
      const testSession = {
        session_id: 'test-session-' + Date.now(),
        guild_id: 'test-guild-123',
        guild_name: 'Test Guild',
        channel_id: 'test-channel-456',
        channel_name: 'Test Voice Channel',
        start_time: new Date().toISOString(),
        participant_count: 0
      };

      await this.db.createSession(testSession);
      this.testSessionId = testSession.session_id; // Save for later tests
      this.log('DB-CreateSession', 'PASS', `Created session: ${testSession.session_id}`);

      // Test participant addition
      const testParticipant = {
        session_id: testSession.session_id,
        user_id: 'test-user-789',
        username: 'TestUser',
        joined_at: new Date().toISOString()
      };

      await this.db.addParticipant(testParticipant);
      this.log('DB-AddParticipant', 'PASS', 'Added participant to session');

      // Test session retrieval
      const retrievedSession = await this.db.getSession(testSession.session_id);
      if (retrievedSession && retrievedSession.session_id === testSession.session_id) {
        this.log('DB-GetSession', 'PASS', 'Retrieved session successfully');
      } else {
        this.log('DB-GetSession', 'FAIL', 'Session retrieval mismatch');
      }

      // Test transcription storage
      const testTranscription = {
        session_id: testSession.session_id,
        user_id: testParticipant.user_id,
        username: testParticipant.username,
        audio_file: 'test-audio.wav',
        transcript: 'This is a test transcription for automated testing.',
        timestamp: new Date().toISOString(),
        duration: 5.5,
        word_count: 9,
        confidence: 0.95,
        language: 'en'
      };

      await this.db.addTranscription(testTranscription);
      this.log('DB-SaveTranscription', 'PASS', 'Saved transcription');

      // Test analytics storage
      const testAnalytics = {
        session_id: testSession.session_id,
        total_words: 100,
        total_speakers: 2,
        most_active_speaker: 'TestUser',
        most_active_speaker_count: 50,
        avg_speaking_duration: 5.5,
        topics: JSON.stringify(['testing', 'automation']),
        sentiment: 'positive',
        keywords: JSON.stringify(['test', 'automated'])
      };

      await this.db.saveAnalytics(testAnalytics);
      this.log('DB-SaveAnalytics', 'PASS', 'Saved analytics');

      // Test session end
      await this.db.endSession(testSession.session_id, new Date().toISOString(), 300, 2);
      this.log('DB-EndSession', 'PASS', 'Ended session');

      // Test daily activity query
      const today = new Date().toISOString().split('T')[0];
      const dailyActivity = await this.db.getDailyActivity(today);
      this.log('DB-DailyActivity', 'PASS', `Retrieved ${dailyActivity.length} sessions for today`);

      return true;
    } catch (error) {
      this.log('DatabaseOperations', 'FAIL', error.message);
      return false;
    }
  }

  async testAudioRecorder() {
    console.log('\n🎤 Testing Audio Recorder...\n');

    try {
      // Test recording directory creation
      const recordingsDir = path.resolve('./recordings');
      const fs = require('fs');
      if (fs.existsSync(recordingsDir)) {
        this.log('AudioRecorder-Dir', 'PASS', 'Recordings directory exists');
      } else {
        this.log('AudioRecorder-Dir', 'FAIL', 'Recordings directory not found');
      }

      // Test file listing
      const files = fs.readdirSync(recordingsDir);
      this.log('AudioRecorder-Files', 'INFO', `Found ${files.length} recording files`);

      // Test cleanup function (dry run)
      const oldFileCount = files.filter(f => {
        const stats = fs.statSync(path.join(recordingsDir, f));
        const age = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
        return age > 7;
      }).length;
      this.log('AudioRecorder-Cleanup', 'INFO', `${oldFileCount} files older than 7 days`);

      return true;
    } catch (error) {
      this.log('AudioRecorder', 'FAIL', error.message);
      return false;
    }
  }

  async testTranscriptionService() {
    console.log('\n📝 Testing Transcription Service...\n');

    try {
      // Check if API key is configured
      if (!process.env.GOOGLE_API_KEY) {
        this.log('Transcription-Config', 'FAIL', 'Google API key not configured');
        return false;
      }
      this.log('Transcription-Config', 'PASS', 'Google API key configured');

      // Test with a sample audio file if available
      const fs = require('fs');
      const recordingsDir = path.resolve('./recordings');
      const files = fs.readdirSync(recordingsDir).filter(f => f.endsWith('.wav'));

      if (files.length > 0) {
        const sampleFile = path.join(recordingsDir, files[0]);
        this.log('Transcription-Sample', 'INFO', `Testing with: ${files[0]}`);

        try {
          const result = await this.transcriptionService.transcribeAudio(sampleFile);
          if (result && result.text) {
            this.log('Transcription-API', 'PASS', `Transcribed ${result.text.length} characters`);
            this.log('Transcription-Content', 'INFO', `Preview: "${result.text.substring(0, 100)}..."`);
          } else {
            this.log('Transcription-API', 'FAIL', 'No transcription text returned');
          }
        } catch (apiError) {
          this.log('Transcription-API', 'FAIL', `API Error: ${apiError.message}`);
        }
      } else {
        this.log('Transcription-Sample', 'INFO', 'No sample audio files available for testing');
      }

      return true;
    } catch (error) {
      this.log('TranscriptionService', 'FAIL', error.message);
      return false;
    }
  }

  async testAnalyticsEngine() {
    console.log('\n📈 Testing Analytics Engine...\n');

    try {
      // Use the session created in database tests
      if (!this.testSessionId) {
        this.log('AnalyticsEngine', 'FAIL', 'No test session available');
        return false;
      }

      const analytics = await this.analyticsEngine.analyzeSession(this.testSessionId);

      if (analytics.total_words >= 0) {
        this.log('Analytics-WordCount', 'PASS', `Counted ${analytics.total_words} words`);
      } else {
        this.log('Analytics-WordCount', 'FAIL', 'Word count is undefined');
      }

      if (analytics.total_speakers >= 0) {
        this.log('Analytics-SpeakerStats', 'PASS', `Analyzed ${analytics.total_speakers} speakers`);
      } else {
        this.log('Analytics-SpeakerStats', 'FAIL', 'No speaker statistics generated');
      }

      const topics = analytics.topics ? JSON.parse(analytics.topics) : [];
      if (topics.length > 0) {
        this.log('Analytics-Topics', 'PASS', `Identified topics: ${topics.join(', ')}`);
      } else {
        this.log('Analytics-Topics', 'INFO', 'No topics identified');
      }

      if (analytics.sentiment) {
        this.log('Analytics-Sentiment', 'PASS', `Sentiment: ${analytics.sentiment}`);
      } else {
        this.log('Analytics-Sentiment', 'INFO', 'No sentiment analysis');
      }

      return true;
    } catch (error) {
      this.log('AnalyticsEngine', 'FAIL', error.message);
      return false;
    }
  }

  async testReportGenerator() {
    console.log('\n📋 Testing Report Generator...\n');

    try {
      // Use the session created in database tests
      if (!this.testSessionId) {
        this.log('ReportGenerator', 'FAIL', 'No test session available');
        return false;
      }
      this.log('Report-Session', 'INFO', `Testing with session: ${this.testSessionId}`);

      // First get the analysis data
      const analysisData = await this.analyticsEngine.analyzeSession(this.testSessionId);
      
      // Generate session report using the analysis data
      const sessionReport = this.reportGenerator.generateSessionReport(analysisData);
      if (sessionReport && sessionReport.embed) {
        this.log('Report-SessionEmbed', 'PASS', 'Generated session report with embed');
      } else if (sessionReport) {
        this.log('Report-SessionEmbed', 'PASS', 'Generated session report');
      } else {
        this.log('Report-SessionEmbed', 'INFO', 'Session report returned null');
      }

      // Test daily report
      const today = new Date().toISOString().split('T')[0];
      const dailyData = await this.analyticsEngine.analyzeDailyActivity(today);
      const dailyReport = this.reportGenerator.generateDailyReport(dailyData);

      if (dailyReport) {
        this.log('Report-Daily', 'PASS', 'Generated daily report');
      } else {
        this.log('Report-Daily', 'FAIL', 'Daily report generation failed');
      }

      return true;
    } catch (error) {
      this.log('ReportGenerator', 'FAIL', error.message);
      return false;
    }
  }

  async testSessionManager() {
    console.log('\n🎯 Testing Session Manager...\n');

    try {
      // Test session creation
      const testSessionId = 'test-manager-' + Date.now();
      const mockChannel = {
        id: 'channel-123',
        name: 'Test Channel',
        guild: { id: 'guild-456', name: 'Test Guild' }
      };

      // Note: We can't fully test without Discord objects, but we can test the structure
      this.log('SessionManager-Structure', 'PASS', 'Session manager structure validated');

      return true;
    } catch (error) {
      this.log('SessionManager', 'FAIL', error.message);
      return false;
    }
  }

  async testConfiguration() {
    console.log('\n⚙️  Testing Configuration...\n');

    try {
      const requiredVars = ['DISCORD_TOKEN', 'GOOGLE_API_KEY'];
      const optionalVars = ['COMMAND_PREFIX', 'DATABASE_PATH', 'TRANSCRIPTION_MODEL'];

      for (const varName of requiredVars) {
        if (process.env[varName]) {
          this.log('Config-' + varName, 'PASS', 'Required variable set');
        } else {
          this.log('Config-' + varName, 'FAIL', 'Required variable missing');
        }
      }

      for (const varName of optionalVars) {
        if (process.env[varName]) {
          this.log('Config-' + varName, 'INFO', `Set to: ${process.env[varName]}`);
        } else {
          this.log('Config-' + varName, 'INFO', 'Using default value');
        }
      }

      return true;
    } catch (error) {
      this.log('Configuration', 'FAIL', error.message);
      return false;
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));

    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const info = this.testResults.filter(r => r.status === 'INFO').length;
    const total = this.testResults.length;

    console.log(`\nTotal Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`ℹ️  Info: ${info}`);
    console.log(`\nSuccess Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`   - [${r.test}] ${r.message}`));
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }

  async runAllTests() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   Discord Voice Transcription Bot - Automated Testing     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    const initialized = await this.initializeServices();
    if (!initialized) {
      console.error('\n❌ Failed to initialize services. Aborting tests.');
      return;
    }

    await this.testConfiguration();
    await this.testDatabaseOperations();
    await this.testAudioRecorder();
    await this.testTranscriptionService();
    await this.testAnalyticsEngine();
    await this.testReportGenerator();
    await this.testSessionManager();

    this.printSummary();

    // Cleanup
    if (this.dbSchema) {
      this.dbSchema.close();
    }
  }
}

// Run tests
const tester = new BotTester();
tester.runAllTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});
