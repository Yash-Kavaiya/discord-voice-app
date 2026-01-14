# 🚀 Deployment Guide

This guide covers different deployment options for the Discord Voice Transcription Bot.

## 📦 Deployment Options

### Option 1: Local Development/Testing

Perfect for testing and development.

```bash
# Clone and setup
git clone <your-repo-url>
cd discord-voice-app
npm install

# Configure
cp .env.example .env
# Edit .env with your credentials

# Initialize and run
npm run init-db
npm start
```

### Option 2: VPS/Cloud Server (Recommended for Production)

Deploy on any cloud provider (DigitalOcean, AWS EC2, Google Cloud, etc.)

#### Requirements:
- Ubuntu 20.04+ or similar Linux distribution
- At least 1GB RAM
- Node.js 16+
- FFmpeg

#### Setup Steps:

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install FFmpeg
sudo apt install -y ffmpeg

# 4. Clone your repository
git clone <your-repo-url>
cd discord-voice-app

# 5. Install dependencies
npm install

# 6. Configure environment
cp .env.example .env
nano .env  # Edit with your credentials

# 7. Initialize database
npm run init-db

# 8. Test run
npm start
```

#### Running as a Service (systemd)

Create a systemd service file:

```bash
sudo nano /etc/systemd/system/discord-bot.service
```

Add this configuration:

```ini
[Unit]
Description=Discord Voice Transcription Bot
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/path/to/discord-voice-app
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl enable discord-bot
sudo systemctl start discord-bot
sudo systemctl status discord-bot

# View logs
sudo journalctl -u discord-bot -f
```

### Option 3: Docker Deployment

Using Docker for containerized deployment.

#### Create Dockerfile:

```dockerfile
FROM node:18-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app source
COPY . .

# Create data directory
RUN mkdir -p /usr/src/app/data /usr/src/app/recordings

# Initialize database
RUN npm run init-db

# Expose any ports if needed
# EXPOSE 3000

# Start the bot
CMD ["npm", "start"]
```

#### Create docker-compose.yml:

```yaml
version: '3.8'

services:
  discord-bot:
    build: .
    container_name: discord-voice-bot
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./data:/usr/src/app/data
      - ./recordings:/usr/src/app/recordings
    environment:
      - NODE_ENV=production
```

#### Run with Docker:

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Rebuild
docker-compose up -d --build
```

### Option 4: PM2 Process Manager

PM2 is great for production Node.js applications.

```bash
# Install PM2 globally
npm install -g pm2

# Start the bot
pm2 start src/index.js --name discord-bot

# View status
pm2 status

# View logs
pm2 logs discord-bot

# Restart
pm2 restart discord-bot

# Stop
pm2 stop discord-bot

# Auto-start on system boot
pm2 startup
pm2 save
```

#### PM2 Ecosystem File

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'discord-voice-bot',
    script: './src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

Then run:

```bash
pm2 start ecosystem.config.js
```

## 🔐 Security Best Practices

### 1. Environment Variables
- Never commit `.env` file to git
- Use strong, unique tokens
- Rotate API keys regularly

### 2. Server Security
```bash
# Enable firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443

# Keep system updated
sudo apt update && sudo apt upgrade -y

# Use non-root user
sudo adduser botuser
sudo usermod -aG sudo botuser
```

### 3. File Permissions
```bash
# Set appropriate permissions
chmod 600 .env
chmod 755 src/
chmod 755 recordings/
chmod 755 data/
```

### 4. Rate Limiting
- Monitor Google Gemini API usage
- Check quota limits in Google Cloud Console
- Implement request queuing if needed

## 📊 Monitoring

### Log Files

```bash
# Create logs directory
mkdir -p logs

# View real-time logs
tail -f logs/combined.log

# Search for errors
grep -i error logs/error.log
```

### Health Checks

Add a simple HTTP health check endpoint (optional):

```javascript
// Add to src/index.js
const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('OK');
  }
});

server.listen(3000);
```

### Monitoring Tools

- **PM2 Plus**: Built-in monitoring for PM2
- **Uptime Robot**: External uptime monitoring
- **DataDog/New Relic**: Application performance monitoring

## 🔄 Updates and Maintenance

### Updating the Bot

```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Restart the bot
pm2 restart discord-bot
# OR
sudo systemctl restart discord-bot
# OR
docker-compose up -d --build
```

### Database Backups

```bash
# Create backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
cp data/transcriptions.db backups/transcriptions_$DATE.db

# Schedule with cron
crontab -e
# Add line:
0 2 * * * /path/to/backup-script.sh
```

### Cleaning Old Data

```bash
# Clean recordings older than 7 days (happens automatically)
# Manual cleanup if needed:
find recordings/ -type f -mtime +7 -delete
```

## 🌐 Scaling Considerations

### For Multiple Servers

If your bot is in many Discord servers:

1. **Increase Resources**
   - 2GB+ RAM recommended
   - Multiple CPU cores

2. **Database Optimization**
   - Consider PostgreSQL for better concurrent access
   - Regular VACUUM operations for SQLite

3. **Audio Storage**
   - Use external storage (S3, GCS)
   - Implement cleanup policies

4. **Rate Limiting**
   - Queue transcription requests
   - Batch process during off-peak hours

## 🐛 Troubleshooting Deployment

### Bot Not Starting

```bash
# Check logs
pm2 logs discord-bot
# OR
sudo journalctl -u discord-bot -n 50

# Common issues:
# - Missing .env file
# - Invalid credentials
# - Port already in use
# - Missing dependencies
```

### Out of Memory

```bash
# Check memory usage
free -h
pm2 status

# Increase swap space
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Database Locked

```bash
# Stop the bot
pm2 stop discord-bot

# Check for other processes
lsof data/transcriptions.db

# Restart
pm2 start discord-bot
```

## 📱 Environment-Specific Configurations

### Development

```env
NODE_ENV=development
LOG_LEVEL=debug
MIN_SESSION_DURATION=10
```

### Production

```env
NODE_ENV=production
LOG_LEVEL=info
MIN_SESSION_DURATION=60
```

### Testing

```env
NODE_ENV=test
DATABASE_PATH=./data/test.db
```

## 💰 Cost Estimation

### Google Gemini API
- Gemini 1.5 Flash: Free tier available, then paid tier
- Free tier: 15 requests per minute (RPM), 1 million tokens per day
- Paid tier varies by usage and model
- Audio processing is included in context window pricing
- Check [Google AI Pricing](https://ai.google.dev/pricing) for latest rates

### Server Costs
- Small VPS (1GB RAM): $5-10/month
- Medium VPS (2GB RAM): $10-20/month
- Storage: Minimal (transcripts are text)

### Total Monthly Cost
- Small usage (within free tier): $5-10/month (server only)
- Medium usage: $20-50/month
- Heavy usage: $100+/month

---

For more help, see the main [README.md](README.md)
