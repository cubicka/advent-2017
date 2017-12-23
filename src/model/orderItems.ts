import * as Bluebird from 'bluebird';
import * as lodash from 'lodash';

import { ORM, Table } from './index';
import { FetchItemPricesByIDs, ItemPrices } from './itemPrices';
import { Katalog } from './katalog';
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

const FetchOrderAdditionals = ORM.Fetch<OrderAdditionals>(Table.additionals);
const FetchOrderItems = ORM.Fetch<OrderItems>(Table.orderItems);

const FetchKatalogOrderItems = ORM.FetchJoin<OrderItems, Katalog>(
    Table.katalog, Table.orderItems,
    'katalog.id',
    'order_items.itemID',
);

function ChangeImageUrl(item: Katalog & OrderItems) {
    if (!item.image) return item;

    const fullUrl = item.image;
    const splittedUrl = fullUrl.split('/');

    const fileName = splittedUrl[splittedUrl.length - 1];
    const splittedFileName = fileName.split('.');
    const extension = splittedFileName[splittedFileName.length - 1];

    const prefix = 'https://rulo-katalog.s3.amazonaws.com';
    const subs = ['img512', 'img256', 'img128', 'img64', 'img32'];

    return subs.reduce((accum, sub) => {
        return Object.assign(accum, {
            [sub]: (extension !== 'png') ? `${prefix}/${sub}/${fileName}` : `${prefix}/${fileName}`,
        });
    }, Object.assign(item, {
        image: `${prefix}/img256/${fileName}`,
        imageFull: item.image,
    }));
}

export function AddItems(orders: DetailedOrder[]) {
    const ids = orders.map(order => (order.details.id));
    return Bluebird.all([
        FetchKatalogOrderItems([
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
            ORM.FilterIn('orderID', ids),
        ]),
        FetchOrderAdditionals([
            ORM.FilterIn('orderID', ids),
            ORM.Select('name', 'unit', 'quantity', 'price', 'orderID', 'revision'),
        ]),
    ])
    .then(([orderItems, additionals]) => {
        const itemsDict = lodash.groupBy(orderItems.map(ChangeImageUrl), item => (item.orderID));
        const addDict = lodash.groupBy(additionals, add => (add.orderID));

        return orders.map(order => {
            const items: OrderItems[] = itemsDict[order.details.id] || [];
            const adds = addDict[order.details.id] || [];
            const revision = lodash.uniq(items.map(item => (item.revision)).concat(adds.map(add => (add.revision))));

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
}

export function CreateOrderItems(
    orderID: string,
    items: Array<{priceID: string, quantity: string}>,
    timestamp: Date,
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
                price: price.price,
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
    orderID: string,
    additionals: Array<{ name: string, quantity: string, unit: string, price: string}>,
    timestamp: Date,
) {
    if (additionals.length === 0) return [];

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
