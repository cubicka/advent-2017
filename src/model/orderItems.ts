import * as Bluebird from 'bluebird';
import * as lodash from 'lodash';

import { ChangeImageUrl } from '../service/image';

import { PickPrice } from './buyerRelations';
import pg, { Fetch, FetchFactory, JoinFactory, ORM, Table } from './index';
import { FetchItemPricesByIDs, ItemPrices } from './itemPrices';
import { FetchJoinKatalogWs, Katalog } from './katalog';
import { DetailedOrder } from './orders';

export interface OrderItems {
    itemID: number;
    orderID: number;
    price: number;
    priceID: number;
    quantity: number;
    revision: string;
    unit: string;
}

export interface OrderAdditionals {
    name: string;
    orderID: number;
    price: number;
    quantity: number;
    revision: string;
    unit: string;
}

export interface OrderItemsList {
    [x: string]: {
        items: OrderItems[];
        additionals: OrderAdditionals[];
    };
}

const FetchOrderAdditionals = FetchFactory<OrderAdditionals>(pg(Table.additionals));
export const FetchOrderItems = FetchFactory<OrderItems>(pg(Table.orderItems));

const JoinKatalogWsOrderItems = JoinFactory(
    pg(Table.katalogWs), pg(Table.orderItems),
    'katalog_ws.id', 'order_items.itemID', 'order_items',
);

export function AddItems(orders: DetailedOrder[]) {
    const ids = orders.map(order => (order.details.id));
    return Bluebird.all([
        Fetch<Katalog & OrderItems>(
            JoinKatalogWsOrderItems([
                ORM.Select(
                    'orderID',
                    'itemID',
                    'name',
                    'image',
                    'order_items.price',
                    'unit',
                    'quantity',
                    'priceID',
                    'revision',
                    'category',
                ),
            ], [
                ORM.WhereIn('orderID', ids),
            ]),
        ),
        FetchOrderAdditionals([
            ORM.WhereIn('orderID', ids),
            ORM.Select('name', 'unit', 'quantity', 'price', 'orderID', 'revision'),
        ]),
    ])
    .then(([orderItems, additionals]) => {
        const katalogIDs = orderItems.map(item => item.itemID);

        return FetchJoinKatalogWs([
            ORM.WhereIn('katalog_ws.id', katalogIDs),
        ])
        .then(katalogs => {
            const extendedOrderItems = orderItems.map(item => {
                const katalog = katalogs.find(k => k.itemID === item.itemID);

                if (katalog === undefined) return item;
                return lodash.assign(item, {
                    name: katalog.name,
                    image: katalog.image,
                    category: katalog.category,
                    description: katalog.description,
                });
            });

            const itemsDict = lodash.groupBy(extendedOrderItems.map(ChangeImageUrl), item => (item.orderID));
            const addDict = lodash.groupBy(additionals, add => (add.orderID));

            return orders.map(order => {
                const items: OrderItems[] = itemsDict[order.details.id] || [];
                const adds = addDict[order.details.id] || [];
                const revision = lodash.uniq(items
                    .map(item => (item.revision)).concat(adds.map(add => (add.revision))));

                const version = revision.reduce((accum: OrderItemsList, revisionID): OrderItemsList => {
                    accum[revisionID] = {
                        additionals: additionals.filter(item => (item.revision === revisionID)),
                        items: items.filter(item => (item.revision === revisionID)),
                    };

                    return accum;
                }, {} as OrderItemsList);

                return Object.assign(order, {version});
            });
        });
    });
}

export function CreateOrderItems(
    orderID: number,
    items: Array<{priceID: string, quantity: string}>,
    timestamp: Date,
    tier: string = 'normal',
) {
    const validItems = items.filter(item => (parseInt(item.quantity, 10) > 0));
    const priceIDs = validItems.map(item => (item.priceID));

    return FetchItemPricesByIDs(priceIDs)
    .then(prices => {
        const priceIDToPrice = prices.reduce((accum, price) => {
            accum[price.id] = price;
            return accum;
        }, {} as {[x: string]: ItemPrices});

        const rows = validItems.map(item => {
            const price = priceIDToPrice[item.priceID];

            return {
                orderID,
                itemID: price.itemID,
                unit: price.unit,
                quantity: item.quantity,
                price: (PickPrice(price, tier)).price,
                priceID: price.id,
                revision: timestamp.getTime(),
            };
        });

        return FetchOrderItems([
            ORM.Insert(rows),
        ]);
    });
}

export function CreateOrderAdditionals(
    orderID: number,
    additionals: Array<{ name: string, quantity: string, unit: string, price: string}>,
    timestamp: Date,
) {
    if (additionals.length === 0) return Bluebird.try(() => ([]));

    const adds = additionals.filter(add => {
        const {name, quantity, unit, price} = add;

        if (!name || typeof name !== 'string') return false;
        if (!unit || typeof unit !== 'string') return false;
        if (quantity === undefined || isNaN(parseInt(quantity, 10)) || parseInt(quantity, 10) < 0) return false;
        if (price === undefined || isNaN(parseInt(price, 10))) return false;

        return true;
    }).map(add => {
        const {name, quantity, unit, price} = add;

        return {
            name, orderID, unit,
            price: parseInt(price, 10),
            quantity: parseInt(quantity, 10),
            revision: timestamp.getTime(),
        };
    });

    return FetchOrderAdditionals([
        ORM.Insert(adds),
    ]);
}

export default {
    AddItems,
    CreateOrderAdditionals,
    CreateOrderItems,
};
