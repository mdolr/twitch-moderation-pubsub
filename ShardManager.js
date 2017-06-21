'use strict';

const Shard = require('./Shard.js');
const EventEmitter = require('events');

let shards = new Map();

class ShardingManager extends EventEmitter {

    /**
     * @param {Object} options         An object containing the following options
     * @param {String} options.token   Token to use while connecting to the pubsub system
     * @param {String} options.mod_id  The id of the user used by the pubsub system
     * @param {Array}  options.topics  Topics to listen when connecting to the pubsub system
     */

    constructor(options) {
        super();

        this.started = false;
        this.options = options;
        this.lastShard = -1;
        this.spawn();
    }

    //A random nonce is needed to connect the shard.
    getNonce() {

        /**
         * @return {String} nonce returns a string of random characters.
         */

        let nonce = '';
        let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

        for (var i = 0; i < 9; i++)
            nonce += possible.charAt(Math.floor(Math.random() * possible.length));

        return nonce;
    }

    //For each 50 topics spawns a new shard.
    spawn() {
        let spawning = setInterval(() => {
            let topics = this.options.topics.slice(0, 50);
            this.connect(topics);
            this.lastShard++;
            if (this.options.topics.length <= 50) {
                clearInterval(spawning);
            } else {
                this.options.topics = this.options.topics.slice(50, this.options.topics.length);
            }

        }, 2.5 * 1000);
    }

    //Connects a shard
    connect(topics) {
        let nonce = this.getNonce(),
            id = shards.size,
            options = {
                id,
                topics,
                mod_id: this.options.mod_id,
                token: this.options.token,
                nonce: nonce,
                full: topics.length >= 50
            },

            shard = new Shard(this, options);
        shards.set(id, shard);

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

                //If there is an error.
                if (message.type == 'RESPONSE' && message.error != '') {
                    this.emit('error', shard, message);
                }

                //If the response is a pong.
                else if (message.type == 'PONG') {
                    this.emit('pong', shard);
                }

                //If the response is a mod action.
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
                                    obj.reason = data.args[1] || 'undefined';
                                    obj.duration = 'permanent';
                                    this.emit(data.moderation_action, shard, obj);
                                } else {
                                    obj.reason = data.args[2] || 'undefined';
                                    obj.duration = data.args[1];
                                    this.emit('timeout', shard, obj);
                                }

                            }
                        } else this.emit('message', shard, message);
                    }
                }

            } catch (e) {
                this.emit('debug', e, this.options); //Response is an invalid JSON.
            }
        });
    }

    //Method used to add a topic to the last shard.
    addTopic(topic) {

        /**
         * @param {String} topic A twitch channel ID to listen.
         */

        let promise = new Promise((resolve, reject) => {

            let last_shard = shards.get(shards.size - 1);
            last_shard.add(topic).then(response => {
                resolve(response);
                shards.set(response.shard.id, response.shard);
            }).catch(response => {
                if (response.err == 'shard_full') this.connect(topic);
                else reject(response);
            });

        });

        return promise;
    }
}

module.exports = ShardingManager;
