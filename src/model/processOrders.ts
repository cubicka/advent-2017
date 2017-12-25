import pg, { FetchFactory, ORM, Table } from './index';
import { CreateOrderAdditionals, CreateOrderItems } from './orderItems';
import Orders, { Order } from './orders';

const FetchOrders = FetchFactory<Order>(pg(Table.orders));

interface ProcessOrderParams {
    orderID: string;
    items: Array<{ priceID: string, quantity: string }>;
    additionals?: Array<{ name: string, quantity: string, unit: string, price: string}>;
}

function Accept(sellerID: string, { orderID, items, additionals }: ProcessOrderParams, notes = '') {
    return FetchOrders([
        ORM.Where({ sellerID, id: orderID }),
    ])
    .then(orders => {
        if (orders.length === 0) throw new Error('Order tidak ditemukan');

        const order = orders[0];
        if (order.accepted || order.cancelled) {
            throw new Error('Pesanan tidak dapat di "accept"');
        }

        const now = new Date();
        return FetchOrders([
            ORM.Where({ id: orderID }),
            ORM.Update({accepted: now, notes}),
        ])
        .then(() => (CreateOrderItems(parseInt(orderID, 10), items, now)))
        .then(() => {
            if (additionals === undefined) return;
            CreateOrderAdditionals(parseInt(orderID, 10), additionals, now);
        })
        .then(() => Orders.DetailsBySeller(sellerID, orderID));
    });
}

function Draft(sellerID: string, {orderID, items, additionals}: ProcessOrderParams) {
    return FetchOrders([
        ORM.Where({ sellerID, id: orderID }),
    ])
    .then(orders => {
        if (orders.length === 0) throw new Error('Order tidak ditemukan');

        const order = orders[0];
        if (order.assigned || order.cancelled) {
            throw new Error('Detail order tidak lagi dapat diganti.');
        }

        const now = new Date();
        return CreateOrderItems(parseInt(orderID, 10), items, now)
        .then(() => {
            if (additionals === undefined) return;
            CreateOrderAdditionals(parseInt(orderID, 10), additionals, now);
        })
        .then(() => Orders.DetailsBySeller(sellerID, orderID));
    });
}

function Assign(sellerID: string, orderID: string) {
    return FetchOrders([
        ORM.Where({ sellerID, id: orderID }),
    ])
    .then(orders => {
        if (orders.length === 0) throw new Error('Order tidak ditemukan');

        const order = orders[0];
        if (!order.accepted || order.cancelled || order.assigned) {
            throw new Error('Pesanan tidak dapat ditandai sebagai siap diambil.');
        }

        return FetchOrders([
            ORM.Where({ id: orderID }),
            ORM.Update({assigned: new Date()}),
        ])
        .then(() => Orders.DetailsBySeller(sellerID, orderID));
    });
}

function DeliverByBuyer(buyerID: string, orderID: string) {
    return FetchOrders([
        ORM.Where({ id: orderID, buyerID }),
    ])
    .then(orders  => {
        if (orders.length === 0) throw new Error('Pesanan tidak ditemukan.');

        const order = orders[0];
        if (order.delivered || !order.accepted || order.cancelled) {
            throw new Error('Status pesanan tidak dapat diubah menjadi deliver.');
        }

        const now = new Date();
        return FetchOrders([
            ORM.Where({ id: orderID, buyerID }),
            ORM.Update({
                delivered: now,
            }),
        ]);
    })
    .then(() => Orders.DetailsByBuyer(buyerID, orderID));
}

function DeliverBySeller(sellerID: string, orderID: string) {
    return FetchOrders([
        ORM.Where({ id: orderID, sellerID }),
    ])
    .then(orders  => {
        if (orders.length === 0) throw new Error('Pesanan tidak ditemukan.');

        const order = orders[0];
        if (order.delivered || !order.accepted || order.cancelled) {
            throw new Error('Status pesanan tidak dapat diubah menjadi deliver.');
        }

        const now = new Date();
        return FetchOrders([
            ORM.Where({ id: orderID, sellerID }),
            ORM.Update({
                assigned: now,
                delivered: now,
                pickedup: now,
            }),
        ]);
    })
    .then(() => Orders.DetailsBySeller(sellerID, orderID));
}

function CancelByBuyer(buyerID: string, orderID: string, notes: string = '') {
    return FetchOrders([
        ORM.Where({ id: orderID, buyerID }),
    ])
    .then(orders  => {
        if (orders.length === 0) throw new Error('Pesanan tidak ditemukan.');

        const order = orders[0];
        if (order.delivered) throw new Error('Pesanan tidak dapat dibatalkan.');

        return FetchOrders([
            ORM.Where({ id: orderID, buyerID }),
            ORM.Update({ cancelled: new Date(), cancelledby: 'buyer', notes }),
        ]);
    })
    .then(() => Orders.DetailsByBuyer(buyerID, orderID));
}

function CancelBySeller(sellerID: string, orderID: string, notes: string = '') {
    return FetchOrders([
        ORM.Where({ id: orderID, sellerID }),
    ])
    .then(orders  => {
        if (orders.length === 0) throw new Error('Pesanan tidak ditemukan.');

        const order = orders[0];
        if (order.delivered) throw new Error('Pesanan tidak dapat dibatalkan.');

        return FetchOrders([
            ORM.Where({ id: orderID, sellerID }),
            ORM.Update({ cancelled: new Date(), cancelledby: 'seller', notes }),
        ]);
    })
    .then(() => Orders.DetailsBySeller(sellerID, orderID));
}

export default {
    Accept,
    Assign,
    CancelByBuyer,
    CancelBySeller,
    DeliverByBuyer,
    DeliverBySeller,
    Draft,
};
