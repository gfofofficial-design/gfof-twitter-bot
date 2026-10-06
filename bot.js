const https = require('https');
const http = require('http');

// ============================================================
// $GFOF TWITTER/X AUTO-POST BOT
// Posts scheduled content to X automatically
// Uses X API v2 — requires Bearer Token + OAuth 1.0a
// ============================================================

const TWITTER_API_KEY        = process.env.TWITTER_API_KEY;
const TWITTER_API_SECRET     = process.env.TWITTER_API_SECRET;
const TWITTER_ACCESS_TOKEN   = process.env.TWITTER_ACCESS_TOKEN;
const TWITTER_ACCESS_SECRET  = process.env.TWITTER_ACCESS_SECRET;
const TELEGRAM_TOKEN         = process.env.TELEGRAM_TOKEN;
const OWNER_CHAT_ID          = process.env.OWNER_CHAT_ID;
const PORT                   = process.env.PORT || 3003;
const APP_URL                = process.env.APP_URL || '';

const CA = 'Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV';
const TRADING_URL = 'https://tebfun.xyz/token/' + CA;
const SCHEDULED_POSTS_ENABLED = process.env.ENABLE_SCHEDULED_POSTS === 'true';
const MANUAL_POST_TOKEN = process.env.MANUAL_POST_TOKEN || '';
const MAX_BODY_BYTES = 32 * 1024;

var startTime = Date.now();
var postsToday = 0;
var lastPostTime = null;
var postLog = [];

// ============================================================
// SCHEDULED POSTS — Add/edit posts here
// time: 'HH:MM' in 24hr format (UTC)
// days: array of weekdays 0=Sun,1=Mon,...6=Sat or 'daily'
// ============================================================
var SCHEDULE = [
  {
    id: 'current_mint_morning',
    time: '13:00',
    days: 'daily',
    text: `$GFOF is on TebFun. 🌌

Current Solana CA: ${CA}

Trading: ${TRADING_URL}
Explore: https://galacticfederation.co/

#GFOF #Solana`
  },
  {
    id: 'public_build_noon',
    time: '18:00',
    days: [1, 3, 5],
    text: `The Galactic Federation is building in public: missions, holder records, and transparent updates. 🌌

Explore: https://galacticfederation.co/
Old-holder exchange: https://galacticfederation.co/migration

#GFOF #Solana`
  },
  {
    id: 'education_evening',
    time: '23:00',
    days: [2, 4],
    text: `Finance mission: before connecting a wallet, verify the official site and understand every approval you sign. 🌌

Explore the Galactic Federation:
https://galacticfederation.co/

#GFOF #Solana`
  },
  {
    id: 'weekend_roll_call',
    time: '15:00',
    days: [0, 6],
    text: `Join the Galactic Federation's next chapter. 🌌

Staking preparation: https://galacticfederation.co/staking
Staking pools are not open yet.

Community: https://t.me/GFOF_SOL
Explore: https://galacticfederation.co/

#GFOF #Solana`
  },
];

// ============================================================
// OAUTH 1.0a SIGNING FOR TWITTER API v2
// ============================================================
const crypto = require('crypto');

function oauthSign(method, url, params, consumerKey, consumerSecret, tokenKey, tokenSecret) {
  var oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: tokenKey,
    oauth_version: '1.0'
  };

  var allParams = Object.assign({}, params, oauthParams);
  var sortedKeys = Object.keys(allParams).sort();
  var paramStr = sortedKeys.map(k => encodeURIComponent(k) + '=' + encodeURIComponent(allParams[k])).join('&');
  var baseStr = method.toUpperCase() + '&' + encodeURIComponent(url) + '&' + encodeURIComponent(paramStr);
  var signingKey = encodeURIComponent(consumerSecret) + '&' + encodeURIComponent(tokenSecret);
  var signature = crypto.createHmac('sha1', signingKey).update(baseStr).digest('base64');
  oauthParams.oauth_signature = signature;

  var headerParts = Object.keys(oauthParams).sort().map(k => encodeURIComponent(k) + '="' + encodeURIComponent(oauthParams[k]) + '"');
  return 'OAuth ' + headerParts.join(', ');
}

// ============================================================
// POST TWEET
// ============================================================
function postTweet(text, callback) {
  if (!TWITTER_API_KEY || !TWITTER_API_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_SECRET) {
    console.log('[TWEET] Credentials not set — logging only:');
    console.log('[TWEET]', text.substring(0, 100) + '...');
    if (callback) callback(null, {simulated: true});
    return;
  }

  var url = 'https://api.twitter.com/2/tweets';
  var body = JSON.stringify({ text: text });
  var authHeader = oauthSign('POST', url, {}, TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET);

  var req = https.request({
    hostname: 'api.twitter.com',
    path: '/2/tweets',
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }, function(res) {
    var d = '';
    res.on('data', function(c) { d += c; });
    res.on('end', function() {
      try {
        var r = JSON.parse(d);
        if (r.data && r.data.id) {
          console.log('[TWEET] ✅ Posted! ID:', r.data.id);
          postsToday++;
          lastPostTime = new Date().toISOString();
          postLog.push({ time: lastPostTime, id: r.data.id, text: text.substring(0, 80) });
          if (postLog.length > 50) postLog.shift();
          // Notify owner via Telegram
          notifyOwner('✅ Tweet posted!\n\n' + text.substring(0, 200) + (text.length > 200 ? '...' : ''));
          if (callback) callback(null, r.data);
        } else {
          console.log('[TWEET] ❌ Error:', JSON.stringify(r));
          notifyOwner('❌ Tweet failed: ' + JSON.stringify(r).substring(0, 200));
          if (callback) callback(new Error(JSON.stringify(r)));
        }
      } catch(e) { if (callback) callback(e); }
    });
  });
  req.on('error', function(e) { console.error('[TWEET] Request error:', e.message); if (callback) callback(e); });
  req.setTimeout(15000, function() { req.destroy(); });
  req.write(body);
  req.end();
}

// ============================================================
// NOTIFY OWNER VIA TELEGRAM
// ============================================================
function notifyOwner(msg) {
  if (!TELEGRAM_TOKEN || !OWNER_CHAT_ID) return;
  var body = JSON.stringify({ chat_id: OWNER_CHAT_ID, text: '🤖 $GFOF Twitter Bot\n\n' + msg, parse_mode: 'HTML' });
  var req = https.request({
    hostname: 'api.telegram.org',
    path: '/bot' + TELEGRAM_TOKEN + '/sendMessage',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, function(res) { res.resume(); });
  req.on('error', function() {});
  req.setTimeout(10000, function() { req.destroy(); });
  req.write(body); req.end();
}

// ============================================================
// SCHEDULER — checks every minute
// ============================================================
var lastCheckedMinute = -1;

function checkSchedule() {
  if (!SCHEDULED_POSTS_ENABLED) return;
  var now = new Date();
  var minute = now.getUTCMinutes();
  if (minute === lastCheckedMinute) return;
  lastCheckedMinute = minute;

  var timeStr = String(now.getUTCHours()).padStart(2,'0') + ':' + String(now.getUTCMinutes()).padStart(2,'0');
  var dayOfWeek = now.getUTCDay();

  SCHEDULE.forEach(function(item) {
    if (item.time !== timeStr) return;
    var shouldPost = item.days === 'daily' || (Array.isArray(item.days) && item.days.includes(dayOfWeek));
    if (!shouldPost) return;

    console.log('[SCHEDULE] Posting:', item.id, 'at', timeStr, 'UTC');
    postTweet(item.text, function(err) {
      if (err) console.log('[SCHEDULE] Post failed:', err.message);
    });
  });
}

// ============================================================
// KEEP ALIVE
// ============================================================
function keepAlive() {
  if (!APP_URL) return;
  setInterval(function() {
    try {
      var url = new URL(APP_URL + '/ping');
      var proto = url.protocol === 'https:' ? https : http;
      var req = proto.request({ hostname: url.hostname, path: '/ping', method: 'GET' },
        function(res) { console.log('[PING]', res.statusCode); });
      req.on('error', function() {});
      req.setTimeout(8000, function() { req.destroy(); });
      req.end();
    } catch(e) {}
  }, 4 * 60 * 1000);
}

// ============================================================
// HTTP SERVER — Manual post endpoint
// ============================================================
http.createServer(function(req, res) {
  var up = Math.floor((Date.now() - startTime) / 1000);

  if (req.url === '/ping' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      bot: '$GFOF Twitter Bot',
      uptime: Math.floor(up/3600) + 'h ' + Math.floor((up%3600)/60) + 'm',
      posts_today: postsToday,
      last_post: lastPostTime,
      schedule_count: SCHEDULE.length,
      scheduled_posts_enabled: SCHEDULED_POSTS_ENABLED,
      manual_post_enabled: !!MANUAL_POST_TOKEN,
      ca: CA,
      trading_url: TRADING_URL,
      post_log: postLog.slice(-5),
      credentials: {
        api_key: !!TWITTER_API_KEY,
        access_token: !!TWITTER_ACCESS_TOKEN,
        telegram: !!TELEGRAM_TOKEN
      }
    }));
    return;
  }

  // Manual posting requires a configured bearer token; disabled otherwise.
  if (req.url === '/tweet' && req.method === 'POST') {
    if (!MANUAL_POST_TOKEN) { res.writeHead(503); res.end('{"error":"manual posting disabled"}'); return; }
    var supplied = Buffer.from((req.headers || {}).authorization || '');
    var expected = Buffer.from('Bearer ' + MANUAL_POST_TOKEN);
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
      res.writeHead(401); res.end('{"error":"unauthorized"}'); return;
    }
    var body = '';
    var bodyBytes = 0;
    var rejected = false;
    req.on('data', function(c) {
      if (rejected) return;
      bodyBytes += Buffer.byteLength(c);
      if (bodyBytes > MAX_BODY_BYTES) {
        rejected = true;
        body = '';
        res.writeHead(413); res.end('{"error":"request too large"}');
        return;
      }
      body += c;
    });
    req.on('end', function() {
      if (rejected) return;
      try {
        var data = JSON.parse(body);
        if (!data || typeof data.text !== 'string' || !data.text.trim()) { res.writeHead(400); res.end('{"error":"missing text"}'); return; }
        postTweet(data.text, function(err, result) {
          if (err) { res.writeHead(500); res.end(JSON.stringify({error: err.message})); }
          else { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({success:true,result})); }
        });
      } catch(e) { res.writeHead(400); res.end('{"error":"invalid json"}'); }
    });
    return;
  }

  // List schedule
  if (req.url === '/schedule') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ schedule: SCHEDULE.map(s => ({ id: s.id, time: s.time + ' UTC', days: s.days, preview: s.text.substring(0,100) })) }));
    return;
  }

  res.writeHead(404); res.end('Not found');
}).listen(PORT, function() {
  console.log('\n🌌 $GFOF Twitter Bot — Online on port ' + PORT);
  console.log('📅 Scheduled posts:', SCHEDULE.length);
  console.log('🔑 API Key:', TWITTER_API_KEY ? '✅ SET' : '❌ NOT SET');
  console.log('🔑 Access Token:', TWITTER_ACCESS_TOKEN ? '✅ SET' : '❌ NOT SET');
  console.log('📬 Telegram notify:', TELEGRAM_TOKEN ? '✅ SET' : '❌ NOT SET');
  console.log('🌐 App URL:', APP_URL || '❌ NOT SET — add to prevent sleep');
  console.log('\nSchedule:');
  SCHEDULE.forEach(function(s) { console.log('  ' + s.time + ' UTC — ' + s.id + ' — ' + (s.days === 'daily' ? 'daily' : 'days ' + JSON.stringify(s.days))); });
  console.log('');

  notifyOwner('🌌 $GFOF Twitter Bot is online!\n\nScheduled posting: ' + (SCHEDULED_POSTS_ENABLED ? 'enabled' : 'disabled') + '.\nDashboard: ' + (APP_URL || 'not set'));

  // Start scheduler
  if (SCHEDULED_POSTS_ENABLED) {
    setInterval(checkSchedule, 30 * 1000);
    checkSchedule();
  }
  keepAlive();
});
