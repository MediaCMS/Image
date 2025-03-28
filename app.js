import process from 'process';
import express from 'express';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import redis from './redis.js';
import image from './image.js';
import config from './config.js';
import log from './log.js';

const app = express();
const server = app.listen(config.port, config.ip, () => {
    const server = `${config.ip}:${config.port} [${app.get('env')}]`;
    console.log(`HTTP server started at ${server}`);
});

app.use(cookieParser());
app.use(cors(config.cors));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(config.public));

if (app.get('env') === 'production') {
    app.set('trust proxy', 1);
}

const verification = (request, response, next) => {
    if (request.cookies?.token) {
        try {
            response.locals.user = jwt.verify(
                request.cookies.token, config.key
            );
        } catch (error) {
            return response.status(403).end(error);
        }
    } else {
        return response.sendStatus(401);
    }
    next();
}

app.get('/:name', image.fetch);
app.post('/', verification, image.save);
app.delete('/:name', verification, image.remove);

app.use(async (error, request, response, next) => {
    console.error(error);
    if (response.headersSent) return next(error);
    const output = { name: error.name }
    Object.getOwnPropertyNames(error)
        .forEach(name => output[name] = error[name]);
    response.status(500).json(output);
    log(error);
})

process.on('unhandledRejection', async (error) => {
    console.error('Unhandled Rejection', error);
    log(error);
})

process.on('SIGINT', async () => {
    console.log('\nSIGINT signal received')
    redis.disconnect();
    server.close();
    console.log(`HTTP server closed`);
    process.exit(0);
})