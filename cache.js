import { LRUCache } from 'lru-cache';
import config from './config.js';

export default new LRUCache({
    ...config.cache,
    sizeCalculation: value => {
            return Buffer.byteLength(value);
    }
});