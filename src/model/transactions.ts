import pg, { Fetch, FetchTable, Insert, JoinFactory, Table, Update, Where, WhereIn } from './index';
import { GetPrices, GetProductByIDs } from './products';

interface OrderItem {
    orderid: string;
    skucode: string;
    pcsqty: number;
}

interface Order {
    orderid: string;
    storecode: string;
    usercode: string;
}

interface OrderDetails {
    picktime: Date;
    remarks: string;
}

const FetchOrderDetail = FetchTable<OrderItem>(Table.orderDetail);
const FetchOrderMaster = FetchTable<Order>(Table.orderMaster);

const FetchOrderItemDetail = JoinFactory(
    pg(Table.sku), pg(Table.orderDetail),
    `${Table.sku}.skucode`, `${Table.orderDetail}.skucode`, Table.orderDetail,
);

function randomString() {
    return Math.random().toString(36).substr(2);
}

function randomIdentifier(prefix?: string) {
    return `${(prefix || '')}#${(new Date()).getTime()}#${randomString()}`;
}

function randomOrderID() {
    return randomIdentifier('orderID');
}

function InsertTransaction(storecode: string, usercode: string, details: OrderDetails) {
    return FetchOrderMaster([
        Insert({
            orderid: randomOrderID(),
            dated: '2018-02-27',
            storecode,
            usercode,
            uploadtime: new Date(),
            picktime: details.picktime,
            remarks: details.remarks,
            total: 0,
            isprint: 0,
            ischeckout: 1,
            iscanceled: 0,
        }, ['orderid']),
    ]);
}

function InsertTransactionItems(storecode: string, orderid: string, items: OrderItem[]) {
    const itemIDs = items.map(item => item.skucode);
    return GetPrices(storecode, itemIDs)
    .then(prices => {
        const insertedItems = items.map(item => {
            const price = prices.find(p => p.skucode === item.skucode);

            return {
                orderid,
                skucode: item.skucode,
                casesize: 0,
                price: price ? price.price : 0,
                total: (price ? price.price : 0) * item.pcsqty,
                pcsqty: item.pcsqty,
            };
        });

        return FetchOrderDetail([
            Insert(insertedItems),
        ]);
    });
}

export function CreateTransaction(storecode: string, usercode: string, details: OrderDetails, items: OrderItem[]) {
    return InsertTransaction(storecode, usercode, details)
    .then(ids => {
        const orderid = ids[0].orderid;
        return InsertTransactionItems(storecode, orderid, items);
    });
}

export function GetTransaction(usercode: string) {
    return FetchOrderMaster([
        Where({
            usercode,
        }),
    ], {
        sortBy: 'orderid',
        sortOrder: 'desc',
    })
    .then(orders => {
        const orderIDs = orders.map(order => order.orderid);

        // return FetchOrderDetail([
        //     WhereIn('orderid', orderIDs),
        // ])
        return Fetch<OrderItem>(
            FetchOrderItemDetail([], [
                WhereIn('orderid', orderIDs),
            ]),
        )
        .then(orderItems => {
            return orders.map(order => {
                return Object.assign({}, order, {
                    items: orderItems.filter(item => item.orderid === order.orderid),
                });
            });
        });
    });
}

export function GetTransactionOfWS(storecode: string) {
    return FetchOrderMaster([
        Where({
            storecode,
            isprint: 0,
        }),
    ], {
        sortBy: 'orderid',
        sortOrder: 'asc',
    })
    .then(orders => {
        const orderIDs = orders.map(order => order.orderid);

        return Fetch<OrderItem>(
            FetchOrderItemDetail([], [
                WhereIn('orderid', orderIDs),
            ]),
        )
        .then(orderItems => {
            return orders.map(order => {
                return Object.assign({}, order, {
                    items: orderItems.filter(item => item.orderid === order.orderid),
                });
            });
        });
    });
}

export function MarkTransaction(orderid: string) {
    return FetchOrderMaster([
        Where({
            orderid,
        }),
        Update({
            isprint: 1,
        }),
    ]);
}
