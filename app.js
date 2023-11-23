import express from 'express';
import cors from 'cors';
import redis from './redis.js';
import image from './image.js';
import config from './config.js';
//import log from './log.js';

const app = express();
const server = app.listen(config.port, config.ip, () => {
    const server = `${config.ip}:${config.port} [${app.get('env')}]`;
    console.log(`HTTP server started at ${server}`);
});
const router = express.Router();

app.use(cors(config.cors));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(config.public));

if (app.get('env') === 'production') {
    app.set('trust proxy', 1);
}

app.get('/:name', image.fetch);
app.use(function(request, response, next) {
    if (request.headers['x-api-key'] !== config.key) { 
        //log(`HTTP 403 Forbidden (${request.originalUrl})`);
        return response.sendStatus(403);
    }
    next();
});
app.post('/:slug', image.save);
app.patch('/:slug', image.rename);
app.delete('/:slug', image.remove);

app.use(async (error, request, response, next) => {
    console.error(error);
    if (response.headersSent) return next(error);
    const output = { name: error.name }
    Object.getOwnPropertyNames(error)
        .forEach(name => output[name] = error[name]);
    response.status(500).json(output);
    //await log(error);
})

process.on('unhandledRejection', async (error) => {
    console.error('Unhandled Rejection', error);
    //await log(error);
//    process.exit(1);
})

process.on('SIGINT', async () => {
    console.log('\nSIGINT signal received')
    redis.disconnect();
    server.close();
    console.log(`HTTP server closed`);
    process.exit(0);
})
