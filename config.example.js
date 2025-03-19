const root = '/var/www/mediacms/image';

export default {
    ip: '127.0.1.3',
    port: 8888,
    root: root,
    public: root + '/public',
    key: '', // private access key (x-api-key)
    cors: {
        origin: 'https://panel.example.com',
        optionsSuccessStatus: 200
    },
    redis: {
        socket: {
            host: 'localhost',
            port: 6379,
            connectTimeout: 3000,
            keepAlive: 3000
        },
        database: null,
        username: null,
        password: null
    },
    cache: {
        max: 1_024,
        maxSize: 1 * 1_024 ** 3,
        maxEntrySize: 1 * 1_024 ** 2
    },
    image: {
        path: root + '/images',
        widths: [
            320, 480, 640, 800, 960, 1280, 1600, 1920, 2560, 3840
        ],
        types: {
            'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif'
        },
        maxSize: 1 * 1_024 ** 2,
        multiples: true,
        quality: 0.8,
        hash: 'md5'
    },
    mode: 'development',
    log: root + '/log'
}