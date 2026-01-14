require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const path = require('path');
const cron = require('node-cron');

// Database
const DatabaseSchema = require('./database/schema');
const DatabaseQueries = require('./database/queries');

// Services
const AudioRecorder = require('./services/audioRecorder');
const TranscriptionService = require('./services/transcriptionService');
const AnalyticsEngine = require('./services/analyticsEngine');
const ReportGenerator = require('./services/reportGenerator');
const SessionManager = require('./services/sessionManager');
const VoiceConnectionHandler = require('./services/voiceConnectionHandler');

// Commands
const CommandHandler = require('./commands/commandHandler');

class VoiceTranscriptionBot {
  constructor() {
    this.dbSchema = null;
    this.db = null;
  }

  validateConfig() {
    const required = ['DISCORD_TOKEN', 'GOOGLE_API_KEY'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:', missing.join(', '));
      console.error('Please create a .env file based on .env.example');
      process.exit(1);
    }

    console.log('✅ Configuration validated');
  }

  async initializeDatabase() {
    const dbPath = path.resolve(process.env.DATABASE_PATH || './data/transcriptions.db');
    console.log('📂 Database path:', dbPath);

    this.dbSchema = new DatabaseSchema();
    await this.dbSchema.initialize(dbPath);
    this.db = new DatabaseQueries(this.dbSchema.getDatabase(), () => this.dbSchema.save());

    console.log('✅ Database initialized');
  }

  initializeServices() {
    // Initialize all services
    this.audioRecorder = new AudioRecorder();
    this.transcriptionService = new TranscriptionService(process.env.GOOGLE_API_KEY);
    this.analyticsEngine = new AnalyticsEngine(this.db);
    this.reportGenerator = new ReportGenerator(this.db);

    this.sessionManager = new SessionManager(
      this.db,
      this.audioRecorder,
      this.transcriptionService,
      this.analyticsEngine,
      this.reportGenerator
    );

    this.voiceHandler = new VoiceConnectionHandler(
      this.sessionManager,
      this.audioRecorder
    );

    // Listen for session end to generate report
    this.voiceHandler.on('sessionEnded', async ({ sessionId, channel, guild }) => {
      console.log(`📊 Generating report for session ${sessionId}...`);
      try {
        const report = await this.sessionManager.generateSessionReport(sessionId, channel);
        if (report) {
          // Find text channel to send report
          let targetChannel = null;
          if (process.env.REPORT_CHANNEL_ID) {
            targetChannel = guild.channels.cache.get(process.env.REPORT_CHANNEL_ID);
          }
          if (!targetChannel) {
            // Try to send to the text channel where the voice channel is (if it has one?) 
            // Or just a guess based on name
            targetChannel = guild.channels.cache.find(
              ch => ch.isTextBased() &&
                (ch.name === channel.name || ch.name.includes('general') || ch.name.includes('transcripts')) &&
                ch.permissionsFor(guild.members.me).has('SendMessages')
            );
          }
          if (!targetChannel) {
            targetChannel = guild.systemChannel;
          }

          if (targetChannel) {
            await targetChannel.send({
              content: `📝 **Meeting Report: ${channel.name}**`,
              embeds: [report.embed]
            });

            if (report.transcript && report.transcript.length > 0) {
              // Send transcript as file if too long, or message
              if (report.transcript.length > 1900) {
                const buffer = Buffer.from(report.transcript, 'utf-8');
                await targetChannel.send({
                  files: [{ attachment: buffer, name: `transcript-${sessionId}.txt` }]
                });
              } else {
                await targetChannel.send(`\`\`\`\n${report.transcript}\n\`\`\``);
              }
            }
            console.log(`✅ Sent report to #${targetChannel.name}`);
          } else {
            console.warn('⚠️ Could not find a text channel to send the report');
          }
        }
      } catch (error) {
        console.error('Error generating/sending session report:', error);
      }
    });

    this.commandHandler = new CommandHandler(
      this.voiceHandler,
      this.sessionManager,
      this.reportGenerator,
      this.analyticsEngine,
      this.db
    );

    console.log('✅ Services initialized');
  }

  initializeClient() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
      ]
    });

    console.log('✅ Discord client initialized');
  }

  setupEventHandlers() {
    // Bot ready
    this.client.once(Events.ClientReady, () => {
      console.log('');
      console.log('🤖 ═══════════════════════════════════════════════════');
      console.log(`✅ Bot is ready! Logged in as ${this.client.user.tag}`);
      console.log('🎙️  Voice transcription and analytics enabled');
      console.log('═══════════════════════════════════════════════════');
      console.log('');

      this.client.user.setActivity('voice channels | !help', { type: 'LISTENING' });

      // Cleanup old recordings on startup
      this.audioRecorder.cleanupOldRecordings(7);
    });

    // Message handling
    this.client.on(Events.MessageCreate, async (message) => {
      await this.commandHandler.handleCommand(message);
    });

    // Voice state updates
    this.client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
      await this.handleVoiceStateUpdate(oldState, newState);
    });

    // Error handling
    this.client.on('error', (error) => {
      console.error('Discord client error:', error);
    });

    this.client.on('warn', (warning) => {
      console.warn('Discord client warning:', warning);
    });

    // Graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  async handleVoiceStateUpdate(oldState, newState) {
    try {
      const member = newState.member;
      if (!member || member.user.bot) return;

      // User joined a voice channel
      if (!oldState.channel && newState.channel) {
        // Auto-join: If bot is NOT in this channel, join it automatically
        if (!this.voiceHandler.hasConnection(newState.channel.id)) {
          console.log(`🎙️  Auto-joining voice channel: ${newState.channel.name}`);
          try {
            await this.voiceHandler.joinChannel(newState.channel, newState.guild);
            // Find a text channel to send notification
            const textChannel = newState.guild.channels.cache.find(
              ch => ch.isTextBased() && ch.permissionsFor(newState.guild.members.me).has('SendMessages')
            );
            if (textChannel) {
              await textChannel.send(`🎙️ Auto-joined **${newState.channel.name}** - Recording started!`);
            }
          } catch (error) {
            console.error('Error auto-joining channel:', error);
          }
        } else {
          // Bot already in channel, just handle the user join
          await this.voiceHandler.handleUserJoin(member, newState.channel);
        }
      }

      // User left a voice channel
      if (oldState.channel && !newState.channel) {
        if (this.voiceHandler.hasConnection(oldState.channel.id)) {
          await this.voiceHandler.handleUserLeave(member, oldState.channel);
        }
      }

      // User switched channels
      if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
        // Left old channel
        if (this.voiceHandler.hasConnection(oldState.channel.id)) {
          await this.voiceHandler.handleUserLeave(member, oldState.channel);
        }

        // Joined new channel - auto-join if not already there
        if (!this.voiceHandler.hasConnection(newState.channel.id)) {
          console.log(`🎙️  Auto-joining voice channel: ${newState.channel.name}`);
          try {
            await this.voiceHandler.joinChannel(newState.channel, newState.guild);
            const textChannel = newState.guild.channels.cache.find(
              ch => ch.isTextBased() && ch.permissionsFor(newState.guild.members.me).has('SendMessages')
            );
            if (textChannel) {
              await textChannel.send(`🎙️ Auto-joined **${newState.channel.name}** - Recording started!`);
            }
          } catch (error) {
            console.error('Error auto-joining channel:', error);
          }
        } else {
          await this.voiceHandler.handleUserJoin(member, newState.channel);
        }
      }
    } catch (error) {
      console.error('Error handling voice state update:', error);
    }
  }

  setupCronJobs() {
    // Daily report generation
    const dailyReportTime = process.env.DAILY_REPORT_TIME || '23:00';
    const [hour, minute] = dailyReportTime.split(':');

    // Schedule daily report at specified time
    cron.schedule(`${minute} ${hour} * * *`, async () => {
      console.log('📅 Generating daily reports...');
      await this.generateDailyReports();
    });

    console.log(`✅ Scheduled daily reports at ${dailyReportTime}`);

    // Weekly cleanup of old recordings
    cron.schedule('0 0 * * 0', () => {
      console.log('🗑️  Running weekly cleanup of old recordings...');
      this.audioRecorder.cleanupOldRecordings(7);
    });

    console.log('✅ Scheduled weekly cleanup');
  }

  async generateDailyReports() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const dailyData = await this.analyticsEngine.analyzeDailyActivity(dateStr);

      if (dailyData.stats.sessions === 0) {
        console.log('No activity to report for', dateStr);
        return;
      }

      const reportEmbed = this.reportGenerator.generateDailyReport(dailyData);

      // Send to configured report channel or guild owners
      for (const guild of this.client.guilds.cache.values()) {
        try {
          let targetChannel = null;

          // Try to find the configured report channel
          if (process.env.REPORT_CHANNEL_ID) {
            targetChannel = guild.channels.cache.get(process.env.REPORT_CHANNEL_ID);
          }

          // If not found, try to find a general/announcements channel
          if (!targetChannel) {
            targetChannel = guild.channels.cache.find(
              ch => ch.name.includes('general') || ch.name.includes('announcements')
            );
          }

          // If still not found, use system channel
          if (!targetChannel) {
            targetChannel = guild.systemChannel;
          }

          if (targetChannel && targetChannel.isTextBased()) {
            await targetChannel.send({ embeds: [reportEmbed] });
            console.log(`✅ Sent daily report to ${guild.name}`);
          }
        } catch (error) {
          console.error(`Error sending daily report to guild ${guild.name}:`, error);
        }
      }
    } catch (error) {
      console.error('Error generating daily reports:', error);
    }
  }

  async shutdown() {
    console.log('\n🛑 Shutting down gracefully...');

    try {
      // End all active sessions
      const connections = this.voiceHandler.getAllConnections();
      for (const conn of connections) {
        await this.voiceHandler.leaveChannel(conn.channel.id);
      }

      // Save and close database
      if (this.dbSchema) {
        this.dbSchema.close();
      }

      // Disconnect from Discord
      this.client.destroy();

      console.log('✅ Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  async start() {
    console.log('🚀 Starting Voice Transcription Bot...');

    this.validateConfig();
    await this.initializeDatabase();
    this.initializeServices();
    this.initializeClient();
    this.setupEventHandlers();
    this.setupCronJobs();

    this.client.login(process.env.DISCORD_TOKEN);
  }
}

// Start the bot
const bot = new VoiceTranscriptionBot();
bot.start().catch(error => {
  console.error('❌ Failed to start bot:', error);
  process.exit(1);
});

module.exports = VoiceTranscriptionBot;
