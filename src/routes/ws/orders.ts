import express from 'express';

import Orders from '../../model/orders';
import ProcessOrders from '../../model/processOrders';
import { IsOptional, IsParseNumber, IsString, Middleware} from '../../util/validation';

import { SendMobileNotification } from '../middleware/firebase';
import { ParseLimitOffset } from '../middleware/helper';

function List(req: express.Request, res: express.Response, next: express.NextFunction) {
    const { user, params } = req.kulakan;

    return Orders.ListBySeller(user.id, { ...params, status: req.query.status })
    .then(result => {
        res.send(result);
    });
}

function Unread(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = req.kulakan.user;
    return Orders.ListUnread(user.id)
    .then(count => {
        res.send({count});
    });
}

function Detail(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = req.kulakan.user;
    return Orders.DetailsBySeller(user.id, req.params.id)
    .then(order => {
        res.send({ order: [order] });
    });
}

function SendRes(req: express.Request, res: express.Response, next: express.NextFunction) {
    res.send({order: req.kulakan.order});
}

const itemsSpecs = [{
    priceID: IsParseNumber,
    quantity: IsParseNumber,
}];

const additionalsSpecs = [{
    name: IsString,
    unit: IsString,
    price: IsParseNumber,
    quantity: IsParseNumber,
}];

const acceptSpecs = {
    body: {
        additionals: IsOptional(additionalsSpecs),
        items: itemsSpecs,
        notes: IsOptional(IsString),
    },
};

function Accept(req: express.Request, res: express.Response, next: express.NextFunction) {
    const {user} = req.kulakan;
    const {items, additionals, notes} = req.body;

    return ProcessOrders.Accept(user.id, {items, additionals: additionals || [], orderID: req.params.id}, notes)
    .then(order => {
        req.kulakan.order = order;
        req.kulakan.buyerID = order.details.buyerID;
        req.kulakan.payload = {
            notification: {
                title: 'Pesanan Mulai Diproses',
                body: notes || '',
            },
            data: {
                orderID: req.params.id.toString(),
            },
        };

        next();
    });
}

function Draft(req: express.Request, res: express.Response, next: express.NextFunction) {
    const {user} = req.kulakan;
    const {items, additionals} = req.body;

    return ProcessOrders.Draft(user.id, {items, additionals: additionals || [], orderID: req.params.id})
    .then(order => {
        req.kulakan.order = order;
        req.kulakan.buyerID = order.details.buyerID;
        req.kulakan.payload = {
            notification: {
                title: `Pesanan diubah oleh ${order.seller.shop}`,
                body: 'Pesanan anda mengalami sedikit perubahan',
            },
            data: {
                orderID: req.params.id.toString(),
            },
        };

        next();
    });
}

function Cancel(req: express.Request, res: express.Response, next: express.NextFunction) {
    const {user} = req.kulakan;
    const {notes} = req.body;
    return ProcessOrders.CancelBySeller(user.id, req.params.id, notes)
    .then(order => {
        req.kulakan.order = order;
        req.kulakan.buyerID = order.details.buyerID;
        req.kulakan.payload = {
            notification: {
                title: 'Pesanan Ditolak',
                body: notes || '',
            },
            data: {
                orderID: req.params.id.toString(),
            },
        };

        next();
    });
}

function ReadyForPickup(req: express.Request, res: express.Response, next: express.NextFunction) {
    const {user} = req.kulakan;
    return ProcessOrders.Assign(user.id, req.params.id)
    .then(order => {
        req.kulakan.order = order;
        req.kulakan.buyerID = order.details.buyerID;
        req.kulakan.payload = {
            notification: {
                title: 'Pesanan Siap Diambil',
                body: '',
            },
            data: {
                orderID: req.params.id.toString(),
            },
        };

        next();
    });
}

function Deliver(req: express.Request, res: express.Response, next: express.NextFunction) {
    const {user} = req.kulakan;
    return ProcessOrders.DeliverBySeller(user.id, req.params.id)
    .then(order => {
        res.send({order});
    });
}

export default {
    get: [
        ['/', ParseLimitOffset, List],
        ['/unread', Unread],
        ['/:id(\\d+)', Detail],
    ],
    post: [
        ['/:id(\\d+)', Middleware(acceptSpecs), Accept, SendMobileNotification, SendRes],
        ['/:id(\\d+)/cancel', Cancel, SendMobileNotification, SendRes],
        ['/:id(\\d+)/draft', Middleware(acceptSpecs), Draft, SendMobileNotification, SendRes],
        ['/:id(\\d+)/ready-for-pickup', ReadyForPickup, SendMobileNotification, SendRes],
        ['/:id(\\d+)/deliver', Deliver],
    ],
};
