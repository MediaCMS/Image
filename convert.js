import fs from 'fs/promises';
import fse from 'fs-extra';
import config from './config.js';

const source = config.root + '/images~';
/*
(async () => {
  const index = await fs.open(source + '/index');

  for await (const path of index.readLines()) {
    const hash = path.slice(7, 39);
    const name = path.slice(40);
    let pathNew = config.image.path + '/';
    for (let i = 0; i < 6; i += 2) {
        pathNew += hash.slice(i, i + 2) + '/'
    }
    pathNew += hash;
    await fse.ensureDir(pathNew);
    pathNew += '/' + (/\d+x\d+\.jpg/.test(name) ? 'original.jpg' : name)
    console.log(pathNew);
    await fse.copy(source + path, pathNew);
    //break
  }
  
  index.close();
})();
*/