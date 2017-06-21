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
const ShardManager = require('twitch-moderation-pubsub');

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

# License

Refer to the [LICENSE](https://github.com/Equinoxbig/twitch-moderation-pubsub/blob/master/LICENSE) file.

# Documentation

## Events

'ready' - emitted when the ShardManager is ready, returns nothing.

'timeout' - emitted when a timeout has been detected, returns an action object as shown above and the shard that received it.

'ban' - emitted when a ban has been detected, returns an action object as shown above and the shard that received it.

'unban' - emitted when an unban has been detected, returns an action object as shown above and the shard that received it.

'pong' - emitted when a shard receives a pong response, returns the shard that received it.

'debug' - emitted whenever a message is received, returns a message and the shard that received it.

'error' - emitted whenever an error is detected, returns an error message if there is any and the shard that received it.

'message' - emitted when a message is received and its topic isn't "chat_moderator_actions", returns the message and the shard that received it.

## Functions

addTopic(twitchID) - Promise - adds the channel to the listed of watched channels. - Returns an object, topic: the topic you tried to add, err: the error message, shard: the shard. 

getNonce() - if for whatever reasons you want a random string and you don't want to do it yourself !
