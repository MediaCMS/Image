import fs from 'fs';
import fsa from 'fs/promises';
import fse from 'fs-extra';
import formidable from 'formidable';
import canvas from 'canvas';
import redis from './redis.js';
import cache from './cache.js';
import config from './config.js';

async function fetch(request, response, next) {
    const extension = request.params.slug.slice(
        request.params.slug.lastIndexOf('.')
    );
    const data = await redis.hGetAll(request.params.slug);
    if (!data?.hash) return response.sendStatus(404);
    data.width = parseInt(data.width);
    data.height = parseInt(data.height);

    let path = '';
    path += '/' + data.hash.slice(0, 2);
    path += '/' + data.hash.slice(2, 4);
    path += '/' + data.hash.slice(4, 6);
    path += '/' + data.hash + '/';

    if (request.query?.width) {
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
                const height = width / (data.width / data.height);
                if (height > data.height) break;
                delta.new = Math.abs(query.height - height);
            } else {
                if (width > data.width) break;
                delta.new = Math.abs(query.width - width);
            }
            if (delta.new > delta.old) break;
            delta.old = delta.new
        }
        path += config.image.widths[i-1] + extension;
    } else {
        path += 'original' + extension;
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
        if (error) return next(
            new Error(`Помилка завантаження файлу (${error})`)
        );
        const file = files.image;
        if (!(file.mimetype in config.image.types)) return next(
            new Error(`Заборонений тип зображення (${file.mimetype})`)
        );
        const extension = config.image.types[file.mimetype];
        let path = '';
        for (const i of [0, 2, 4]) {
            path += '/' + file.hash.substring(i, i + 2);
        }
        path += '/' + file.hash;
        if (fs.existsSync(config.image.path + path)) {
            await fsa.unlink(file.filepath);
            return next(
                new Error(`Зображення вже існує (${path})`)
            );
        }
        const original = path + '/original.' + extension;
        await fse.move(file.filepath, config.image.path + original);
        const image = await canvas.loadImage(config.image.path + original);
        const ratio = image.width / image.height;
        for (const width of config.image.widths) {
            if (width > image.width) break;
            const name = path + '/' + width.toString() + '.' + extension;
            const height = Math.round(width / ratio);
            const c = canvas.createCanvas(width, height);
            const ctx = c.getContext('2d');
            ctx.drawImage(image, 0, 0, width, height);
            await fsa.writeFile(config.image.path + name, c.toBuffer(
                file.mimetype, { quality: config.image.quality }
            ));
        }
        await redis.hSet(request.params.slug, {
            hash: file.hash,
            width: image.width,
            height: image.height
        });
        response.json({
            path: path,
            mimetype: file.mimetype,
            width: image.width,
            height: image.height,
            size: file.size
        });
    })
}

async function rename(request, response) {
    const data = await redis.hGetAll(request.params.slug);
    if (!data?.hash) return response.sendStatus(404);
    redis.rename(request.params.slug, request.query.slug);
    response.end();
}

async function remove(request, response, next) {
    const data = await redis.hGetAll(request.params.slug);
    if (!data?.hash) return response.sendStatus(404);
    let path = '';
    for (const i of [0, 2, 4]) {
        path += '/' + data.hash.slice(i, i + 2);
    }
    path += '/' + data.hash;
    if (!fs.existsSync(config.image.path + path)) return next(
        new Error(`Зображення відсутнє (${path})`)
    )
    await fsa.rm(config.image.path + path, {
        recursive: true, force: true
    });
    let parent = path.substring(0, 9);
    for (let i = 0; i < 3; i ++) {
        const items = await fsa.readdir(config.image.path + parent);
        if (items.length > 0) break;
        await fsa.rmdir(config.image.path + parent);
        parent = parent.substring(0, parent.length - 3);
    }
    redis.del(request.params.slug);
    response.end();
}

export default { fetch, save, rename, remove }