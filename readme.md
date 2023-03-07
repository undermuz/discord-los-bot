# Bot for League of Sweat

## Commands

1. `/roll [cap=100]` - Get random number from 0 to cap (default 100)
2. `/rolls @user1 @user 2 [@userN]` - Rolling provided users by roll command, amount of users should be from 2 to 25

## Adding the bot to your discord-server

Open this link and follow the steps to add it to your desired server:

`https://discord.com/api/oauth2/authorize?client_id=<YOUR_APP_ID>&permissions=2147665984&scope=bot%20applications.commands`

That's it.

## Install bot-backend to the server

1. Clone this repo to your server
2. Run npm i
3. Create file `.env` and put values for DISCORD_TOKEN and APP_ID
4. Copy discord-los-bot.service file to `/lib/systemd/system/`
5. Execute `sudo systemctl daemon-reload`
6. Execute `sudo systemctl start discord-los-bot`
7. Execute `sudo systemctl enable discord-los-bot`

## Diagnostic

1. Show logs: `sudo journalctl -u discord-los-bot`
2. Restart: `systemctl restart discord-los-bot`
3. Show current status: `systemctl status discord-los-bot`

## TODO

1. ✅ Add rolls-channel
