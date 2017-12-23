import express from 'express';

import Buyers from '../../model/buyers';
import { IsPhone, Middleware} from '../../util/validation';

import { ParseLimitOffset } from '../middleware/helper';
// import {ParseLimitOffset} from '../../middleware/helper'
// import Retail from '../../../model/retail'

// const phoneBodySpecs = {
//     body: {
//         phone: IsString,
//     }
// }

// function Activate(req, res, next) {
//     const {user} = req.kulakan
//     const sellerID = user.id

//     return Retail.ByPhone(req.body.phone)
//     .then((buyers) => {
//         if (buyers.length === 0) {
//             res.send400('Buyer tidak ditemukan')
//             return
//         }

//         return Retail.Activate(sellerID, buyers[0].userID)
//         .then((message) => {
//             res.send({message})
//         })
//     })
// }

// function Deactivate(req, res, next) {
//     const {user} = req.kulakan
//     const sellerID = user.id

//     return Retail.ByPhone(req.body.phone)
//     .then((buyers) => {
//         if (buyers.length === 0) {
//             res.send400('Buyer tidak ditemukan')
//             return
//         }

//         return Retail.Deactivate(sellerID, buyers[0].userID)
//         .then((message) => {
//             res.send({message})
//         })
//     })
// }

function List(req: express.Request, res: express.Response, next: express.NextFunction) {
    const {user, params} = req.kulakan;
    const filters = {
        limit: params.limit,
        name: req.query.filter,
        offset: params.offset,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder,
    };

    return Buyers.ListForSeller(user.id, filters)
    .then(({retailers, count}) => {
        res.send({count, retailers});
    });
}

const byPhoneSpecs = {
    query: {
        phone: IsPhone,
    },
};

function ByPhone(req: express.Request, res: express.Response, next: express.NextFunction) {
    return Buyers.ListByPhone(req.query.phone)
    .then(result => {
        res.send({result});
    });
}

// const changeTierSpecs = {
//     body: {
//         tier: (s) => (s === 'bronze' || s === 'silver' || s === 'gold' || s === 'normal'),
//     }
// }

// function ChangeTier(req, res, next) {
//     const user = req.kulakan.user
//     const id = parseInt(req.params.id, 10)

//     return Retail.ChangeTier(user.id, id, req.body.tier)
//     .then(() => {
//         res.send({ status: 'Sukses ganti tier'})
//     })
//     .catch(err => res.send400(err.message))
// }

export default {
    get: [
        ['/', ParseLimitOffset, List],
        ['/find-buyer', Middleware(byPhoneSpecs), ByPhone],
    ],
    post: [
    //     ['/activate', Middleware(phoneBodySpecs), Activate],
    //     ['/deactivate', Middleware(phoneBodySpecs), Deactivate],
    //     ['/:id(\\d+)/change-tier', Middleware(changeTierSpecs), ChangeTier],
    ],
};
