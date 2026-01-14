# 🎙️ Discord Voice Transcription Bot

A comprehensive Discord bot that listens to voice channels, records conversations, transcribes them using AI, and provides detailed analytics and reports. Perfect for meeting notes, gaming sessions, or any voice channel activity tracking.

## ✨ Features

- 🎤 **Voice Recording**: Automatically records audio from voice channels
- 📝 **Speech-to-Text**: Transcribes voice conversations using Google's Gemini AI
- 📊 **Analytics Engine**: Analyzes conversations for insights
  - Speaker statistics and engagement metrics
  - Topic identification and keyword extraction
  - Sentiment analysis
  - Word count and speaking duration tracking
- 📈 **Session Reports**: Generates detailed reports after each voice session
- 📅 **Daily Summaries**: Automated daily activity reports
- 💾 **Database Storage**: Persistent storage of all sessions and transcripts
- 🔒 **Privacy-Focused**: Only records when invited, with clear indicators
- 🚀 **Easy to Deploy**: Simple setup process with environment variables

## 📋 Prerequisites

- **Node.js** v16 or higher
- **Discord Bot Account** with proper permissions
- **Google Gemini API Key** for AI transcription service
- **FFmpeg** installed on your system

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/discord-voice-app.git
cd discord-voice-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Install FFmpeg

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH

### 4. Create Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" tab and click "Add Bot"
4. Enable these **Privileged Gateway Intents**:
   - Server Members Intent
   - Message Content Intent
5. Copy the bot token
6. Go to "OAuth2" > "URL Generator"
7. Select scopes: `bot`
8. Select permissions:
   - Read Messages/View Channels
   - Send Messages
   - Connect
   - Speak
   - Use Voice Activity
9. Copy the generated URL and use it to invite the bot to your server

### 5. Get Google Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Select or create a Google Cloud project
5. Copy the generated API key

### 6. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```env
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
GOOGLE_API_KEY=your_google_gemini_api_key_here
```

### 7. Initialize Database

```bash
npm run init-db
```

### 8. Start the Bot

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

## 🎮 Usage

### Commands

| Command | Description | Permission Required |
|---------|-------------|-------------------|
| `!join` | Join your current voice channel and start recording | None |
| `!leave` | Leave the voice channel and generate report | Manage Channels |
| `!status` | Show current recording status | None |
| `!report <session_id>` | Generate report for a specific session | None |
| `!daily [YYYY-MM-DD]` | Generate daily activity report | None |
| `!help` | Show help message with all commands | None |

### How It Works

1. **Join a Voice Channel**: Users can invite the bot using `!join` while in a voice channel
2. **Automatic Recording**: The bot automatically starts recording all participants
3. **Real-time Processing**: Audio is captured and stored for each participant
4. **Transcription**: When users leave or the session ends, their audio is transcribed
5. **Analytics**: The bot analyzes the conversation for insights
6. **Report Generation**: A comprehensive report is generated and sent to the text channel
7. **Daily Summaries**: At the configured time, daily activity summaries are automatically sent

### Example Workflow

```
User: !join
Bot: ✅ Joined Voice Channel and started recording!

[Voice session happens...]

User: !leave
Bot: ✅ Left the voice channel and stopped recording!
Bot: [Sends detailed report with transcript and analytics]
```

## 📊 Report Features

### Session Reports Include:
- ⏱️ Session duration
- 👥 Participant count
- 💬 Total words spoken
- 🎤 Top speakers with word counts
- 📚 Discussion topics
- 🎭 Overall sentiment
- 📝 Full transcript with timestamps

### Daily Reports Include:
- 🎙️ Total sessions
- ⏱️ Total duration
- 💬 Total words transcribed
- 👥 Unique speakers
- 📈 Average words per session
- 🏰 Server-specific activity

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DISCORD_TOKEN` | Your Discord bot token | Required |
| `DISCORD_CLIENT_ID` | Your Discord application client ID | Required |
| `GOOGLE_API_KEY` | Your Google Gemini API key | Required |
| `COMMAND_PREFIX` | Command prefix for bot commands | `!` |
| `DATABASE_PATH` | Path to SQLite database file | `./data/transcriptions.db` |
| `TRANSCRIPTION_LANGUAGE` | Language code for transcription | `en` |
| `TRANSCRIPTION_MODEL` | Gemini model to use | `gemini-1.5-flash` |
| `MIN_SESSION_DURATION` | Minimum session duration (seconds) for reports | `60` |
| `DAILY_REPORT_TIME` | Time to send daily reports (24h format) | `23:00` |
| `REPORT_CHANNEL_ID` | Channel ID for daily reports (optional) | None |

### Audio Settings

The bot records at:
- **Sample Rate**: 48kHz
- **Channels**: Stereo (2)
- **Format**: PCM → WAV → Transcription

## 🗄️ Database Schema

The bot uses SQLite with the following tables:

- **sessions**: Voice channel session metadata
- **participants**: User participation tracking
- **transcriptions**: Transcribed text with metadata
- **analytics**: Computed analytics per session
- **reports**: Generated report history

## 🔒 Privacy & Security

- The bot only records when explicitly invited to a voice channel
- Audio files are stored temporarily and can be configured to auto-delete
- Transcripts are stored in a local database
- No data is shared with third parties except Google Gemini for transcription
- Users can see when the bot is in their channel

## 🛠️ Development

### Project Structure

```
discord-voice-app/
├── src/
│   ├── index.js                 # Main bot entry point
│   ├── commands/
│   │   └── commandHandler.js    # Command processing
│   ├── services/
│   │   ├── audioRecorder.js     # Audio recording service
│   │   ├── transcriptionService.js  # Google Gemini AI integration
│   │   ├── analyticsEngine.js   # Analytics computation
│   │   ├── reportGenerator.js   # Report generation
│   │   ├── sessionManager.js    # Session management
│   │   └── voiceConnectionHandler.js  # Voice connection handling
│   └── database/
│       ├── schema.js             # Database schema definition
│       ├── queries.js            # Database queries
│       └── init.js               # Database initialization
├── data/                         # Database storage (auto-created)
├── recordings/                   # Temporary audio files (auto-created)
├── .env                          # Environment variables
├── .env.example                  # Environment template
├── package.json                  # Dependencies
└── README.md                     # This file
```

### Adding New Features

The codebase is modular and easy to extend:

1. **New Commands**: Add to `src/commands/commandHandler.js`
2. **New Analytics**: Extend `src/services/analyticsEngine.js`
3. **Custom Reports**: Modify `src/services/reportGenerator.js`
4. **Database Changes**: Update `src/database/schema.js` and `queries.js`

## 🐛 Troubleshooting

### Bot doesn't join voice channel
- Check that the bot has "Connect" and "Speak" permissions
- Ensure you're in a voice channel when using `!join`
- Verify the bot token is correct

### Transcription fails
- Verify your Google Gemini API key is valid and active
- Check that audio files are being created in the `recordings/` directory
- Ensure FFmpeg is installed and in your PATH
- Verify you haven't exceeded Gemini API rate limits

### No audio is recorded
- Install `@discordjs/opus` or `opusscript`
- Check that FFmpeg is installed
- Verify voice channel permissions

### Database errors
- Run `npm run init-db` to initialize the database
- Check that the `data/` directory exists and is writable
- Verify the `DATABASE_PATH` in `.env`

## 📝 License

MIT License - feel free to use this bot for your own projects!

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues.

## 💡 Ideas for Enhancement

- Multi-language support
- Speaker diarization improvements
- Export transcripts to various formats (PDF, DOCX)
- Integration with other transcription services
- Voice activity detection improvements
- Custom analytics plugins
- Web dashboard for reports
- Real-time transcription display

## 📞 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the troubleshooting section

## 🙏 Acknowledgments

- Built with [Discord.js](https://discord.js.org/)
- Transcription powered by [Google Gemini AI](https://ai.google.dev/)
- Voice handling with [@discordjs/voice](https://github.com/discordjs/voice)

---

Made with ❤️ for better Discord communication
