import redis from 'redis';
import config from './config.js';

const client = redis.createClient(config.redis).on('connect', () => {
    const server = `${config.redis.socket.host}:${config.redis.socket.port}`;
    console.log(`Redis connected to redis://${server}`);
});
await client.connect();

export default client;
