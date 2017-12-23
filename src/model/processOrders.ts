import { ORM, Table } from './index';
import { CreateOrderAdditionals, CreateOrderItems } from './orderItems';
import Orders, { Order } from './orders';

const FetchOrders = ORM.Fetch<Order>(Table.orders);

interface ProcessOrderParams {
    orderID: string;
    items: Array<{ priceID: string, quantity: string }>;
    additionals?: Array<{ name: string, quantity: string, unit: string, price: string}>;
}

function Accept(sellerID: string, { orderID, items, additionals }: ProcessOrderParams, notes = '') {
    return FetchOrders([
        ORM.FilterBy({ sellerID, id: orderID }),
    ])
    .then(orders => {
        if (orders.length === 0) throw new Error('Order tidak ditemukan');

        const order = orders[0];
        if (order.accepted || order.cancelled) {
            throw new Error('Pesanan tidak dapat di "accept"');
        }

        const now = new Date();
        return FetchOrders([
            ORM.FilterBy({ id: orderID }),
            ORM.Update({accepted: new Date(), notes}, ['id', 'accepted']),
        ])
        .then(() => (CreateOrderItems(orderID, items, now)))
        .then(() => {
            if (additionals === undefined) return;
            CreateOrderAdditionals(orderID, additionals, now);
        })
        .then(() => Orders.Details(sellerID, orderID));
    });
}

function Draft(sellerID: string, {orderID, items, additionals}: ProcessOrderParams) {
    return FetchOrders([
        ORM.FilterBy({ sellerID, id: orderID }),
    ])
    .then(orders => {
        if (orders.length === 0) throw new Error('Order tidak ditemukan');

        const order = orders[0];
        if (order.assigned || order.cancelled) {
            throw new Error('Detail order tidak lagi dapat diganti.');
        }

        const now = new Date();
        return CreateOrderItems(orderID, items, now)
        .then(() => {
            if (additionals === undefined) return;
            CreateOrderAdditionals(orderID, additionals, now);
        })
        .then(() => Orders.Details(sellerID, orderID));
    });
}

export default {
    Accept,
    Draft,
};
