# $GFOF X bot — current mint and posting controls

Current Solana mint: `Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV`.

Trading: https://tebfun.xyz/token/Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV

## Deployment

Use the existing service and account credentials when applying this update.
Build command: `npm install`. Start command: `node bot.js`.
Keep the existing X credential variables, Telegram owner notification destination,
`PORT`, and `APP_URL` settings.

Do not activate posting until the owner has reviewed the templates and account.

| Variable | Purpose |
| --- | --- |
| TWITTER_API_KEY / TWITTER_API_SECRET | Existing X application credentials |
| TWITTER_ACCESS_TOKEN / TWITTER_ACCESS_SECRET | Existing authorized account credentials |
| TELEGRAM_TOKEN / OWNER_CHAT_ID | Existing owner notification destination |
| APP_URL | Actual deployed service URL |
| ENABLE_SCHEDULED_POSTS | Set exactly `true` to enable scheduling; disabled by default |
| MANUAL_POST_TOKEN | Secret bearer token for manual posting; disabled when unset |

## Scheduled templates

The four templates cover the current mint, public build, wallet-approval education,
and community/staking preparation. They remove the old contract, Moonshot/Raydium
claims, the $73K bonding target, old listing-vote links, and lending promises.
Staking pools are described as not open.

Times use UTC; Chicago local times change with daylight saving time.

- Daily 13:00 UTC: current mint.
- Monday/Wednesday/Friday 18:00 UTC: public build and old-holder exchange details.
- Tuesday/Thursday 23:00 UTC: wallet-approval education.
- Saturday/Sunday 15:00 UTC: community and staking preparation.

## Manual posting

`POST /tweet` requires `Authorization: Bearer <MANUAL_POST_TOKEN>` and a JSON
body containing a nonblank string `text`. Unconfigured manual posting returns
503; invalid or missing authorization returns 401 before any posting call.
Bodies above 32 KiB return 413. Store the token as a secret environment variable.

## Read-only checks

`GET /ping` and `GET /` report the current mint, trading link, and whether
scheduled/manual posting is enabled. `GET /schedule` lists template previews.

## Validation

Run `npm test`. The isolated tests make no network calls and send no posts.
