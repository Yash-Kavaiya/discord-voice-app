const { EmbedBuilder } = require('discord.js');

class ReportGenerator {
  constructor(dbQueries) {
    this.db = dbQueries;
  }

  generateSessionReport(analysisData) {
    const { session, transcriptions, participants, speakerStats, topics, sentiment, keywords } = analysisData;

    // Create Discord embed
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📊 Voice Session Report')
      .setDescription(`Session ended in **${session.channel_name}**`)
      .addFields(
        {
          name: '⏱️ Duration',
          value: this.formatDuration(session.duration),
          inline: true
        },
        {
          name: '👥 Participants',
          value: `${session.participant_count} people`,
          inline: true
        },
        {
          name: '💬 Total Words',
          value: `${analysisData.total_words.toLocaleString()}`,
          inline: true
        }
      )
      .setTimestamp(session.start_time * 1000);

    // Add speaker statistics
    if (speakerStats && speakerStats.length > 0) {
      const topSpeakers = speakerStats
        .sort((a, b) => b.wordCount - a.wordCount)
        .slice(0, 5)
        .map((s, i) => `${i + 1}. **${s.username}**: ${s.wordCount} words (${s.messageCount} segments)`)
        .join('\n');

      embed.addFields({
        name: '🎤 Top Speakers',
        value: topSpeakers || 'No speakers'
      });
    }

    // Add topics
    const topicsData = typeof topics === 'string' ? JSON.parse(topics) : topics;
    if (topicsData && topicsData.length > 0) {
      const topicsText = topicsData
        .map(t => `• ${t.topic} (${t.score} mentions)`)
        .join('\n');

      embed.addFields({
        name: '📚 Discussion Topics',
        value: topicsText
      });
    }

    // Add sentiment
    const sentimentEmoji = {
      'Positive': '😊',
      'Neutral': '😐',
      'Negative': '😟'
    };

    embed.addFields({
      name: '🎭 Overall Sentiment',
      value: `${sentimentEmoji[sentiment] || '😐'} ${sentiment}`,
      inline: true
    });

    // Add session info
    embed.setFooter({
      text: `Session ID: ${session.session_id}`
    });

    return embed;
  }

  generateTranscriptText(transcriptions) {
    if (!transcriptions || transcriptions.length === 0) {
      return '> No transcriptions available for this session.';
    }

    let transcript = '# 📝 Session Transcript\n\n';

    transcriptions.forEach((t, index) => {
      const timestamp = new Date(t.timestamp * 1000).toLocaleTimeString();
      transcript += `**[${timestamp}] ${t.username}:**\n${t.transcript}\n\n`;
    });

    return transcript;
  }

  generateDailyReport(dailyData) {
    const { date, stats, guildActivity } = dailyData;

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('📅 Daily Activity Report')
      .setDescription(`Report for **${new Date(date).toLocaleDateString()}**`)
      .addFields(
        {
          name: '🎙️ Total Sessions',
          value: stats.sessions.toString(),
          inline: true
        },
        {
          name: '⏱️ Total Duration',
          value: this.formatDuration(stats.totalDuration),
          inline: true
        },
        {
          name: '💬 Total Words',
          value: stats.totalWords.toLocaleString(),
          inline: true
        },
        {
          name: '📊 Transcriptions',
          value: stats.transcriptions.toString(),
          inline: true
        },
        {
          name: '👥 Unique Speakers',
          value: stats.uniqueSpeakers.toString(),
          inline: true
        },
        {
          name: '📈 Avg Words/Session',
          value: stats.sessions > 0
            ? Math.round(stats.totalWords / stats.sessions).toLocaleString()
            : '0',
          inline: true
        }
      )
      .setTimestamp();

    // Add guild-specific activity
    if (guildActivity && guildActivity.length > 0) {
      const guildText = guildActivity
        .map(g => `• **Guild ${g.guildId.slice(0, 8)}...**: ${g.transcriptionCount} transcriptions, ${g.wordCount} words`)
        .join('\n');

      embed.addFields({
        name: '🏰 Server Activity',
        value: guildText
      });
    }

    return embed;
  }

  async saveReport(reportType, reportId, sessionId, embed, channelId) {
    const reportData = {
      report_id: reportId,
      session_id: sessionId,
      report_type: reportType,
      report_date: new Date().toISOString().split('T')[0],
      content: JSON.stringify(embed.toJSON()),
      sent_to_channel_id: channelId
    };

    this.db.saveReport(reportData);
  }

  formatDuration(seconds) {
    if (!seconds || seconds < 0) return '0s';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }

  splitTranscript(transcript, maxLength = 2000) {
    // Split long transcripts into chunks for Discord's message limit
    const chunks = [];
    const lines = transcript.split('\n');

    let currentChunk = '';

    for (const line of lines) {
      if ((currentChunk + line + '\n').length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = '';
        }

        // If a single line is too long, split it
        if (line.length > maxLength) {
          for (let i = 0; i < line.length; i += maxLength) {
            chunks.push(line.slice(i, i + maxLength));
          }
        } else {
          currentChunk = line + '\n';
        }
      } else {
        currentChunk += line + '\n';
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }
}

module.exports = ReportGenerator;
