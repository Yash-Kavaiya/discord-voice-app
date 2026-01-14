# Discord Voice Transcription Bot - End-to-End Testing Guide

## Bot Status
✅ **Bot is currently RUNNING and ONLINE**
- Bot Name: Voice_gini#6729
- Status: Connected and ready to receive commands

## Testing Checklist

### 1. Basic Bot Connection Test
- [ ] Verify bot appears online in Discord server
- [ ] Check bot's status indicator (green = online)
- [ ] Verify bot has proper permissions

### 2. Help Command Test
**Command:** `!help`
**Expected Result:**
- Bot responds with a help message listing all available commands
- Message includes command descriptions and usage examples

### 3. Join Voice Channel Test
**Steps:**
1. Join any voice channel in your Discord server
2. Type `!join` in a text channel
**Expected Result:**
- Bot joins your voice channel
- Bot sends confirmation message: "✅ Joined Voice Channel and started recording!"
- Bot starts recording audio from all participants

**Alternative (Auto-join):**
- Bot should automatically join when you join a voice channel
- Confirmation message sent to text channel

### 4. Status Command Test
**Command:** `!status`
**Expected Result:**
- Bot displays current recording status
- Shows active session information
- Lists participants being recorded

### 5. Voice Recording Test
**Steps:**
1. Ensure bot is in voice channel
2. Speak for at least 5 seconds (MIN_SESSION_DURATION is set to 5 seconds)
3. Have multiple people speak if possible
**Expected Result:**
- Audio is being captured (check recordings/ folder for .wav/.pcm files)
- Each participant gets their own audio stream

### 6. Leave and Generate Report Test
**Command:** `!leave`
**Expected Result:**
- Bot leaves the voice channel
- Bot sends: "✅ Left the voice channel and stopped recording!"
- Bot processes audio and generates transcription
- Bot sends a detailed report with:
  - Session duration
  - Participant count
  - Total words spoken
  - Top speakers
  - Discussion topics
  - Sentiment analysis
  - Full transcript with timestamps

### 7. Session Report Retrieval Test
**Steps:**
1. Complete a voice session (join → speak → leave)
2. Note the session ID from the report
3. Type `!report <session_id>`
**Expected Result:**
- Bot retrieves and displays the specific session report
- Report matches the original session data

### 8. Daily Report Test
**Command:** `!daily` or `!daily 2026-01-14`
**Expected Result:**
- Bot generates a daily activity summary
- Shows:
  - Total sessions for the day
  - Total duration
  - Total words transcribed
  - Unique speakers
  - Average words per session
  - Server-specific activity

### 9. Multi-User Voice Test
**Steps:**
1. Have 2+ users join voice channel
2. Bot joins (auto or via !join)
3. Each user speaks
4. Bot leaves or users leave
**Expected Result:**
- Bot records each user separately
- Transcript identifies different speakers
- Analytics show per-speaker statistics

### 10. Voice State Change Test
**Steps:**
1. Join voice channel (bot auto-joins)
2. Switch to different voice channel
3. Leave voice channel
**Expected Result:**
- Bot follows you to new channel (auto-join)
- Bot handles user leaving gracefully
- Sessions are properly ended and reports generated

### 11. Database Persistence Test
**Steps:**
1. Complete several voice sessions
2. Stop the bot (Ctrl+C)
3. Restart the bot
4. Query old session with `!report <session_id>`
**Expected Result:**
- Database persists across restarts
- Old sessions are retrievable
- No data loss

### 12. Audio File Management Test
**Check:**
- Recordings are saved in `recordings/` folder
- Files are named with format: `{uuid}_{userId}_{timestamp}.wav`
- Old recordings are cleaned up (weekly cron job)

### 13. Transcription Service Test
**Verify:**
- Audio files are sent to Google Gemini API
- Transcriptions are accurate
- Language detection works (if multi-language)
- Timestamps are included in transcripts

### 14. Analytics Engine Test
**Verify from reports:**
- Word count is accurate
- Speaker statistics are correct
- Topics are relevant to conversation
- Sentiment analysis makes sense
- Keywords are extracted properly

### 15. Error Handling Test
**Test scenarios:**
- Bot loses connection → Should reconnect
- Invalid command → Should show error or help
- No permission → Should notify user
- API rate limit → Should handle gracefully
- Empty voice session → Should not generate report

### 16. Cron Jobs Test
**Scheduled tasks:**
- Daily reports at 23:00 (11 PM)
- Weekly cleanup on Sundays at midnight
**Verify:**
- Reports are sent automatically
- Old recordings are deleted

### 17. Permission Test
**Test:**
- User without "Manage Channels" tries `!leave`
**Expected:**
- Bot denies the command or shows permission error

### 18. Long Session Test
**Steps:**
1. Start a voice session
2. Keep it running for 10+ minutes
3. Multiple people speak throughout
4. End session
**Expected:**
- Bot handles long sessions
- Transcription is complete
- Analytics are comprehensive
- No memory leaks or crashes

## Testing with Chrome DevTools MCP

Since Discord requires authentication and CAPTCHA, here's an alternative testing approach:

### Option 1: Use Discord Developer Portal
1. Open Discord Developer Portal
2. Check bot status and logs
3. Verify bot is online

### Option 2: Use Discord Mobile/Desktop App
1. Open Discord app (not web)
2. Navigate to your test server
3. Execute all commands manually
4. Verify bot responses

### Option 3: Monitor Bot Logs
Watch the console output for:
```
🎙️  Auto-joining voice channel: [channel-name]
✅ Bot is ready! Logged in as Voice_gini#6729
📊 Generating report for session [session-id]...
```

## Current Bot Configuration
- Command Prefix: `!`
- Min Session Duration: 5 seconds
- Daily Report Time: 23:00
- Transcription Model: gemini-1.5-flash
- Database: ./data/transcriptions.db

## Files to Monitor
1. **Console Output** - Real-time bot activity
2. **recordings/** - Audio files being created
3. **data/transcriptions.db** - Database updates
4. **Bot logs** - Any errors or warnings

## Success Criteria
✅ All commands respond correctly
✅ Voice recording works
✅ Transcription is accurate
✅ Reports are comprehensive
✅ Database persists data
✅ No crashes or errors
✅ Auto-join works
✅ Analytics are meaningful

## Troubleshooting
If any test fails, check:
1. Bot console for errors
2. Discord bot permissions
3. Google API key validity
4. FFmpeg installation
5. Database file permissions
6. Network connectivity
