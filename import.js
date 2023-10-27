import fs from 'fs/promises';
import redis from 'redis';
import canvas from 'canvas';
import config from './config.js';
  
const { loadImage } = canvas;

const client = redis.createClient();
await client.connect();

const index = await fs.open(config.image.path + '/index');
/*
for await (const path of index.readLines()) {
    const image = await loadImage(config.image.path + path);
    const hash = path.slice(10, 42);
    const key = hash + '.jpg';
    const value = {
        hash: hash,
        width: image.width,
        height: image.height
    }
    await client.hSet(key, value);
    //console.log({ ...await client.hGetAll(key)});
    //break
}
*/
index.close();
client.disconnect();
