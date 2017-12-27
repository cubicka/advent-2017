import express from 'express';

import * as Relations from '../../model/buyerRelations';
import Buyers from '../../model/buyers';
import { CleanQuery } from '../../util/obj';
import { IsBool, IsPhone, Middleware} from '../../util/validation';

import { ParseLimitOffset } from '../middleware/helper';

function List(req: express.Request, res: express.Response, next: express.NextFunction) {
    const {user, params} = req.kulakan;
    const filters = {
        limit: params.limit,
        name: CleanQuery(req.query.filter),
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

const phoneBodySpecs = {
    body: {
        phone: IsPhone,
    },
};

function Activate(req: express.Request, res: express.Response, next: express.NextFunction) {
    const {user} = req.kulakan;
    const sellerID = user.id;

    return Buyers.ListByPhone(req.body.phone)
    .then(buyers => {
        if (buyers.length !== 1) {
            res.send400('Buyer tidak ditemukan');
            return;
        }

        return Relations.Activate(sellerID, buyers[0].userID)
        .then(message => {
            res.send({message});
        });
    });
}

function Deactivate(req: express.Request, res: express.Response, next: express.NextFunction) {
    const {user} = req.kulakan;
    const sellerID = user.id;

    return Buyers.ListByPhone(req.body.phone)
    .then(buyers => {
        if (buyers.length !== 1) {
            res.send400('Buyer tidak ditemukan');
            return;
        }

        return Relations.Deactivate(sellerID, buyers[0].userID)
        .then(message => {
            res.send({message});
        });
    });
}

const changeTierSpecs = {
    body: {
        tier: (s: string) => (s === 'bronze' || s === 'silver' || s === 'gold' || s === 'normal'),
    },
};

function ChangeTier(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = req.kulakan.user;
    const buyerID = parseInt(req.params.id, 10);

    return Relations.ChangeTier(user.id, buyerID, req.body.tier)
    .then(() => {
        res.send({ status: 'Sukses ganti tier' });
    });
}

const changeDeliverySpecs = {
    body: {
        active: IsBool,
        options: (s: string) => (s === 'pickup' || s === 'delivery'),
    },
};

function ChangeDelivery(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = req.kulakan.user;

    return Buyers.ChangeDelivery(user.id, req.params.id, req.body.options, req.body.active)
    .then(() => {
        res.send({ status: 'Sukses ganti tier' });
    });
}

function DeleteRelationsPipe(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = req.kulakan.user;

    return Relations.DeleteRelations(user.id, req.params.id)
    .then(() => {
        res.send({ status: 'Sukses menghapus.' });
    });
}

export default {
    get: [
        ['/', ParseLimitOffset, List],
        ['/find-buyer', Middleware(byPhoneSpecs), ByPhone],
    ],
    post: [
        ['/activate', Middleware(phoneBodySpecs), Activate],
        ['/deactivate', Middleware(phoneBodySpecs), Deactivate],
        ['/:id(\\d+)/change-tier', Middleware(changeTierSpecs), ChangeTier],
        ['/:id(\\d+)/change-delivery', Middleware(changeDeliverySpecs), ChangeDelivery],
        ['/:id(\\d+)/delete-relation', DeleteRelationsPipe],
    ],
};
