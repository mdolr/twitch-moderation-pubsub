'use strict';

const WebSocket = require('ws'),
    EventEmitter = require('events'),
    URL = 'wss://pubsub-edge.twitch.tv';

/**
 * A pubsub client that handles up to 50 channels.
 * Inspired by : https://github.com/Fuechschen/twitch-realtime
 */

class Shard extends EventEmitter {

    /**
     * @param {ShardingManager} manager         The sharding manager that spawned the shard
     * @param {Object}          options         An object containing the following options
     * @param {Number}          options.id      The index of the shard for loop
     * @param {String}          options.mod_id  The id of the user used by the pubsub system
     * @param {String}          options.nonce   A nonce to use when connecting to the pubsub system
     * @param {String}          options.token   Token to use while connecting to the pubsub system
     * @param {Array}           options.topics  Topics to listen when connecting to the pubsub system
     * @param {Boolean}         options.full    Whether the shard has 50 topics or less
     */

    constructor(manager, options) {
        super();

        this.manager = manager;
        this.options = options;
        this.fetchMessage = false;
        this.tries = 0;
        this.lastTry = Date.now();
        this.lastMessage = {};

        this.validateTopics().then(() => {
            this.connect();
        });
    }

    //Replace each topic with the correct pubsub topic : chat_moderator_actions.moderator_id.channel_id.
    validateTopics() {
        let promise = new Promise(resolve => {
            for (let i = 0; i <= this.options.topics.length; i++) {
                i == this.options.topics.length ? resolve() : this.options.topics[i] = `chat_moderator_actions.${this.options.mod_id}.${this.options.topics[i]}`;
            }
        });
        return promise;
    }

    //Called by the ShardManager to add topics.
    add(topic) {

        /**
         * @param {String} topic A twitch channel id to listen events on.
         */

        let promise = new Promise((resolve, reject) => {

            if (this.options.topics.length < 50) {
                if (this.options.topics.includes(`chat_moderator_actions.${this.options.mod_id}.${topic}`)) {
                    resolve({
                        topic,
                        err: 'success',
                        shard: this
                    });
                } else {
                    let temporary = [...this.options.topics, `chat_moderator_actions.${this.options.mod_id}.${topic}`];
                    this.ws.send(JSON.stringify({
                        type: 'LISTEN',
                        nonce: this.options.nonce,
                        data: {
                            topics: temporary,
                            auth_token: this.options.token
                        }
                    }));
                    this.fetchMessage = true;


                    //Wait 1.5 second before resolving the function to get the response
                    setTimeout(() => {
                        if (this.lastMessage.error != null) {

                            //If error return the error
                            if (this.lastMessage.error != '') {
                                reject({
                                    topic,
                                    err: this.lastMessage.error,
                                    shard: this
                                });
                            }

                            //Else topic has been added.
                            else {
                                this.options.topics.push(`chat_moderator_actions.${this.options.mod_id}.${topic}`);
                                this.options.full = (this.options.topics.length >= 50);
                                resolve({
                                    topic,
                                    err: 'success',
                                    shard: this
                                });
                            }
                        }

                        //If lastMessage is still null after 1 second
                        else {
                            reject({
                                topic,
                                err: 'no_response',
                                shard: this
                            });
                        }

                        setTimeout(() => {
                            this.lastMessage = {};
                        }, 100);
                    }, 1.5 * 1000);
                }

                //More than 50 topics on shard.
            } else reject({
                topic,
                err: 'shard_full',
                shard: this
            });

        });
        return promise;
    }



    connect() {
        this.ws = new WebSocket(URL);

        this.ws.on('open', () => {
            this.ws.send(JSON.stringify({
                type: 'LISTEN',
                nonce: this.options.nonce,
                data: {
                    topics: this.options.topics,
                    auth_token: this.options.token
                }
            }));
            this.emit('ready', this);
        });


        this.ws.on('close', () => {
            if (Date.now() - this.lastTry < 60000) {
                this.tries += 1;
                this.lastTry = Date.now();
            } else this.tries = 0;
            setTimeout(() => {
                if (this.tries < 4) this.connect();
                else {
                    this.emit('disconnected', 'Shard failed to reconnect.');
                }
            }, 5000);
        });

        //Heartbeat keepAlive interval.
        setInterval(() => {
            this.ws.send(JSON.stringify({
                type: 'PING'
            }));
        }, 250 * 1000);


        this.ws.on('message', m => {

            try {
                let message = JSON.parse(m);
                if (message.type == 'RESPONSE' && this.fetchMessage) {
                    this.lastMessage = message;
                    this.fetchMessage = false;
                }
            } catch (e) {
                if (e.message != null) console.log(e);
            }

            this.emit('message', this, m);

        });
    }
}

module.exports = Shard;
