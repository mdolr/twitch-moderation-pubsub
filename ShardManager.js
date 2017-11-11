'use strict';

const Shard = require('./Shard.js');
const EventEmitter = require('events');

class ShardingManager extends EventEmitter {

    /**
     * @param {Object} options         An object containing the following options
     * @param {String} options.token   Token to use while connecting to the pubsub system
     * @param {String} options.mod_id  The id of the user used by the pubsub system
     * @param {Array}  options.topics  Topics to listen when connecting to the pubsub system
     * @param {Number} options.limit   Limit of topics per shard
     */

    constructor(options) {
        super();

        this.started = false;
        this.options = options;
        this.options.limit = options.limit || 30;
        this.shards = new Map();
        this.temporaryTopics = this.options.topics;
        this.spawn();
    }

    // A random nonce is needed to connect the shard.
    getNonce() {

        let nonce = '';
        let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

        for (var i = 0; i < 9; i++)
            nonce += possible.charAt(Math.floor(Math.random() * possible.length));

        return nonce;
    }

    // For each [LIMIT] topics spawns a new shard.
    spawn() {
        let spawning = setInterval(() => {
            let topics = this.temporaryTopics.slice(0, this.options.limit);
            this.connect(topics);

            if (this.temporaryTopics.length <= this.options.limit) {
                clearInterval(spawning);
            } else {
                console.log(this.temporaryTopics.length)
                this.temporaryTopics = this.temporaryTopics.slice(this.options.limit);
                console.log(this.temporaryTopics.length)
            }

        }, 2.5 * 1000);
    }

    // Connects a shard
    connect(topics) {
        let nonce = this.getNonce(),
            id = this.shards.size,
            options = {
                id,
                topics,
                mod_id: this.options.mod_id,
                token: this.options.token,
                nonce: nonce,
                full: topics.length >= this.options.limit,
                limit: this.options.limit
            },

            shard = new Shard(this, options);
        this.shards.set(id, shard);

        shard.on('ready', shard => {
            if (!shard.full && !this.started) {
                this.started = true;
                this.emit('ready');
            }
            this.emit('shard-ready', shard);
        });

        shard.on('message', (shard, message) => {
            this.emit('debug', message, shard);

            try {
                message = JSON.parse(message);

                // If there is an error.
                if (message.type == 'RESPONSE' && message.error != '') {
                    this.emit('error', message, shard);
                }

                // If the response is a pong.
                else if (message.type == 'PONG') {
                    this.emit('pong', shard);
                }

                // If the response is a mod action.
                else {

                    if (message.data != null) {
                        if (message.data.topic.startsWith('chat_moderator_actions')) {

                            let m = JSON.parse(message.data.message),
                                data = m.data;

                            if (['timeout', 'unban', 'ban'].includes(data.moderation_action.toLowerCase())) {
                                let obj = {
                                    channel_id: message.data.topic.split('.')[2],
                                    type: data.moderation_action,
                                    moderator: {
                                        id: data.created_by_user_id,
                                        name: data.created_by
                                    },
                                    target: {
                                        id: data.target_user_id,
                                        name: data.args[0]
                                    },
                                    reason: '',
                                    duration: '',
                                    created_at: new Date().getTime()
                                };

                                if (data.moderation_action == 'ban' || data.moderation_action == 'unban') {
                                    obj.reason = data.args[1] || null;
                                    obj.duration = 'permanent';
                                    this.emit(data.moderation_action, obj, shard);
                                } else {
                                    obj.reason = data.args[2] || null;
                                    obj.duration = parseInt(data.args[1], 10);
                                    this.emit('timeout', obj, shard);
                                }

                            } else if (['subscribers', 'subscribersoff', 'r9kbeta', 'r9kbetaoff', 'clear', 'emoteonly', 'emoteonlyoff', 'followersoff', 'followers', 'slow', 'slowoff'].includes(data.moderation_action.toLowerCase())) {
                                let obj = {
                                    channel_id: message.data.topic.split('.')[2],
                                    type: data.moderation_action,
                                    moderator: {
                                        id: data.created_by_user_id,
                                        name: data.created_by
                                    },
                                    duration: data.args ? data.args[0] ? parseInt(data.args[0], 10) : null : null,
                                    created_at: new Date().getTime()
                                };

                                this.emit(data.moderation_action.replace('beta', ''), obj, shard);

                            } else if (['mod', 'unmod'].includes(data.moderation_action.toLowerCase())) {
                                let obj = {
                                    channel_id: message.data.topic.split('.')[2],
                                    type: data.moderation_action,
                                    moderator: {
                                        id: data.created_by_user_id,
                                        name: data.created_by
                                    },
                                    target: {
                                        id: data.target_user_id,
                                        name: data.args[0]
                                    },
                                    created_at: new Date().getTime()
                                };

                                this.emit(data.moderation_action, obj, shard);

                            }
                        } else this.emit('message', message, shard);
                    }
                }

            } catch (e) {
                this.emit('debug', e, this.options); //Response is an invalid JSON.
            }
        });
    }

    // Method used to add a topic to the last shard.
    addTopic(topic) {

        let promise = new Promise((resolve, reject) => {
            let already = this.options.topics.filter((elm) => { return elm.includes(topic); });

            if (already.length > 0) {
                resolve({ topic, err: 'success', shard: null });

            } else {
                let last_shard = this.shards.get(this.shards.size - 1);

                last_shard
                    .add(topic)
                    .then(response => {
                        this.shards.set(response.shard.options.id, response.shard);
                        this.options.topics.push(topic);
                        resolve(response);
                    })
                    .catch(response => {
                        if (response.err == 'shard_full') this.connect(topic);
                        else reject(response);
                    });

            }
        });

        return promise;
    }
}

module.exports = ShardingManager;