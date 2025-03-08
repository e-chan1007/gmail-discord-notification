# gmail-discord-notification

A simple Gmail notification for Discord.

## Installation

Project ID: `1zQ6wfsTUaecxmqNSijQyJ2fVh8PG4VEMc7zbGdSxBmAmdPAUD3zsWG0f`

## Usage
```js
const options = [
  {
    default: true,
    webhookURL: 'https://discord.com/api/webhooks/...'
  },
  {
    query: 'label:LabelName',
    webhookURL: 'https://discord.com/api/webhooks/...',
    discordOptions: {
      avatarURL: 'https://cdn.discordapp.com/avatars/...',
    }
  },
  {
    query: 'from:noreply@example.com',
    ignore: true
  },
  // ...
];

GmailDiscordNotification.checkMail(options, PropertiesService.getScriptProperties());
```

Where `options` is an array with the following structure:
```ts
interface Option {
  default?: boolean;
  query?: string;
  webhookURL?: string;
  ignore?: boolean;
  discordOptions?: object;
  discordEmbedOptions?: object;
}
```

## Tips
- Append `thread_id` query parameter to the webhook URL to send messages to the thread.
  - `https://discord.com/api/webhooks/...?thread_id=...`
