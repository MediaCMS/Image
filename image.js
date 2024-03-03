import fsa from 'fs/promises';
import fse from 'fs-extra';
import formidable from 'formidable';
import canvas from 'canvas';
import redis from './redis.js';
import cache from './cache.js';
import config from './config.js';

const hashToPath = hash => {
    let path = '/';
    for (const i of [0, 2, 4]) {
        path += hash.substring(i, i + 2) + '/'
    }
    path += hash + '/';
    return path
}

async function fetch(request, response, next) {
    let value = (await redis.get(request.params.name));
    if (!value) return response.sendStatus(404);
    const [hash, extension] = request.params.name.split('.');
    let path = hashToPath(hash);
    if (request.query?.width) {
        value = value.split('x');
        value = {
            width: parseInt(value[0]),
            height: parseInt(value[1])
        }
        let i, delta = { old: Infinity, new: 0 }, query = {
            width: parseInt(request.query.width)
        };
        if (request.query?.height) {
            query.height = parseInt(request.query.height);
        }
        for (i = 0; i < config.image.widths.length; i ++) {
            const width = config.image.widths[i]
            if (query?.height
                && (query.height > query.width)) {
                const height = width / (value.width / value.height);
                if (height > value.height) break;
                delta.new = Math.abs(query.height - height);
            } else {
                if (width > value.width) break;
                delta.new = Math.abs(query.width - width);
            }
            if (delta.new > delta.old) break;
            delta.old = delta.new
        }
        path += config.image.widths[i-1] + '.' + extension;
    } else {
        path += 'original.' + extension;
    }

    if (cache.has(path)) {
        response.end(cache.get(path))
    } else {
        const file = await fsa.readFile(config.image.path + path);
        response.end(file);
        cache.set(path, file);
    }
}

async function save(request, response, next) {
    const form = formidable({
        maxFileSize: config.image.maxSize,
        multiples: config.image.multiples,
        hashAlgorithm: config.image.hash
    });
    form.parse(request, async (error, fields, files) => {
        let image = { width: 0, height: 0 };
        if (error) return next(
            new Error(`Помилка завантаження файлу (${error})`)
        );
        const file = files.image;
        if (!(file.mimetype in config.image.types)) return next(
            new Error('Заборонений тип зображення')
        );
        const extension = config.image.types[file.mimetype];
        const key = file.hash + '.' + extension;
        const value = await redis.get(key);
        if (value) {
            [image.width, image.height] = value.split('x');
        } else {
            let path = hashToPath(file.hash);
            const original = path + 'original.' + extension;
            await fse.move(file.filepath, config.image.path + original);
            image = await canvas.loadImage(config.image.path + original);
            const ratio = image.width / image.height;
            for (const width of config.image.widths) {
                if (width > image.width) break;
                const name = path + width + '.' + extension;
                const height = Math.round(width / ratio);
                const c = canvas.createCanvas(width, height);
                const ctx = c.getContext('2d');
                ctx.drawImage(image, 0, 0, width, height);
                await fsa.writeFile(config.image.path + name, c.toBuffer(
                    file.mimetype, { quality: config.image.quality }
                ));
            }
            await redis.set(key, image.width + 'x' + image.height);
        }
        response.json({
            name: key, width: image.width, height: image.height
        });
    })
}

async function remove(request, response) {
    const value = await redis.get(request.params.name);
    if (!value) return response.sendStatus(404);
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

export default { fetch, save, remove }