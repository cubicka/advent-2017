import * as Bluebird from 'bluebird';

import { Buyer } from './buyers';
import pg, { BuilderFn, ORM, Selector, Table } from './index';
import { AddItems, OrderItemsList } from './orderItems';
import { Seller } from './sellers';

export interface Order {
    accepted?: string;
    address?: string;
    assigned?: string;
    buyerID: string;
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
    limit: number;
    offset: number;
    status?: OrderStatus;
}

interface DetailedOrderList {
    count: number;
    orders: DetailedOrder[];
}

const CountOrder = ORM.Count(Table.orders);

function FetchOrderWithCount(
    orderBuilders: BuilderFn[],
    sellerBuilders: BuilderFn[] = [],
    buyerBuilders: BuilderFn[] = [],
    limit: number,
    offset: number,
): Bluebird<DetailedOrderList> {
    const selector = Selector(['details', 'seller', 'buyer']);

    const buyerBuilt = buyerBuilders.reduce((accum, builder) => {
        return builder(accum);
    }, pg(Table.buyers));

    const sellerBuilt = sellerBuilders.reduce((accum, builder) => {
        return builder(accum);
    }, pg(Table.sellers));

    const baseBuilder = pg.select(...selector)
    .from('orders as details')
    .join(pg.raw('(' + sellerBuilt + ') as seller'), 'details.sellerID', 'seller.userID')
    .join(pg.raw('(' + buyerBuilt + ') as buyer'), 'details.buyerID', 'buyer.userID')
    .orderBy('details.id', 'desc')
    .limit(limit).offset(offset);

    const countBuilder = pg.from('orders as details')
    .join(pg.raw('(' + sellerBuilt + ') as seller'), 'details.sellerID', 'seller.userID')
    .join(pg.raw('(' + buyerBuilt + ') as buyer'), 'details.buyerID', 'buyer.userID');

    const completeQuery = orderBuilders.reduce((accum, builder) => {
        return accum.map(builder);
    }, [baseBuilder, countBuilder]);

    return Bluebird.all([
        completeQuery[0].then(result => result),
        completeQuery[1].count('details.id'),
    ])
    .then(([orders, counts]: [DetailedOrder[], Array<{ count: number }>]) => {
        return {
            count: counts[0].count,
            orders,
        };
    });
}

function OrderStatusFilter(status: OrderStatus): BuilderFn[] {
    switch ('details.' + status) {
        case OrderStatus.created: return [
            ORM.FilterNull(OrderStatus.accepted),
            ORM.FilterNull(OrderStatus.cancelled),
        ];

        case OrderStatus.accepted: return [
            ORM.FilterNotNull(OrderStatus.accepted),
            ORM.FilterNull(OrderStatus.pickedup),
            ORM.FilterNull(OrderStatus.cancelled),
        ];

        case OrderStatus.assigned: return [
            ORM.FilterNotNull(OrderStatus.assigned),
            ORM.FilterNull(OrderStatus.pickedup),
            ORM.FilterNull(OrderStatus.cancelled),
        ];

        case OrderStatus.pickedup: return [
            ORM.FilterNotNull(OrderStatus.pickedup),
            ORM.FilterNull(OrderStatus.delivered),
            ORM.FilterNull(OrderStatus.cancelled),
        ];

        case OrderStatus.delivered: return [
            ORM.FilterNotNull(OrderStatus.delivered),
            ORM.FilterNull(OrderStatus.cancelled),
        ];

        case OrderStatus.cancelled: return [
            ORM.FilterNotNull(OrderStatus.cancelled),
        ];

        default: return [];
    }
}

function List(
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

    return FetchOrderWithCount([
        ...builders,
    ], sellerBuilders, buyerBuilders, params.limit, params.offset)
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
    return List([ ORM.FilterBy({ buyerID }) ], [], [ORM.FilterBy({ userID: buyerID })], params);
}

function ListBySeller(sellerID: string, params: OrderParams) {
    return List([ ORM.FilterBy({ sellerID }) ], [ORM.FilterBy({ userID: sellerID })], [], params);
}

function Details(sellerID: string, orderID: string) {
    return List([ ORM.FilterBy({ sellerID, 'details.id': orderID }) ], [ORM.FilterBy({ userID: sellerID })], [], {
        limit: 1,
        offset: 0,
    })
    .then(orders => {
        if (orders.orders.length === 0) throw new Error('Order tidak ditemukan.');
        return orders.orders[0];
    });
}

function ListUnread(userID: string) {
    return CountOrder([
        ORM.FilterBy({ read: false, sellerID: userID }),
    ])
    .then(result => result);
}

export default {
    Details,
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

// function CreateOrder(order) {
//     const {sellerID, buyerID, address, items, isCOD, additionals} = order
//     const created = new Date()
//     return pg('orders').insert({sellerID, buyerID, address, created, isCOD, isPaid: false}, ['id'])
//     .then((ids) => {
//         const {id} = ids[0]
//         return CreateOrderItems(id, items, created)
//         .then(() => {
//             if (additionals) return AddAdditionals(id, additionals, created)
//             return
//         })
//         .then(() => (id))
//     })
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
