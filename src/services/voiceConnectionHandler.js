const {
  joinVoiceChannel,
  EndBehaviorType,
  VoiceConnectionStatus,
  getVoiceConnection,
  entersState
} = require('@discordjs/voice');
const prism = require('prism-media');

const { EventEmitter } = require('events');

class VoiceConnectionHandler extends EventEmitter {
  constructor(sessionManager, audioRecorder) {
    super();
    this.sessionManager = sessionManager;
    this.audioRecorder = audioRecorder;
    this.connections = new Map(); // channelId -> connection
    this.receivers = new Map(); // channelId -> receiver
  }

  async joinChannel(channel, guild) {
    try {
      console.log(`🎙️  Joining voice channel: ${channel.name}`);

      // Check if already connected
      if (this.connections.has(channel.id)) {
        console.log('Already connected to this channel');
        return this.connections.get(channel.id);
      }

      // Join the voice channel
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: true
      });

      // Wait for the connection to be ready
      await entersState(connection, VoiceConnectionStatus.Ready, 30000);

      // Create session
      const sessionId = this.sessionManager.createSession(channel, guild);

      // Store connection
      this.connections.set(channel.id, {
        connection,
        sessionId,
        channel,
        guild
      });

      // Set up audio receiving
      this.setupAudioReceiver(connection, channel, sessionId);

      // Add existing participants
      channel.members.forEach(member => {
        if (!member.user.bot) {
          this.sessionManager.addParticipant(sessionId, member.user, channel.id);
        }
      });

      // Add error handling listeners
      connection.on('error', (error) => {
        console.error('❌ Voice Connection Error:', error);
        this.leaveChannel(channel.id).catch(console.error);
      });

      connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
        console.warn('⚠️ Connection disconnected. Attempting to reconnect...');
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5000),
          ]);
          console.log('✅ Reconnected');
        } catch (error) {
          console.error('❌ Failed to reconnect, destroying connection');
          this.leaveChannel(channel.id).catch(console.error);
        }
      });

      console.log(`✅ Successfully joined ${channel.name} - Session: ${sessionId}`);

      return connection;
    } catch (error) {
      console.error('Error joining voice channel:', error);
      throw error;
    }
  }

  setupAudioReceiver(connection, channel, sessionId) {
    const receiver = connection.receiver;

    // Listen for users speaking
    receiver.speaking.on('start', (userId) => {
      // Create audio stream for this user
      const opusStream = receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 300 // 300ms of silence ends the stream
        }
      });

      // Check if we're already recording this user
      if (!this.audioRecorder.isRecording(userId)) {
        // console.log(`🎤 User ${userId} started speaking (no active recording)`);
        return;
      }

      try {
        // Decode Opus to PCM
        const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
        const pcmStream = opusStream.pipe(decoder);

        // Handle PCM data
        pcmStream.on('data', (chunk) => {
          this.audioRecorder.handleAudioData(userId, chunk);
        });

        pcmStream.on('error', (error) => {
          console.error(`Audio decode error for user ${userId}:`, error);
        });

        opusStream.on('error', (error) => {
          console.error(`Opus stream error for user ${userId}:`, error);
        });
      } catch (error) {
        console.error(`Error setting up decoder for ${userId}:`, error);
      }
    });

    this.receivers.set(channel.id, receiver);
  }

  async leaveChannel(channelId) {
    const connectionData = this.connections.get(channelId);
    if (!connectionData) {
      console.log('No active connection found for channel');
      return;
    }

    try {
      console.log(`👋 Leaving voice channel: ${connectionData.channel.name}`);

      // End session and process recordings
      await this.sessionManager.endSession(channelId);

      // Destroy the connection
      connectionData.connection.destroy();

      // Clean up
      this.connections.delete(channelId);
      this.receivers.delete(channelId);

      console.log(`✅ Left channel and ended session: ${connectionData.sessionId}`);

      // Emit session ended event for report generation
      this.emit('sessionEnded', {
        sessionId: connectionData.sessionId,
        channel: connectionData.channel,
        guild: connectionData.guild
      });

      return connectionData.sessionId;
    } catch (error) {
      console.error('Error leaving voice channel:', error);
      throw error;
    }
  }

  async handleUserJoin(member, channel) {
    if (member.user.bot) return;

    const connectionData = this.connections.get(channel.id);
    if (!connectionData) return;

    console.log(`👤 ${member.user.username} joined ${channel.name}`);

    this.sessionManager.addParticipant(
      connectionData.sessionId,
      member.user,
      channel.id
    );
  }

  async handleUserLeave(member, channel) {
    if (member.user.bot) return;

    const connectionData = this.connections.get(channel.id);
    if (!connectionData) return;

    console.log(`👋 ${member.user.username} left ${channel.name}`);

    await this.sessionManager.removeParticipant(
      connectionData.sessionId,
      member.user.id,
      channel.id
    );

    // Check if channel is now empty (except the bot)
    const humanMembers = channel.members.filter(m => !m.user.bot);
    if (humanMembers.size === 0) {
      console.log('Channel is empty, leaving...');
      setTimeout(() => {
        // Wait a bit in case someone rejoins quickly
        const currentMembers = channel.members.filter(m => !m.user.bot);
        if (currentMembers.size === 0) {
          this.leaveChannel(channel.id);
        }
      }, 5000); // Wait 5 seconds
    }
  }

  getConnection(channelId) {
    return this.connections.get(channelId);
  }

  hasConnection(channelId) {
    return this.connections.has(channelId);
  }

  getAllConnections() {
    return Array.from(this.connections.values());
  }
}

module.exports = VoiceConnectionHandler;
