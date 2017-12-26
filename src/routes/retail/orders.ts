import express from 'express';

import Orders from '../../model/orders';
import ProcessOrders from '../../model/processOrders';
import { IsBool, IsParseNumber, Middleware } from '../../util/validation';

import { ParseLimitOffset } from '../middleware/helper';

function List(req: express.Request, res: express.Response, next: express.NextFunction) {
    const {user, params} = req.kulakan;

    return Orders.ListByBuyer(user.id, { ...params, status: req.query.status })
    .then(orders => {
        res.send(orders);
    });
}

function Detail(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = req.kulakan.user;
    return Orders.DetailsByBuyer(user.id, req.params.id)
    .then(order => {
        res.send({ order: [order] });
    });
}

const specsForCreate = {
    body: {
        isCOD: IsBool,
        sellerID: IsParseNumber,
        items: [{
            priceID: IsParseNumber,
            quantity: IsParseNumber,
        }],
    },
};

function Create(req: express.Request, res: express.Response, next: express.NextFunction) {
    const {user} = req.kulakan;
    const params = Object.assign({
        buyerID: user.id,
    }, req.body);

    return Orders.Create(params)
    .then(orderID => {
        return Orders.DetailsByBuyer(user.id, orderID.toString());
    })
    .then(order => {
        res.send({order: [order]});
    });
}

function Cancel(req: express.Request, res: express.Response, next: express.NextFunction) {
    const {user} = req.kulakan;
    const {notes} = req.body;
    return ProcessOrders.CancelByBuyer(user.id, req.params.id, notes)
    .then(order => {
        res.send({order: [order]});
    });
}

function Deliver(req: express.Request, res: express.Response, next: express.NextFunction) {
    const {user} = req.kulakan;
    return ProcessOrders.DeliverBySeller(user.id, req.params.id)
    .then(order => {
        res.send({order: [order]});
    });
}

export default {
    get: [
        ['/', ParseLimitOffset, List],
        ['/:id(\\d+)', Detail],
    ],
    post: [
        ['/', Middleware(specsForCreate), Create],
        ['/:id(\\d+)/cancel', Cancel],
        ['/:id(\\d+)/deliver', Deliver],
    ],
};
