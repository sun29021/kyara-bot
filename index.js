require('dotenv').config();
const { createKyaraBot } = require('./core/kyaraBot');
const settings = require('./settings.json');

// Allow environment overrides for Railway
if (process.env.MC_HOST) settings.host = process.env.MC_HOST;
if (process.env.MC_PORT) settings.port = parseInt(process.env.MC_PORT, 10);
if (process.env.MC_USERNAME) settings.username = process.env.MC_USERNAME;
if (process.env.MC_VERSION) settings.version = process.env.MC_VERSION;
if (process.env.OWNER_NAME) settings.ownerName = process.env.OWNER_NAME;

let bot = createKyaraBot(settings);

// Auto-reconnect loop
bot.on('end', () => {
  if (settings.autoReconnect) {
    console.log('[KYARA] Disconnected. Reconnecting in 5s...');
    setTimeout(() => {
      bot = createKyaraBot(settings);
    }, settings.reconnectDelay || 5000);
  }
});

process.on('SIGTERM', () => {
  try { require('./core/kyaraMemory').save(); } catch (e) {}
  process.exit(0);
});
process.on('SIGINT', () => {
  try { require('./core/kyaraMemory').save(); } catch (e) {}
  process.exit(0);
});