import fs from 'fs';
import fsAsync from 'fs/promises';
import fsExtra from 'fs-extra';
import formidable from 'formidable';
import canvas from 'canvas';
import config from './config.js';

const { createCanvas, loadImage, registerFont } = canvas;

registerFont(
    config.image.thumbnail.font.file, { family: 'Thumbnail' }
);

const image = {

    save: async (request, response, next) => {
        const form = formidable({
            maxFileSize: config.image.maxSize,
            multiples: config.image.multiples,
            hashAlgorithm: config.image.hash
        });
        form.parse(request, async (error, fields, files) => {
            console.log(fields)
            if (error) return next(new Error(error));
            const file = files.image;
            if (!(file.mimetype in config.image.types)) {
                return next(
                    new Error('Заборонений тип зображення ' + file.mimetype)
                );
            }
            const extension = config.image.types[file.mimetype];
            let directory = '/' + file.hash;
            for (const offset of [2, 1, 0]) {
                directory = '/' + file.hash[offset] + directory;
            }
            const image = await loadImage(file.filepath);
            const name = `/${image.width}x${image.height}.${extension}`;
            const path = directory + name;
            console.log(path);
            if (fs.existsSync(config.image.path + path)) {
                await fsAsync.unlink(file.filepath);
                return next(
                    new Error('Зображення вже існує' + path)
                );
            }
            await fsExtra.ensureDir(config.image.path + directory);
            await resize(image, directory, file.mimetype, extension);
            await fsExtra.move(file.filepath, config.image.path + path);
            if (fields?.title) {
                await thumbnail(image, directory, fields.title);
            }
            response.json({
                path: path,
                mimetype: file.mimetype,
                width: image.width,
                height: image.height,
                size: file.size
            });
        })
    },

    remove: async (request, response, next) => {
        let directory = '/' + request.params.hash;
        for (const offset of [2, 1, 0]) {
            directory = '/' + request.params.hash[offset] + directory;
        }
        if (!fs.existsSync(config.image.path + directory)) {
            return next(
                new Error('Відсутнє зображення' + directory)
            );
        }
        await fsAsync.rm(config.image.path + directory, {
            recursive: true, force: true
        });
        let parent = directory.slice(0, 6);
        for (let i = 0; i < 3; i ++) {
            const items = await fsAsync.readdir(config.image.path + parent);
            if (items.length > 0) break;
            await fsAsync.rmdir(config.image.path + parent);
            parent = parent.slice(0, -2);
        }
        response.end();
    },
/*
    index: async (request, response) => {
        const images = [];
        const offset = config.image.path.length + 7;
        await map(config.image.path, image => {
            images.push(image.substring(offset))
        });
        response.json(images);
    },
*/
/*
    resize: async (request, response) => {
        response.end(
            (await map(
                config.image.path,
                async (path, name) => {
                    await resize(
                        await loadImage(path + '/' + name)
                    , path)
                }
            )).toString()
        );
    },
*/
/*
    thumbnails: async (request, response) => {
        for await(const post of request.body) {
            const path = config.image.path
                + ['', post.image[1], post.image[2], post.image[3]].join('/')
                + post.image.substring(0, 33);
            const name = post.image.substring(33);
            await thumbnail(
                await loadImage(path + name),
            path, post.title)
        }
        response.end();
    }
*/
}

async function resize(image, directory, mimetype, extension) {
    for await(const width of config.image.widths) {
        if (width > image.width) return
        const name = width.toString() + '.' + extension;
        const path = directory + '/' + name;
        const height = Math.round(width / (image.width / image.height));
        const c = createCanvas(width, height);
        const ctx = c.getContext('2d');
        ctx.drawImage(image, 0, 0, width, height);
        await fsAsync.writeFile(config.image.path + path, c.toBuffer(
            mimetype, { quality: config.image.quality }
        ));
    }
}

async function thumbnail(image, path, title) {
    const s = {}, d = {};
    [d.width, d.height] = config.image.thumbnail.size;
    const c = createCanvas(d.width, d.height);
    const ctx = c.getContext('2d');
    s.ratio = image.width / image.height;
    d.ratio = d.width / d.height;
    if (s.ratio > d.ratio) {
        s.width = image.height / d.height * d.width;
        s.height = image.height;
    } else {
        s.width = image.width;
        s.height = image.width / d.width * d.height;
    }
    ctx.drawImage(image,
        (image.width - s.width) / 2,
        (image.height - s.height) / 2,
        s.width, s.height, 0, 0,
        d.width / config.image.thumbnail.scale,
        d.height / config.image.thumbnail.scale);
    //ctx.filter = 'blur(4px)';
    ctx.scale(config.image.thumbnail.scale, config.image.thumbnail.scale);
    ctx.drawImage(c, 0, 0, d.width, d.height);
    const c2 = createCanvas(d.width, d.height);
    const ctx2 = c2.getContext('2d');
    ctx2.drawImage(c, 0, 0, d.width, d.height);
    ctx2.font = config.image.thumbnail.font.size + " 'Thumbnail'";
    ctx2.textAlign = 'center';
    ctx2.textBaseline = 'middle';
    ctx2.shadowOffsetX = 1;
    ctx2.shadowOffsetY = 1;
    ctx2.shadowColor = 'black';
    ctx2.shadowBlur = 1;
    ctx2.fillStyle = config.image.thumbnail.font.color;
    ctx2.fillText(title, d.width / 2, d.height / 2);
    await fsAsync.writeFile(
        config.image.path + path + '/thumbnail.jpg',
        c2.toBuffer(
            'image/jpeg',
            { quality: config.image.thumbnail.quality }
        )
    );
}

async function map(path, callback, count = 0) {
    const items = await fsAsync.readdir(path);
    for await (const item of items) {
        const pathNew = path + '/' + item;
        if (item.length === 1) {
            count = await map(pathNew, callback, count);
        } else {
            await callback(pathNew,
                (await fsAsync.readdir(pathNew)).filter(file =>
                    file.match(/^\d+x\d+\.jpg$/)
                )[0]
            );
            count ++;
        }
    }
    return count;
}

export { image as default, resize, thumbnail, map}