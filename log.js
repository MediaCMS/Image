import fs from 'fs';
import config from './config.js';

const logStream = fs.createWriteStream(
    config.log, { flags: 'a' }
);

const log = data => {
    let message = (new Date()).toISOString() + '  ';
    if (data instanceof Error) {
        message += `${data.name} ${data.message}\n`;
        if (data?.stack) {
            message += `${data?.stack}\n`;
        }
    } else {
        message += `${data}\n`;
    }
    logStream.write(message);
}

export default log;