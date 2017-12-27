import * as Bluebird from 'bluebird';
import express from 'express';

import { KatalogPriceListed, KatalogPriceUnlisted, WSDelete, WSImageUpdate, WSUpdate } from '../../model/katalog';
import Sellers from '../../model/sellers';
import { ChangeImageUrl } from '../../service/image';
import { CleanQuery } from '../../util/obj';
import { IsOptional, IsParseNumber, IsString, Middleware } from '../../util/validation';

import { ParseLimitOffset } from '../middleware/helper';
import S3Middleware from '../middleware/s3';

function KatalogListed(req: express.Request, res: express.Response, next: express.NextFunction) {
    const {user, params} = req.kulakan;
    const {filter, category, noImage, price} = req.query;

    const queryParams = {
        category: CleanQuery(category),
        name: CleanQuery(filter),
        noImage: CleanQuery(noImage) !== undefined && CleanQuery(noImage) !== '',
        price: CleanQuery(price),
        limit: params.limit,
        offset: params.offset,
    };

    return KatalogPriceListed(user.id, queryParams)
    .then(result => {
        res.send({
            count: result.count,
            items: result.items.map(item => ChangeImageUrl(item)).map(item => {
                item.prices = item.prices || [];
                return item;
            }),
        });
    });
}

function KatalogUnlisted(req: express.Request, res: express.Response, next: express.NextFunction) {
    const {user, params} = req.kulakan;
    const {filter, category} = req.query;

    const queryParams = {
        category: CleanQuery(category),
        name: CleanQuery(filter),
        limit: params.limit,
        offset: params.offset,
    };

    return KatalogPriceUnlisted(user.id, queryParams)
    .then(result => {
        res.send({
            count: result.count,
            items: result.items.map(item => ChangeImageUrl(item)),
        });
    });
}

const specsForUpdate = {
    body: {
        name: IsOptional(IsString),
        category: IsOptional(IsString),
        description: IsOptional(IsString),
        image: IsOptional(IsString),
        itemID: IsOptional(IsParseNumber),
        prices: IsOptional([{
            unit: IsString,
            prices: [IsParseNumber],
        }]),
    },
};

function Update(req: express.Request, res: express.Response, next: express.NextFunction) {
    const { user } = req.kulakan;
    const katalogWsID: string = req.params.id;
    const { name, category, description, image, itemID, prices } = req.body;

    return Bluebird.try((): any => {
        if (katalogWsID === undefined) {
            if (name === undefined || category === undefined || prices.length === 0) {
                throw new Error('Data tidak lengkap');
            }
        }

        return WSUpdate(user.id, katalogWsID,
            {name, category, image, prices, description, itemID});
    })
    .then(() => {
        return Sellers.MarkNeedSync(user.id);
    })
    .then(() => {
        res.send({ status: 'Data telah tersimpan' });
    });
}

function Upload(req: express.Request, res: express.Response, next: express.NextFunction) {
    const {user, uploads} = req.kulakan;
    return WSImageUpdate(user.id, parseInt(req.params.id, 10), uploads.Location)
    .then(() => {
        res.send({image: uploads.Location});
    });
}

function PreUpload(req: express.Request, res: express.Response, next: express.NextFunction) {
    req.kulakan.uploadImageKatalog = true;
    next();
}

function Delete(req: express.Request, res: express.Response, next: express.NextFunction) {
    const { user } = req.kulakan;
    return WSDelete(user.id, parseInt(req.params.id, 10))
    .then(() => {
        res.send({ status: 'Delete sukses.' });
    });
}

export default {
    get: [
        ['/', ParseLimitOffset, KatalogListed],
        ['/notListed', ParseLimitOffset, KatalogUnlisted],
    ],
    post: [
        ['/create', Middleware(specsForUpdate), Update],
        ['/:id(\\d+)/delete', Delete],
        ['/:id(\\d+)/update', Middleware(specsForUpdate), Update],
        ['/:id(\\d+)/upload-image', PreUpload, ...S3Middleware('image'), Upload],
    ],
};
