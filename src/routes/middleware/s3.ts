import * as Bluebird from 'bluebird';
import express from 'express';
import * as fs from 'fs';
import * as gmBase from 'gm';
import mime from 'mime';
import * as multer from 'multer';
import tempy from 'tempy';

import Upload from '../../service/s3';

const gm = gmBase.subClass({imageMagick: true});
const imgSizes = [512, 256, 128, 64, 32];

const multerConfig = {
    dest: './dist/public/uploads',
};

const uploadMiddleware = multer(multerConfig);
const asyncReadFile = Bluebird.promisify(fs.readFile);

function S3Middleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    const path = req.file.path;
    const regex = /(?:\.([^.]+))?$/;
    const regexResult = regex.exec(req.file.originalname);

    if (regexResult === null) throw new Error('Gagal membaca file.');

    const extension = regexResult[0];
    const key = req.file.filename + extension;
    const mimetype = mime.lookup(path);

    asyncReadFile(path)
    .then((data: any) => {
        return Upload(data, key, mimetype)
        .then((result: any) => {
            if (!req.kulakan || !req.kulakan.uploadImageKatalog) return result;

            return Bluebird.reduce(imgSizes, (_, imgSize) => {
                return new Promise((resolve, reject) => {
                    const nextName = `img${imgSize}/${key}`;
                    const randomFile = tempy.file();

                    try {
                        gm(path)
                        .resize(imgSize, imgSize)
                        .write(randomFile, err => {
                            if (err) {
                                reject();
                                return;
                            }

                            return asyncReadFile(randomFile)
                            .then((fileRead: any) => {
                                return Upload(fileRead, nextName, mimetype);
                            })
                            .then(() => {
                                resolve();
                                return;
                            });
                        });
                    } catch (e) {
                        reject();
                    }

                    return;
                })
                .catch(() => {
                    return;
                });
            }, {})
            .then(() => (result));
        });
    })
    .then((data: any) => {
        req.kulakan.uploads = data;
        return Bluebird.promisify(fs.unlink)(req.file.path);
    })
    .then(() => {
        next();
    });
}

export default (name: string) => {
    return [uploadMiddleware.single(name), S3Middleware];
};
