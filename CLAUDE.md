# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Discord bot that records voice channels, transcribes audio using Google Gemini AI, and provides detailed analytics and reports. The bot automatically joins voice channels when users enter, records individual audio streams, transcribes them, and generates comprehensive session reports with speaker statistics, sentiment analysis, and topic identification.

## Development Commands

```bash
# Install dependencies
npm install

# Initialize/reset the database
npm run init-db

# Run the bot (production)
npm start

# Run with auto-restart on file changes (development)
npm run dev
```

## Prerequisites

- **FFmpeg**: Must be installed and accessible in PATH. The bot uses `ffmpeg-static` package, but verify FFmpeg is working with `ffmpeg -version`
- **Node.js**: v16 or higher required
- **Environment variables**: Copy `.env.example` to `.env` and configure:
  - `DISCORD_TOKEN` (required)
  - `GOOGLE_API_KEY` (required)
  - `DISCORD_CLIENT_ID` (optional but recommended)

## Architecture

### Entry Point and Initialization Sequence

The bot is initialized through the `VoiceTranscriptionBot` class in [src/index.js](src/index.js):

1. **validateConfig()** - Checks required environment variables
2. **initializeDatabase()** - Initializes SQLite database via sql.js
3. **initializeServices()** - Creates service instances with dependency injection
4. **initializeClient()** - Sets up Discord.js client with required intents
5. **setupEventHandlers()** - Registers event listeners for messages and voice state updates
6. **setupCronJobs()** - Schedules daily reports and weekly cleanup tasks

### Service Architecture

The bot uses a modular, service-oriented architecture with clear separation of concerns:

```
VoiceTranscriptionBot (orchestrator)
├── DatabaseSchema → DatabaseQueries (data layer)
├── AudioRecorder (captures and converts audio)
├── TranscriptionService (Google Gemini AI integration)
├── AnalyticsEngine (computes session insights)
├── ReportGenerator (creates Discord embeds)
├── SessionManager (orchestrates entire workflow)
├── VoiceConnectionHandler (manages Discord voice)
└── CommandHandler (processes user commands)
```

**Key dependency flow**:
- `SessionManager` depends on all other services and orchestrates the full recording → transcription → analytics → reporting pipeline
- `VoiceConnectionHandler` depends on `SessionManager` and `AudioRecorder` to handle voice events
- `CommandHandler` depends on `VoiceConnectionHandler`, `SessionManager`, and `ReportGenerator` for user commands

### Critical Components

#### SessionManager ([src/services/sessionManager.js](src/services/sessionManager.js))

The orchestrator for the entire recording lifecycle:
- **createSession()**: Initializes a new recording session when bot joins a channel
- **addParticipant()**: Called when a user joins; starts recording for that user
- **removeParticipant()**: Called when a user leaves; stops recording, triggers transcription
- **endSession()**: Stops all recordings, processes transcriptions, updates database
- **processRecording()**: Calls TranscriptionService and saves results to database
- **generateSessionReport()**: Triggers analytics and report generation

Uses two Map data structures:
- `activeSessions` (channelId → session data with participants Set)
- `userSessions` (userId → {sessionId, startTime})

#### AudioRecorder ([src/services/audioRecorder.js](src/services/audioRecorder.js))

Manages audio capture and conversion:
- Records per-user audio streams to PCM format
- Converts PCM to WAV using FFmpeg (`fluent-ffmpeg` + `ffmpeg-static`)
- Stores files in `recordings/` directory with naming: `{sessionId}_{userId}_{timestamp}.wav`
- **Important**: Audio is recorded at 48kHz, stereo (2 channels), PCM 16-bit little-endian

#### VoiceConnectionHandler ([src/services/voiceConnectionHandler.js](src/services/voiceConnectionHandler.js))

Manages Discord voice connections using `@discordjs/voice`:
- **joinChannel()**: Creates voice connection, sets up audio receiver, subscribes to user audio streams
- **leaveChannel()**: Ends session, destroys connection, generates report
- **handleUserJoin/Leave()**: Manages participant lifecycle within active sessions
- Integrates with AudioRecorder to pipe Discord audio streams to file

#### Database ([src/database/](src/database/))

Uses **sql.js** (SQLite compiled to WebAssembly) with manual persistence:
- `schema.js`: Defines tables and handles initialization/save/close operations
- `queries.js`: Provides data access methods
- **Critical**: Database is in-memory; changes are persisted to disk via `db.export()` and `fs.writeFileSync()`
- Must call `save()` after mutations or data will be lost on restart

**Schema** (5 tables):
- `sessions` - Voice channel session metadata
- `participants` - User participation tracking with join/leave timestamps
- `transcriptions` - Transcribed text with word counts, confidence, language
- `analytics` - Computed session analytics (topics, sentiment, keywords)
- `reports` - Generated report history

## Development Patterns

### Adding New Bot Commands

Edit [src/commands/commandHandler.js](src/commands/commandHandler.js):
1. Add case in the switch statement in `handleCommand()`
2. Implement command method (e.g., `async myCommand(message, args)`)
3. Update `helpCommand()` to document the new command

### Extending Analytics

Edit [src/services/analyticsEngine.js](src/services/analyticsEngine.js):
- `analyzeSession()` computes session-level analytics
- `analyzeDailyActivity()` computes daily summaries across all sessions
- Analytics results are saved to the `analytics` table via DatabaseQueries

### Modifying Transcription Service

Edit [src/services/transcriptionService.js](src/services/transcriptionService.js):
- Currently uses Google Gemini's `gemini-1.5-flash` model
- To switch providers: replace the transcription logic but maintain the same return format: `{ text, confidence, language, duration, wordCount }`

### Database Migrations

The bot uses a simple schema initialization approach (no migrations):
- To modify schema: edit `initializeTables()` in [src/database/schema.js](src/database/schema.js)
- Use `CREATE TABLE IF NOT EXISTS` to avoid errors
- For structural changes, consider backing up and recreating the database

## Important Behaviors

### Auto-Join Feature

The bot automatically joins voice channels when users enter (see [src/index.js](src/index.js:136-199)):
- Monitors `VoiceStateUpdate` events
- Joins channels without explicit `!join` command
- This behavior is hardcoded in `handleVoiceStateUpdate()`

### Audio Processing Flow

1. User joins → `addParticipant()` → `audioRecorder.startRecording()`
2. Discord voice stream → `handleAudioData()` → Write PCM chunks to file
3. User leaves → `stopRecording()` → Convert PCM to WAV via FFmpeg
4. `processRecording()` → Send WAV to Google Gemini → Save transcription to DB
5. `endSession()` → Aggregate analytics → Generate report

### Cron Jobs

Configured in `setupCronJobs()` in [src/index.js](src/index.js:201-221):
- **Daily reports**: Runs at time specified in `DAILY_REPORT_TIME` (default: 23:00)
- **Weekly cleanup**: Runs every Sunday at midnight, deletes recordings older than 7 days

### Error Handling

- Commands wrap operations in try-catch and send error messages to Discord
- Service errors are logged to console but generally don't crash the bot
- Voice state update errors are caught and logged but don't stop event processing

## Environment Configuration

Critical environment variables (see [.env.example](.env.example)):

- `DISCORD_TOKEN` - Required for bot authentication
- `GOOGLE_API_KEY` - Required for Gemini AI transcription
- `TRANSCRIPTION_MODEL` - Default: `gemini-1.5-flash` (options: `gemini-1.5-pro` for higher accuracy)
- `MIN_SESSION_DURATION` - Minimum seconds before generating report (default: 60)
- `DAILY_REPORT_TIME` - When to send daily summaries (24-hour format, default: 23:00)
- `DATABASE_PATH` - SQLite file location (default: `./data/transcriptions.db`)

## Testing & Debugging

Since there are no test scripts configured, manual testing workflow:

1. Start bot with `npm run dev` for auto-reload
2. Join a Discord voice channel
3. Verify auto-join and recording start in console logs
4. Leave channel and check for transcription processing logs
5. Verify report is sent to Discord text channel
6. Check database with: `node debug_db.js` (if this file is for DB inspection)

**Common debug points**:
- FFmpeg conversion failures: Check FFmpeg installation and PATH
- No audio recorded: Verify Discord bot has "Connect" and "Speak" permissions
- Transcription fails: Check Google API key validity and rate limits
- Database issues: Ensure `data/` directory exists and is writable

## Code Style & Conventions

- ES6+ JavaScript (CommonJS modules with `require`/`module.exports`)
- Class-based architecture for services
- Console logging with emoji prefixes for visual clarity (🎙️, ✅, ❌, etc.)
- Async/await for asynchronous operations
- Dependency injection pattern for service initialization
- No TypeScript, linting, or formatting tools configured
