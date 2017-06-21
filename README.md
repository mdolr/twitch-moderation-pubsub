# twitch-moderation-pubsub

A simple node module that let you connect to twitch moderation pubsub

Inspired by [Fuechschen's twitch-realtime module](https://github.com/Fuechschen/twitch-realtime)

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

### Installing
```
npm i twitch-moderation-pubsub
```

### Twitch token

You can get your twitch token here : http://twitchapps.com/tmi/

### Conditions

Your account absolutely needs to be a moderator on the channels you want to listen events to.

## Using the module in your code

### Example
```js
//At the top of your file. Make sure the path to the file is leading to this file and that both files are in the same directory.
const ShardManager = require('./pathTo/ShardManager.js');

//Then you can declare the pubsub-client like that :
let pubsub = new ShardManager({
  token: 'Token without the "oauth:" thing',
  topics: ['Array of twitch channel ids you want to listen events to'],
  mod_id: 'Your account ID'
});

//Then it works like an event-emitter :
pubsub.on('ready', function()  {
//Do something when ready.
})
.on('timeout', function(data) {
//Process the data.
})
.on('ban', function(data) {
//Process the data.
})
.on('unban', function(data) {
//Process the data.
});
```

### Each moderation actions returns a data object that has the following structure :
```js
data = {
  channel_id: 'ID to string',
  type: 'either ban unban or timeout',
  moderator: {
    id: 'ID of the moderator to string',
    name: 'Username of the moderator on twitch'
  },
  target: {
    id: 'ID of the target to string',
    name: 'Username of the target on twitch'
  },
  reason: 'either the reason given or undefined as a string',
  duration: 'either a number of seconds or permanent as a string',
  created_at: new Date().getTime()
};
```
