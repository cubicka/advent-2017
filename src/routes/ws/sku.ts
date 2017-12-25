import * as Bluebird from 'bluebird';
import express from 'express';

import { KatalogPriceListed, KatalogPriceUnlisted, WSUpdate } from '../../model/katalog';
import Sellers from '../../model/sellers';
import { CleanQuery } from '../../util/obj';
import { IsOptional, IsParseNumber, IsString, Middleware } from '../../util/validation';

import { ParseLimitOffset } from '../middleware/helper';
// import Promise from 'bluebird'
// import {ParseLimitOffset} from '../../middleware/helper'
// import {KatalogListed, KatalogNotListed, UpdateBulkPrices, KatalogImageUpdate, KatalogWSNew,
// KatalogWSUpdate, MarkSync} from '../../../model/ws'
// import {MergeDeep} from '../../../util/obj'
// import {IsOptional, IsParseDate, IsParseNumber, IsString, Middleware} from '../../../util/validation'
// import S3Middleware from '../../../util/s3'

// const RuloMapping = require('../../../model/ruloMapping.json')

function KatalogListed(req: express.Request, res: express.Response, next: express.NextFunction) {
    const {user, params} = req.kulakan;
    const {filter, category, noImage, price} = req.query;

    const queryParams = {
        category: CleanQuery(category),
        name: CleanQuery(filter),
        noImage: CleanQuery(noImage) !== '',
        price: CleanQuery(price),
        limit: params.limit,
        offset: params.offset,
    };

    return KatalogPriceListed(user.id, queryParams)
    .then(result => {
        res.send(result);
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
        res.send(result);
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

// function Upload(req, res, next) {
//     const {user, uploads} = req.kulakan
//     return KatalogImageUpdate(user.id, parseInt(req.params.id,10), uploads.Location)
//     .then(() => {
//         res.send({image: uploads.Location})
//     })
//     .catch(err => res.send400(err.message))
// }

// function PreUpload(req, res, next) {
//     req.kulakan.uploadImageKatalog = true
//     next()
// }

export default {
    get: [
        ['/', ParseLimitOffset, KatalogListed],
        ['/notListed', ParseLimitOffset, KatalogUnlisted],
    ],
    post: [
        ['/create', Middleware(specsForUpdate), Update],
        ['/:id(\\d+)/update', Middleware(specsForUpdate), Update],
        // ['/:id(\\d+)/upload-image', PreUpload, ...S3Middleware('image'), Upload],
    ],
};
