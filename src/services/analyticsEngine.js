class AnalyticsEngine {
  constructor(dbQueries) {
    this.db = dbQueries;
  }

  async analyzeSession(sessionId) {
    try {
      console.log(`📊 Analyzing session: ${sessionId}`);

      const session = this.db.findSessionById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const transcriptions = this.db.getTranscriptions(sessionId);
      const participants = this.db.getParticipants(sessionId);

      // Calculate basic statistics
      const totalWords = transcriptions.reduce((sum, t) => sum + (t.word_count || 0), 0);
      const totalSpeakers = new Set(transcriptions.map(t => t.user_id)).size;

      // Find most active speaker
      const speakerStats = this.calculateSpeakerStats(transcriptions);
      const mostActiveSpeaker = speakerStats.mostActive;

      // Calculate average speaking duration
      const avgSpeakingDuration = participants.length > 0
        ? participants.reduce((sum, p) => sum + (p.duration || 0), 0) / participants.length
        : 0;

      // Extract keywords and topics
      const keywords = this.extractKeywords(transcriptions);
      const topics = this.identifyTopics(transcriptions);

      // Analyze sentiment
      const sentiment = this.analyzeSentiment(transcriptions);

      const analytics = {
        session_id: sessionId,
        total_words: totalWords,
        total_speakers: totalSpeakers,
        most_active_speaker: mostActiveSpeaker.username,
        most_active_speaker_count: mostActiveSpeaker.count,
        avg_speaking_duration: avgSpeakingDuration,
        topics: JSON.stringify(topics),
        sentiment: sentiment,
        keywords: JSON.stringify(keywords)
      };

      // Save analytics to database
      this.db.saveAnalytics(analytics);

      console.log(`✅ Session analysis complete`);

      return {
        ...analytics,
        session,
        transcriptions,
        participants,
        speakerStats: speakerStats.all
      };
    } catch (error) {
      console.error('Error analyzing session:', error);
      throw error;
    }
  }

  calculateSpeakerStats(transcriptions) {
    const stats = {};

    transcriptions.forEach(t => {
      if (!stats[t.user_id]) {
        stats[t.user_id] = {
          userId: t.user_id,
          username: t.username,
          wordCount: 0,
          messageCount: 0,
          totalDuration: 0
        };
      }

      stats[t.user_id].wordCount += t.word_count || 0;
      stats[t.user_id].messageCount += 1;
      stats[t.user_id].totalDuration += t.duration || 0;
    });

    const speakerArray = Object.values(stats);
    const mostActive = speakerArray.reduce((max, speaker) =>
      speaker.wordCount > (max.wordCount || 0) ? speaker : max,
      { username: 'N/A', count: 0, wordCount: 0 }
    );

    return {
      all: speakerArray,
      mostActive: {
        username: mostActive.username,
        count: mostActive.wordCount
      }
    };
  }

  extractKeywords(transcriptions) {
    // Combine all transcripts
    const allText = transcriptions.map(t => t.transcript).join(' ').toLowerCase();

    // Remove common stop words
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with',
      'to', 'for', 'of', 'as', 'by', 'that', 'this', 'it', 'from', 'be', 'are', 'was',
      'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'can', 'i', 'you', 'he', 'she', 'we', 'they',
      'what', 'when', 'where', 'who', 'why', 'how', 'um', 'uh', 'yeah', 'yes', 'no'
    ]);

    // Extract words
    const words = allText.match(/\b[a-z]{3,}\b/g) || [];

    // Count word frequencies
    const wordFreq = {};
    words.forEach(word => {
      if (!stopWords.has(word)) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });

    // Get top 10 keywords
    const keywords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    return keywords;
  }

  identifyTopics(transcriptions) {
    // Simple topic identification based on keywords
    const allText = transcriptions.map(t => t.transcript).join(' ').toLowerCase();

    const topicKeywords = {
      'Technology': ['software', 'code', 'program', 'computer', 'app', 'website', 'tech', 'digital', 'api', 'database'],
      'Business': ['meeting', 'project', 'deadline', 'client', 'revenue', 'sales', 'marketing', 'budget', 'strategy'],
      'Gaming': ['game', 'play', 'player', 'level', 'score', 'match', 'team', 'win', 'lose'],
      'Education': ['learn', 'study', 'class', 'school', 'teach', 'student', 'course', 'assignment', 'exam'],
      'Entertainment': ['movie', 'music', 'show', 'watch', 'listen', 'video', 'stream', 'episode', 'series'],
      'Social': ['friend', 'chat', 'talk', 'hang', 'party', 'event', 'meet', 'social']
    };

    const topicScores = {};

    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      let score = 0;
      keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = allText.match(regex);
        score += matches ? matches.length : 0;
      });
      if (score > 0) {
        topicScores[topic] = score;
      }
    });

    // Get top 3 topics
    const topics = Object.entries(topicScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([topic, score]) => ({ topic, score }));

    return topics.length > 0 ? topics : [{ topic: 'General Discussion', score: 1 }];
  }

  analyzeSentiment(transcriptions) {
    // Simple sentiment analysis based on keywords
    const allText = transcriptions.map(t => t.transcript).join(' ').toLowerCase();

    const positiveWords = [
      'good', 'great', 'excellent', 'amazing', 'awesome', 'love', 'like', 'happy',
      'fantastic', 'wonderful', 'best', 'perfect', 'nice', 'cool', 'fun', 'enjoyed'
    ];

    const negativeWords = [
      'bad', 'terrible', 'awful', 'hate', 'dislike', 'sad', 'angry', 'worst',
      'poor', 'horrible', 'disappointing', 'frustrating', 'annoying', 'difficult'
    ];

    let positiveCount = 0;
    let negativeCount = 0;

    positiveWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = allText.match(regex);
      positiveCount += matches ? matches.length : 0;
    });

    negativeWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = allText.match(regex);
      negativeCount += matches ? matches.length : 0;
    });

    const total = positiveCount + negativeCount;
    if (total === 0) return 'Neutral';

    const ratio = positiveCount / total;
    if (ratio > 0.6) return 'Positive';
    if (ratio < 0.4) return 'Negative';
    return 'Neutral';
  }

  async analyzeDailyActivity(date) {
    try {
      console.log(`📊 Analyzing daily activity for: ${date}`);

      const stats = this.db.getDailyStats(date);

      // Get all sessions for the day
      const startOfDay = Math.floor(new Date(date).setHours(0, 0, 0, 0) / 1000);
      const endOfDay = Math.floor(new Date(date).setHours(23, 59, 59, 999) / 1000);

      const transcriptions = this.db.getTranscriptionsByDate(startOfDay, endOfDay);

      // Group by guild
      const guildActivity = {};
      transcriptions.forEach(t => {
        if (!guildActivity[t.guild_id]) {
          guildActivity[t.guild_id] = {
            transcriptionCount: 0,
            wordCount: 0,
            speakers: new Set()
          };
        }
        guildActivity[t.guild_id].transcriptionCount++;
        guildActivity[t.guild_id].wordCount += t.word_count || 0;
        guildActivity[t.guild_id].speakers.add(t.user_id);
      });

      return {
        date,
        stats,
        guildActivity: Object.entries(guildActivity).map(([guildId, data]) => ({
          guildId,
          transcriptionCount: data.transcriptionCount,
          wordCount: data.wordCount,
          uniqueSpeakers: data.speakers.size
        })),
        transcriptions
      };
    } catch (error) {
      console.error('Error analyzing daily activity:', error);
      throw error;
    }
  }
}

module.exports = AnalyticsEngine;
