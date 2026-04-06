# $GFOF Twitter Bot

Auto-posts scheduled content to X (Twitter) for @GFOF_Offcial.

## Setup Steps

### Step 1 — Get X API Credentials

1. Go to developer.twitter.com
2. Sign in with @GFOF_Offcial account
3. Create a new App (call it "GFOF Bot")
4. Under "Keys and Tokens" get:
   - API Key (Consumer Key)
   - API Key Secret (Consumer Secret)
   - Access Token (for @GFOF_Offcial)
   - Access Token Secret
5. Set App permissions to "Read and Write"

### Step 2 — Deploy on Render

1. Upload this folder to a new GitHub repo called "gfof-twitter-bot"
2. Create new Web Service on Render
3. Connect the repo
4. Build: npm install | Start: node bot.js

### Step 3 — Set Environment Variables

| Variable | Value |
|----------|-------|
| TWITTER_API_KEY | Your X API Key |
| TWITTER_API_SECRET | Your X API Secret |
| TWITTER_ACCESS_TOKEN | Access Token for @GFOF_Offcial |
| TWITTER_ACCESS_SECRET | Access Token Secret |
| TELEGRAM_TOKEN | Bot token (for notifications to you) |
| OWNER_CHAT_ID | Your personal Telegram chat ID |
| APP_URL | https://gfof-twitter-bot.onrender.com |

### Step 4 — Verify

Visit https://gfof-twitter-bot.onrender.com/schedule to see scheduled posts.
Visit /ping to check status.

## Scheduled Posts

- Daily 8am CST — Vote reminder (CoinHunt + CoinVote + Jupiter)
- Mon/Wed/Fri 1pm CST — Bond tracker update
- Tue/Thu 6pm CST — Education post
- Sat/Sun 10am CST — Weekend community rally

## Manual Post

POST to /tweet with JSON body: {"text": "Your tweet here"}

## Edit Schedule

Open bot.js and edit the SCHEDULE array at the top of the file.
Each item has: id, time (UTC), days (array or 'daily'), text.
