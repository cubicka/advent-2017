import * as Bluebird from 'bluebird';

import { Buyer } from './buyers';
import pg, { BuilderFn, CountFactory, Extender, FetchAndCount, FetchFactory, Join, ORM, Selector,
    Table } from './index';
import { AddItems, CreateOrderAdditionals, CreateOrderItems,
    OrderItemsList } from './orderItems';
import { Seller } from './sellers';

export interface Order {
    accepted?: string;
    address?: string;
    assigned?: string;
    buyerID: number;
    cancelled?: string;
    cancelledby?: string;
    created: string;
    delivered?: string;
    deliveryFee: number;
    id: number;
    isCOD: boolean;
    isPaid: boolean;
    notes?: string;
    pickedup?: string;
    read: boolean;
    sellerID: string;
}

export interface DetailedOrder {
    buyer: Buyer;
    details: Order;
    seller: Seller;
    version: OrderItemsList;
}

enum OrderStatus {
    accepted = 'details.accepted',
    assigned = 'details.assigned',
    cancelled = 'details.cancelled',
    created = 'details.created',
    delivered = 'details.delivered',
    pickedup = 'details.pickedup',
}

interface OrderParams {
    limit?: number;
    offset?: number;
    status?: OrderStatus;
}

interface DetailedOrderList {
    count: number;
    orders: DetailedOrder[];
}

export const FetchOrders = FetchFactory<Order>(pg(Table.orders));
export const CountOrder = CountFactory(pg(Table.orders));

export function FetchOrderWithCount(
    orderBuilders: BuilderFn[],
    sellerBuilders: BuilderFn[] = [],
    buyerBuilders: BuilderFn[] = [],
    limit?: number,
    offset?: number,
): Bluebird<DetailedOrderList> {
    const selector = Selector(['details', 'seller', 'buyer']);

    const buyerQuery = Extender(pg(Table.buyers), buyerBuilders);
    const sellerQuery = Extender(pg(Table.sellers), sellerBuilders);

    const completeQuery = [pg.from('orders as details')]
        .map(query => Join(query, sellerQuery, 'details.sellerID', 'seller.userID', 'seller'))
        .map(query => Join(query, buyerQuery, 'details.buyerID', 'buyer.userID', 'buyer'))
        .map(query => Extender(query, orderBuilders))
        [0];

    return FetchAndCount<DetailedOrder>(
        completeQuery,
        { limit, offset, sortBy: 'details.id', sortOrder: 'desc', columns: selector },
    )
    .then(({ count, result }) => {
        return {
            count,
            orders: result,
        };
    });
}

function OrderStatusFilter(status: OrderStatus): BuilderFn[] {
    switch ('details.' + status) {
        case OrderStatus.created: return [
            ORM.WhereNull(OrderStatus.accepted),
            ORM.WhereNull(OrderStatus.cancelled),
        ];

        case OrderStatus.accepted: return [
            ORM.WhereNotNull(OrderStatus.accepted),
            ORM.WhereNull(OrderStatus.pickedup),
            ORM.WhereNull(OrderStatus.cancelled),
        ];

        case OrderStatus.assigned: return [
            ORM.WhereNotNull(OrderStatus.assigned),
            ORM.WhereNull(OrderStatus.pickedup),
            ORM.WhereNull(OrderStatus.cancelled),
        ];

        case OrderStatus.pickedup: return [
            ORM.WhereNotNull(OrderStatus.pickedup),
            ORM.WhereNull(OrderStatus.delivered),
            ORM.WhereNull(OrderStatus.cancelled),
        ];

        case OrderStatus.delivered: return [
            ORM.WhereNotNull(OrderStatus.delivered),
            ORM.WhereNull(OrderStatus.cancelled),
        ];

        case OrderStatus.cancelled: return [
            ORM.WhereNotNull(OrderStatus.cancelled),
        ];

        default: return [];
    }
}

export function List(
    orderBuilders: BuilderFn[],
    sellerBuilders: BuilderFn[],
    buyerBuilders: BuilderFn[],
    params: OrderParams,
): Bluebird<DetailedOrderList> {
    let builders = [
        ...orderBuilders,
    ];

    if (params.status !== undefined) {
        builders = builders.concat(OrderStatusFilter(params.status));
    }

    return FetchOrderWithCount(builders, sellerBuilders, buyerBuilders, params.limit, params.offset)
    .then(orders => {
        return AddItems(orders.orders)
        .then(ordersWithItems => {
            return {
                count: orders.count,
                orders: ordersWithItems,
            };
        });
    });
}

function ListByBuyer(buyerID: string, params: OrderParams) {
    return List([ ORM.Where({ buyerID }) ], [], [ORM.Where({ userID: buyerID })], params);
}

function ListBySeller(sellerID: string, params: OrderParams) {
    return List([ ORM.Where({ sellerID }) ], [ORM.Where({ userID: sellerID })], [], params);
}

function DetailsByBuyer(buyerID: string, orderID: string) {
    return List(
        [ ORM.Where({ buyerID, 'details.id': orderID }) ],
        [],
        [ORM.Where({ userID: buyerID })],
        {
            limit: 1,
            offset: 0,
        },
    )
    .then(orders => {
        if (orders.orders.length === 0) throw new Error('Order tidak ditemukan.');
        return orders.orders[0];
    });
}

function DetailsBySeller(sellerID: string, orderID: string) {
    return List([ ORM.Where({ sellerID, 'details.id': orderID }) ], [ORM.Where({ userID: sellerID })], [], {
        limit: 1,
        offset: 0,
    })
    .then(orders => {
        if (orders.orders.length === 0) throw new Error('Order tidak ditemukan.');
        return orders.orders[0];
    });
}

function ListUnread(userID: string) {
    return CountOrder([ORM.Where({ read: false, sellerID: userID })]);
}

interface OrderInsertParams {
    address: string;
    sellerID: number;
    buyerID: number;
    isCOD: boolean;
    items: Array<{
        priceID: string;
        quantity: string;
    }>;
    additionals: Array<{
        name: string;
        price: string;
        quantity: string;
        unit: string;
    }>;
}

function Create(order: OrderInsertParams) {
    const {sellerID, buyerID, address, items, isCOD, additionals} = order;

    const created = new Date();
    return FetchOrders([
        ORM.Insert({
            sellerID,
            buyerID,
            address,
            created,
            isCOD,
            isPaid: false,
        }, ['id']),
    ])
    .then(ids => {
        const {id} = ids[0];
        return CreateOrderItems(id, items, created)
        .then(() => {
            if (additionals) return CreateOrderAdditionals(id, additionals, created);
            return [];
        })
        .then(() => (id));
    });
}

export default {
    Create,
    DetailsByBuyer,
    DetailsBySeller,
    ListByBuyer,
    ListBySeller,
    ListUnread,
};

// export function OfWhere(whereClause) {
//     const selector = Selector(['details', 'seller', 'buyer'])

//     return pg
//     .select(...selector)
//     .from('orders as details')
//     .innerJoin('seller_details as seller', 'details.sellerID', 'seller.userID')
//     .innerJoin('buyer_details as buyer', 'details.buyerID', 'buyer.userID')
//     .where(whereClause)
//     .orderBy('details.id', 'desc')
// }

// export function OfCount(whereClause) {
//     return pg('orders')
//     .where(whereClause)
// }

// function AddUnits(orders) {
//     const latestVersions = orders.map((order) => {
//         return Math.max(...Object.keys(order.version))
//     })

//     return Promise.reduce(orders, (accum, order, idx) => {
//         const latestVersion = latestVersions[idx]
//         const latestItemIDs = order.version[latestVersion].items.map((item) => (item.itemID))
//         return pg('item_prices').whereIn('itemID', latestItemIDs).where({active: true})
//         .then((prices) => {
//             const pricesGrouped = lodash.groupBy(prices, (price) => (price.itemID))
//             accum.push(Object.assign(order, {units: pricesGrouped}))
//             return accum
//         })
//     }, [])
// }

// function SetFavorites(sellerID, buyerID, itemIDs) {
//     return Promise.reduce(itemIDs, (_, itemID) => {
//         return pg('favorites').where({sellerID, buyerID, itemID})
//         .then((favs) => {
//             if (favs.length > 0) {
//                 return pg('favorites').where({id: favs[0].id}).update({isFavorites: true})
//             }

//             return pg('favorites').insert({sellerID, buyerID, itemID})
//         })
//     }, {})
// }

// function GetDrivers(orderID) {
//     return pg('order_drivers')
//     .where({orderID})
//     .leftJoin('drivers', 'order_drivers.driverID', 'drivers.id')
// }

// function AddDriver(order) {
//     const id = order.details.id
//     return GetDrivers(id)
//     .then((drivers) => {
//         return Object.assign(order, {
//             'driver_assignments': drivers
//         })
//     })
// }

// function LatestVersion(order) {
//     // const orderItems = items.filter((item) => (item.orderID === order.id))
//     // const orderAdds = adds.filter((item) => (item.orderID === order.id))
//     const revs = Object.keys(order.version).map((x) => (parseInt(x, 10)))
//     const latestVersion = Math.max(...revs)

//     return lodash.assign(order, {
//         latestAdds: order.version[latestVersion].additionals,
//         latestItems: order.version[latestVersion].items,
//     })
// }

// function GetStatus(order) {
//     if (order.cancelled) return 'cancelled'
//     if (order.delivered) return 'delivered'
//     if (order.assigned) return 'assigned'
//     if (order.accepted) return 'accepted'
//     return 'created'
// }

// function AllOrders(sellerID, startDate, endDate) {
//     return OfWhere({sellerID}).andWhere('details.created', '>=', startDate)
// .andWhere('details.created', '<=', endDate).then(AddItems).map(LatestVersion).map((order) => {
//         const allItems = order.latestAdds.concat(order.latestItems)
//         return {
//             buyer: order.buyer.shop,
//             created: order.details.created,
//             status: GetStatus(order.details),
//             totalValue: allItems.reduce((total, item) => {
//                 return total + item.quantity * item.price
//             }, 0),
//             category: order.latestItems.reduce((accum, item) => {
//                 if (!(item.category in accum)) {
//                     accum[item.category] = {
//                         quantity: 0,
//                         totalValue: 0,
//                     }
//                 }

//                 accum[item.category].quantity += item.quantity
//                 accum[item.category].totalValue += item.quantity * item.price
//                 return accum
//             }, {})
//         }
//     })
//     .then((orders) => {
//         const scale = 1000 * 3600 * 3
//         return lodash.groupBy(orders, (order) => {
//             const created = order.created
//             return Math.floor(((new Date(created)).getTime() + 1000 * 3600 * 7) / scale) * scale - (1000 * 3600 * 7)
//         })
//     })
// }

// export const Buyer = {
//     List(userID, limit, offset) {
//         return OfWhere({buyerID: userID})
//         .limit(limit)
//         .offset(offset)
//         .then(AddItems)
//     },
//     Detail(userID, orderID) {
//         return OfWhere({'details.id': orderID, buyerID: userID})
//         .then(AddItems)
//     },
//     Create(order) {
//         return CreateOrder(order)
//     },
// }

// export const Seller = {
//     AssignOrder,
//     List({sellerID, status}, limit, offset) {
//         const FilterStatus = FilterWith(status)

//         return Promise.all([
//             FilterStatus(OfWhere({sellerID}))
//                 .limit(limit)
//                 .offset(offset)
//                 .then(AddItems)
//                 .then((orders) => (Promise.map(orders, AddDriver))),
//             FilterStatus(OfCount({sellerID})).count()
//         ])
//     },
//     Detail(userID, orderID) {
//         return pg('orders').where({id: orderID, sellerID: userID}).update({read: true})
//         .then(() => (OfWhere({'details.id': orderID, sellerID: userID})))
//         .then(AddItems)
//         .then(AddUnits)
//         .then((orders) => (Promise.map(orders, AddDriver)))
//     },
//     Accept(userID, order, notes) {
//         return AcceptOrder(userID, order, notes)
//         .then((orders) => {
//             return Promise.reduce(orders, (_, order) => {
//                 const latestVersion = Math.max(...Object.keys(order.version))
//                 return SetFavorites(order.seller.userID,
//  order.buyer.userID, order.version[latestVersion.toString()].items.map((item) => (item.itemID)))
//             }, {})
//             .then(() => (orders))
//             .catch(() => (orders))
//         })
//     },
//     AllOrders,
// }
