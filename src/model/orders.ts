import Bluebird from 'bluebird'

import pg, { BuilderFn, ORM, Selector, Table } from "./index"
import { Buyer } from './buyers'
import { AddItems } from './orderItems'
import { Seller } from './sellers'

interface Order {
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
}

enum OrderStatus {
    accepted = 'accepted',
    assigned = 'assigned',
    cancelled = 'cancelled',
    created = 'created',
    delivered = 'delivered',
    pickedup = 'pickedup',
}

interface OrderParams {
    limit: number;
    offset: number;
    status?: OrderStatus;
}

interface OrderList {
    count: number;
    orders: DetailedOrder[];
}

const CountOrder = ORM.Count(Table.orders)

function FetchOrder(builders: BuilderFn[]): Bluebird<DetailedOrder[]> {
    const selector = Selector(['details', 'seller', 'buyer'])
    
    const baseBuilder = pg.select(...selector)
    .from('orders as details')
    .innerJoin('seller_details as seller', 'details.sellerID', 'seller.userID')
    .innerJoin('buyer_details as buyer', 'details.buyerID', 'buyer.userID')
    .orderBy('details.id', 'desc')

    return builders.reduce((accum, builder) => {
        return builder(accum)
    }, baseBuilder)
    .then(result => result)
}

function OrderStatusFilter(status: OrderStatus): BuilderFn[] {
    switch (status) {
        case OrderStatus.created: return [
            ORM.FilterNull(OrderStatus.accepted),
            ORM.FilterNull(OrderStatus.cancelled),
        ]

        case OrderStatus.accepted: return [
            ORM.FilterNotNull(OrderStatus.accepted),
            ORM.FilterNull(OrderStatus.pickedup),
            ORM.FilterNull(OrderStatus.cancelled),
        ]

        case OrderStatus.assigned: return [
            ORM.FilterNotNull(OrderStatus.assigned),
            ORM.FilterNull(OrderStatus.pickedup),
            ORM.FilterNull(OrderStatus.cancelled),
        ]

        case OrderStatus.pickedup: return [
            ORM.FilterNotNull(OrderStatus.pickedup),
            ORM.FilterNull(OrderStatus.delivered),
            ORM.FilterNull(OrderStatus.cancelled),
        ]

        case OrderStatus.delivered: return [
            ORM.FilterNotNull(OrderStatus.delivered),
            ORM.FilterNull(OrderStatus.cancelled),
        ]

        case OrderStatus.cancelled: return [
            ORM.FilterNotNull(OrderStatus.cancelled),
        ]

        default: return []
    }
}

function List(baseBuilders: BuilderFn[], params: OrderParams): Bluebird<OrderList> {
    let builders = [
        ...baseBuilders,
    ]

    if (params.status) {
        builders = builders.concat(OrderStatusFilter(params.status))
    }

    return Bluebird.all([
        FetchOrder([
            ...builders,
            ORM.Limit(params.limit),
            ORM.Offset(params.offset),
        ])
        .then(AddItems),
        CountOrder(builders),
    ])
    .then(([orders, counts]) => {
        return {
            orders,
            count: counts[0].count,
        }
    })
}

function ListByBuyer(buyerID: string, params: OrderParams) {
    return List([ ORM.FilterBy({ buyerID }) ], params)
}

function ListBySeller(sellerID: string, params: OrderParams) {
    return List([ ORM.FilterBy({ sellerID }) ], params)
}

export default {
    ListByBuyer,
    ListBySeller,
}

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

// function CreateOrderItems(id, items, timestamp) {
//     const validItems = items.filter((item) => (item.quantity >= 0))
//     const priceIDs = validItems.map((item) => (item.priceID))
//     return pg('item_prices').whereIn('id', priceIDs)
//     .then((prices) => {
//         const itemIDs = prices.map((price) => (price.itemID))
//         const priceIDToPrice = prices.reduce((accum, price) => {
//             accum[price.id] = price
//             return accum
//         }, {})

//         return pg('katalog').whereIn('id', itemIDs)
//         .then((katalog) => {
//             const rows = validItems.map((item) => {
//                 const price = priceIDToPrice[item.priceID]

//                 return {
//                     orderID: id,
//                     itemID: price.itemID,
//                     unit: price.unit,
//                     quantity: item.quantity,
//                     price: price.price,
//                     priceID: price.id,
//                     revision: timestamp.getTime(),
//                 }
//             })

//             return pg('order_items').insert(rows)
//         })
//     })
// }

// function AddAdditionals(id, additionals, timestamp) {
//     const adds = additionals.filter((add) => {
//         const {name, quantity, unit, price} = add
//         if (!name || typeof name !== 'string') return false
//         if (!unit || typeof unit !== 'string') return false
//         if (quantity === undefined || isNaN(parseInt(quantity)) || parseInt(quantity,10) < 0) return false
//         if (price === undefined || isNaN(parseInt(price, 10))) return false
//         return true
//     }).map((add) => {
//         const {name, quantity, unit, price} = add
//         return {
//             name, unit,
//             price: parseInt(price),
//             quantity: parseInt(quantity),
//             orderID: id,
//             revision: timestamp.getTime(),
//         }
//     })

//     return pg('additionals').insert(adds)
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

// function DraftOrder(userID, {orderID, items, additionals}) {
//     return OfWhere({'details.id': orderID, sellerID: userID})
//     .then((orders) => {
//         if (orders.length === 0) {
//             return {
//                 message: 'Order not found.'
//             }
//         }

//         if (orders[0].details.assigned || orders[0].details.cancelled) {
//             return {
//                 message: 'Order cant be changed.'
//             }
//         }

//         return AddItems(orders)
//         .then((ordersWithItems) => {
//             const itemsSpecs = [{
//                 priceID: IsParseNumber,
//                 quantity: IsParseNumber,
//             }]

//             const additionalsSpecs = [{
//                 name: IsString,
//                 unit: IsString,
//                 price: IsParseNumber,
//                 quantity: IsParseNumber,
//             }]

//             if (!Validation(itemsSpecs)(items) || !Validation(additionalsSpecs)(additionals)) {
//                 return [{
//                     message: 'Invalid request.'
//                 }]
//             }

//             const order = ordersWithItems[0]
//             const latestRevision = Object.keys(order.version).reduce((accum, s) => {
//                 return Math.max(accum, parseInt(s, 10))
//             }, 0)

//             // const validItem = items.reduce((accum, item) => {
//             //     if (!accum) return false
//             //     // const prevItem = order.version[latestRevision].items.find((i) => (i.priceID === item.priceID))
//             //     // if (!prevItem) return false
//             //     // if (prevItem.quantity < item.quantity) return false
//             //     return true
//             // }, true)
//             const validItem = true

//             if (!validItem) {
//                 return [{
//                     message: "Invalid items."
//                 }]
//             }

//             // const validAdd = additionals.reduce((accum, item) => {
//             //     if (!accum) return false
//             //     // const prevItem = order.version[latestRevision].additionals.find((i) => (i.name === item.name && i.unit === item.unit))
//             //     // if (!prevItem) return false
//             //     // if (prevItem.quantity < item.quantity) return false
//             //     return true
//             // }, true)
//             const validAdd = true

//             if (!validAdd) {
//                 return [{
//                     message: "Invalid additionals."
//                 }]
//             }

//             const now = new Date()
//             return CreateOrderItems(orderID, items, now)
//             .then(() => {
//                 if (additionals) return AddAdditionals(orderID, additionals, now)
//                 return
//             })
//             .then(() => (AddItems(orders)))
//         })
//     })
// }

// function AcceptOrder(userID, {orderID, items, additionals}, notes = "") {
//     return OfWhere({'details.id': orderID, sellerID: userID})
//     .then((orders) => {
//         if (orders.length === 0) {
//             return {
//                 message: 'Order not found.'
//             }
//         }

//         if (orders[0].details.accepted || orders[0].details.cancelled) {
//             return {
//                 message: 'Order cant be accepted.'
//             }
//         }

//         return AddItems(orders)
//         .then((ordersWithItems) => {
//             const itemsSpecs = [{
//                 priceID: IsParseNumber,
//                 quantity: IsParseNumber,
//             }]

//             const additionalsSpecs = [{
//                 name: IsString,
//                 unit: IsString,
//                 price: IsParseNumber,
//                 quantity: IsParseNumber,
//             }]

//             if (!Validation(itemsSpecs)(items) || !Validation(additionalsSpecs)(additionals)) {
//                 return [{
//                     message: 'Invalid request.'
//                 }]
//             }

//             const order = ordersWithItems[0]
//             const latestRevision = Object.keys(order.version).reduce((accum, s) => {
//                 return Math.max(accum, parseInt(s, 10))
//             }, 0)

//             const validItem = items.reduce((accum, item) => {
//                 if (!accum) return false
//                 const prevItem = order.version[latestRevision].items.find((i) => (i.priceID === item.priceID))
//                 if (!prevItem) return false
//                 // if (prevItem.quantity < item.quantity) return false
//                 return true
//             }, true)

//             if (!validItem) {
//                 return [{
//                     message: "Invalid items."
//                 }]
//             }

//             const validAdd = additionals.reduce((accum, item) => {
//                 if (!accum) return false
//                 const prevItem = order.version[latestRevision].additionals.find((i) => (i.name === item.name && i.unit === item.unit))
//                 if (!prevItem) return false
//                 // if (prevItem.quantity < item.quantity) return false
//                 return true
//             }, true)

//             if (!validAdd) {
//                 return [{
//                     message: "Invalid additionals."
//                 }]
//             }

//             const now = new Date()
//             return pg('orders').where({id: orderID}).update({accepted: new Date(), notes}, ['id', 'accepted'])
//             .then(() => (CreateOrderItems(orderID, items, now)))
//             .then(() => {
//                 if (additionals) return AddAdditionals(orderID, additionals, now)
//                 return
//             })
//             .then(() => (AddItems(orders)))
//         })
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

// function AssignOrder(userID, orderID) {
//     return OfWhere({'details.id': orderID, sellerID: userID})
//     .then((orders) => {
//         if (orders.length === 0) {
//             return [{
//                 message: 'Pesanan tidak ditemukan.'
//             }]
//         }

//         const order = orders[0]
//         if (!order.details.accepted || order.details.cancelled || order.details.assigned) {
//             return [{
//                 message: 'Pesanan tidak dapat ditandai sebagai siap diambil.'
//             }]
//         }

//         return pg('orders').where({id: orderID}).update({assigned: new Date()})
//         .then(() => (OfWhere({'details.id': orderID, sellerID: userID})))
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
//     return OfWhere({sellerID}).andWhere('details.created', '>=', startDate).andWhere('details.created', '<=', endDate).then(AddItems).map(LatestVersion).map((order) => {
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
//                 return SetFavorites(order.seller.userID, order.buyer.userID, order.version[latestVersion.toString()].items.map((item) => (item.itemID)))
//             }, {})
//             .then(() => (orders))
//             .catch(() => (orders))
//         })
//     },
//     Draft(userID, order) {
//         return DraftOrder(userID, order)
//     },
//     Cancel(userID, orderID, notes) {
//         return pg('orders').where({id: orderID, sellerID: userID})
//         .then((orders) => {
//             if (!orders || orders.length < 1) return {}

//             const order = orders[0]
//             if (order.delivered) return {}
//             return pg('orders').where({id: orderID, sellerID: userID}).update({cancelled: new Date(), notes, cancelledby: 'seller'}, ['id', 'cancelled'])
//         })
//         .then(() => (OfWhere({'details.id': orderID, sellerID: userID})))
//     },
//     Unread(userID) {
//         return pg('orders').where({read: false, sellerID: userID}).count()
//         .then((result) => {
//             if (!result || !result.length || result.length === 0 || !result[0] || !result[0].count) return 0
//             return result[0].count
//         })
//     },
//     AllOrders,
// }
