import express from 'express';
import cookieSession from 'cookie-session';
import cors from 'cors';
import image from './image.js';
import config from './config.js';
import log from './log.js';

const app = express();
const server = app.listen(config.port, config.ip, () => {
    console.log(`HTTP server started [${app.get('env')}]`);
    console.log(`Listening at ${config.ip}:${config.port}`);
});
const router = express.Router();
const session = cookieSession(config.session);

app.use(cors(config.cors));
app.use(session);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(config.image.path));

app.use(function(request, response, next) {
    if (request.headers['x-api-key'] !== config.key) { 
        log(`HTTP 403 Forbidden (${request.originalUrl})`);
        return response.sendStatus(403);
    }
    request.url = decodeURI(request.url);
    next();
});

if (app.get('env') === 'production') {
    app.set('trust proxy', 1);
}

//router.get('/', image.index);
router.post('/', image.save);
router.delete('/:hash', image.remove);
//router.patch('/thumbnails', image.thumbnails);
//router.patch('/resize', image.resize);

app.use(config.path, router);

app.use(async (error, request, response, next) => {
    console.error(error);
    if (response.headersSent) return next(error);
    const output = { name: error.name }
    Object.getOwnPropertyNames(error)
        .forEach(name => output[name] = error[name]);
    response.status(500).json(output);
    await log(error);
})

process.on('unhandledRejection', async (error) => {
    console.error('Unhandled Rejection', error);
    await log(error);
//    process.exit(1);
})

process.on('SIGINT', async () => {
    console.log('\nSIGINT signal received')
    server.close();
    console.log(`HTTP server closed`);
    process.exit(0);
})
