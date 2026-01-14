const { PermissionFlagsBits } = require('discord.js');

class CommandHandler {
  constructor(voiceHandler, sessionManager, reportGenerator, analyticsEngine, dbQueries) {
    this.voiceHandler = voiceHandler;
    this.sessionManager = sessionManager;
    this.reportGenerator = reportGenerator;
    this.analyticsEngine = analyticsEngine;
    this.db = dbQueries;
    this.prefix = process.env.COMMAND_PREFIX || '!';
  }

  async handleCommand(message) {
    if (!message.content.startsWith(this.prefix)) return;
    if (message.author.bot) return;

    const args = message.content.slice(this.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    try {
      switch (command) {
        case 'join':
          await this.joinCommand(message);
          break;
        case 'leave':
          await this.leaveCommand(message);
          break;
        case 'status':
          await this.statusCommand(message);
          break;
        case 'report':
          await this.reportCommand(message, args);
          break;
        case 'daily':
          await this.dailyReportCommand(message, args);
          break;
        case 'help':
          await this.helpCommand(message);
          break;
        default:
          // Unknown command, ignore
          break;
      }
    } catch (error) {
      console.error('Error handling command:', error);
      await message.reply(`❌ Error: ${error.message}`);
    }
  }

  async joinCommand(message) {
    const voiceChannel = message.member.voice.channel;

    if (!voiceChannel) {
      return message.reply('❌ You need to be in a voice channel first!');
    }

    if (this.voiceHandler.hasConnection(voiceChannel.id)) {
      return message.reply('✅ Already recording in this channel!');
    }

    await this.voiceHandler.joinChannel(voiceChannel, message.guild);
    await message.reply(`✅ Joined ${voiceChannel.name} and started recording!`);
  }

  async leaveCommand(message) {
    // Check if user has permission
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return message.reply('❌ You need "Manage Channels" permission to use this command.');
    }

    const voiceChannel = message.member.voice.channel;

    if (!voiceChannel) {
      // Try to find any active connection in this guild
      const connections = this.voiceHandler.getAllConnections()
        .filter(c => c.guild.id === message.guild.id);

      if (connections.length === 0) {
        return message.reply('❌ Not currently recording in any channel!');
      }

      // Leave the first connection found
      const sessionId = await this.voiceHandler.leaveChannel(connections[0].channel.id);
      await message.reply('✅ Left the voice channel and stopped recording!');

      // Generate and send report
      const report = await this.sessionManager.generateSessionReport(sessionId, message.channel);
      if (report) {
        await this.sendReport(message.channel, report);
      }

      return;
    }

    if (!this.voiceHandler.hasConnection(voiceChannel.id)) {
      return message.reply('❌ Not currently recording in your voice channel!');
    }

    const sessionId = await this.voiceHandler.leaveChannel(voiceChannel.id);
    await message.reply('✅ Left the voice channel and stopped recording!');

    // Generate and send report
    const report = await this.sessionManager.generateSessionReport(sessionId, message.channel);
    if (report) {
      await this.sendReport(message.channel, report);
    }
  }

  async statusCommand(message) {
    const connections = this.voiceHandler.getAllConnections()
      .filter(c => c.guild.id === message.guild.id);

    if (connections.length === 0) {
      return message.reply('📊 Not currently recording in any channels.');
    }

    const statusMessages = connections.map(c => {
      const session = this.sessionManager.getActiveSession(c.channel.id);
      const duration = Math.floor((Date.now() / 1000) - session.start_time);
      const participants = session.participants.size;

      return `🎙️ **${c.channel.name}**\n` +
             `⏱️ Duration: ${this.formatDuration(duration)}\n` +
             `👥 Participants: ${participants}`;
    });

    await message.reply({
      embeds: [{
        color: 0x0099FF,
        title: '📊 Recording Status',
        description: statusMessages.join('\n\n'),
        timestamp: new Date()
      }]
    });
  }

  async reportCommand(message, args) {
    const sessionId = args[0];

    if (!sessionId) {
      return message.reply('❌ Please provide a session ID. Usage: `!report <session_id>`');
    }

    const session = this.db.findSessionById(sessionId);
    if (!session) {
      return message.reply('❌ Session not found!');
    }

    const report = await this.sessionManager.generateSessionReport(sessionId, message.channel);
    if (report) {
      await this.sendReport(message.channel, report);
    } else {
      await message.reply('❌ Could not generate report for this session.');
    }
  }

  async dailyReportCommand(message, args) {
    const date = args[0] || new Date().toISOString().split('T')[0];

    const dailyData = await this.analyticsEngine.analyzeDailyActivity(date);
    const reportEmbed = this.reportGenerator.generateDailyReport(dailyData);

    await message.channel.send({ embeds: [reportEmbed] });
  }

  async helpCommand(message) {
    const helpEmbed = {
      color: 0x0099FF,
      title: '🤖 Voice Transcription Bot - Help',
      description: 'A bot that records voice channels, transcribes conversations, and provides analytics.',
      fields: [
        {
          name: `${this.prefix}join`,
          value: 'Join your current voice channel and start recording'
        },
        {
          name: `${this.prefix}leave`,
          value: 'Leave the voice channel and stop recording (requires Manage Channels permission)'
        },
        {
          name: `${this.prefix}status`,
          value: 'Show current recording status'
        },
        {
          name: `${this.prefix}report <session_id>`,
          value: 'Generate a report for a specific session'
        },
        {
          name: `${this.prefix}daily [YYYY-MM-DD]`,
          value: 'Generate a daily activity report (defaults to today)'
        },
        {
          name: `${this.prefix}help`,
          value: 'Show this help message'
        }
      ],
      footer: {
        text: 'The bot automatically records when it joins a voice channel'
      },
      timestamp: new Date()
    };

    await message.reply({ embeds: [helpEmbed] });
  }

  async sendReport(channel, report) {
    try {
      // Send the report embed
      await channel.send({ embeds: [report.embed] });

      // Split and send transcript if it exists
      if (report.transcript) {
        const chunks = this.reportGenerator.splitTranscript(report.transcript);

        for (let i = 0; i < chunks.length; i++) {
          // Use code blocks for better formatting
          const formattedChunk = `\`\`\`${chunks[i]}\`\`\``;

          // Discord has a 2000 character limit
          if (formattedChunk.length <= 2000) {
            await channel.send(formattedChunk);
          } else {
            // If still too long, send without code blocks
            await channel.send(chunks[i]);
          }

          // Small delay between messages to avoid rate limiting
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      // Save report to database
      const reportId = this.generateReportId();
      await this.reportGenerator.saveReport(
        'session',
        reportId,
        report.analysisData.session.session_id,
        report.embed,
        channel.id
      );
    } catch (error) {
      console.error('Error sending report:', error);
      await channel.send('❌ Error sending full report. Please check logs.');
    }
  }

  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }

  generateReportId() {
    if (typeof require('crypto').randomUUID === 'function') {
      return require('crypto').randomUUID();
    } else {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  }
}

module.exports = CommandHandler;
