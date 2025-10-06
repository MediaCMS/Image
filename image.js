import fsa from 'fs/promises';
import fse from 'fs-extra';
import formidable from 'formidable';
import canvas from 'canvas';
import redis from './redis.js';
import cache from './cache.js';

import config from './config.js';

const types = {};
Object.entries(config.image.types)
.forEach(type => types[type[1]] = type[0])

const hashToPath = hash => {
    let path = '/';
    for (const i of [0, 2, 4]) {
        path += hash.substring(i, i + 2) + '/'
    }
    path += hash + '/';
    return path
}

const parseForm = async request => {
    const form = formidable({
        maxFileSize: config.image.maxSize,
        multiples: config.image.multiples,
        hashAlgorithm: config.image.hash
    });
    return new Promise((resolve, reject) => {
        form.parse(request, (error, fields, files) => {
            if (error) return reject(error);
            resolve({ fields, files });
        });
    });
}

const fetch = async (request, response) => {
    const [hash, extension] = request.params.name.split('.');
    let path = hashToPath(hash);
    let file = `${config.image.widths[0]}.${extension}`;
    let original = (await redis.get(request.params.name));
    if (!original) return response.sendStatus(404);
    original = original.split('x');
    original = {
        width: parseInt(original[0]),
        height: parseInt(original[1])
    }
    if (original.width < config.image.widths[0]) {
        file = `original.${extension}`;
    } else if (request.query?.width) {
        let i, width, height, query = {
            width: parseInt(request.query.width)
        };
        if (request.query?.height) {
            query.height = parseInt(request.query.height);
        }
        for (i = 0; i < config.image.widths.length; i ++) {
            width = config.image.widths[i]
            if (query?.height
                && (query.height > query.width)) {
                height = width / (original.width / original.height);
                if (height > original.height) {
                    if (i > 0) width = config.image.widths[i-1];
                    break;
                }
                if (height > query.height) break;
            } else {
                if (width > original.width) {
                    if (i > 0) width = config.image.widths[i-1];
                    break;
                };
                if (width > query.width) break;
            }
        }
        file = width + '.' + extension;
    }
    path += file;
    response.set('Content-Type', types[extension]);
    if (cache.has(path)) {
        const blob = cache.get(path)
        response.set('Content-Length', blob.length);
        response.end(blob)
    } else {
        const blob = await fsa.readFile(config.image.path + path);
        response.set('Content-Length', blob.length);
        response.end(blob);
        cache.set(path, blob);
    }
}

const save = async (request, response, next)  =>  {
    const files = (await parseForm(request)).files;
    let image = { width: 0, height: 0 };
    /*
    if (error) return next(
        new Error(`Помилка завантаження файлу (${error})`)
    );
    */
    const file = files.image[0];
    if (!file.size) return next(
        new Error('Порожній файл зображення')
    );
    if (!(file.mimetype in config.image.types)) return next(
        new Error('Заборонений тип зображення ' + file.mimetype)
    );
    const extension = config.image.types[file.mimetype];
    const key = file.hash + '.' + extension;
    const cached = await redis.get(key);
    try {
        if (cached) {
            [image.width, image.height] = cached.split('x');
            await fse.remove(file.filepath);
        } else {
            let path = hashToPath(file.hash);
            const original = path + 'original.' + extension;
            await fse.move(
                file.filepath,
                config.image.path + original,
                { overwrite: true }
            );
            image = await canvas.loadImage(config.image.path + original);
            await redis.set(key, image.width + 'x' + image.height);
            const ratio = image.width / image.height;
            for (const width of config.image.widths) {
                if (width > image.width) break;
                const name = path + width + '.' + extension;
                const height = Math.round(width / ratio);
                const canvasInstance = canvas.createCanvas(width, height);
                const context = canvasInstance.getContext('2d');
                context.drawImage(image, 0, 0, width, height);
                const buffer = canvasInstance.toBuffer(
                    file.mimetype, { quality: config.image.quality }
                )
                if (buffer) {
                    await fsa.writeFile(config.image.path + name, buffer);
                } else {
                    console.log('file.mimetype', file.mimetype);
                    if (file.mimetype !== 'image/gif') {
                        throw Error('Undefined image buffer')
                    }
                }
            }
        }
        response.json({
            name: key, width: image.width, height: image.height
        });
    } catch (error) {
        delete files.image._writeStream;
        console.log(key, image, files.image)
        return next(error)
    }
}

const modify = async (request, response) => {
    console.log('modify', request.params.name, request.body.title)
    response.end();
}

const remove = async (request, response) => {
    const cached = await redis.get(request.params.name);
    if (!cached) return response.sendStatus(404);
    let path = hashToPath(request.params.name.substring(0, 32));
    await fsa.rm(config.image.path + path, { recursive: true, force: true });
    let parent = path.substring(0, 9);
    for (let i = 0; i < 3; i ++) {
        const items = await fsa.readdir(config.image.path + parent);
        if (items.length > 0) break;
        await fsa.rmdir(config.image.path + parent);
        parent = parent.substring(0, parent.length - 3);
    }
    redis.del(request.params.name);
    response.end();
}

export default { fetch, save, modify, remove }