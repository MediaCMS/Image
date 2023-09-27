const root = '/var/www/mediacms/image';

export default {
    ip: '127.0.1.4',
    port: 8888,
    path: '/api',
    root: root,
    key: '', // x-api-key
    cors: {
        origin: 'https://panel.example.com',
        optionsSuccessStatus: 200
    },
    session: {
        name: 'sessionId',
        maxAge: (60 * 60 * 24 * 1_000),
        secret: '',
        keys: ['', '']
    },
    image: {
        path: root + '/public',
        widths: [320, 480, 640, 800, 960, 1280, 1600, 1920, 2560, 3840],
        types: { 'image/jpeg': 'jpg' },
        maxSize: 1 * 1024 ** 2,
        multiples: true,
        quality: 0.8, // compression
        hash: 'md5',
        thumbnail: {
            size: [960, 540],
            quality: 0.5, // compression
            scale: 2,
            font: {
                color: '#fff',
                size: '128px',
                file: root + '/fonts/Lora-Bold.ttf'
            }
        }
    },
    mode: 'development',
    log: root + 'log'
}
