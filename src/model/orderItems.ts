import Bluebird from 'bluebird'
import lodash from 'lodash'

import { ORM, Table } from './index'
import { DetailedOrder } from './orders'

interface Katalog {
    category?: string;
    description?: string;
    id: number;
    image?: string;
    name: string;
    price?: number;
    principalID: number;
    priority: number;
    sku: string;
}

interface OrderItems {
    itemID: number;
    orderID: number;
    price: number;
    priceID: number;
    quantity: number;
    revision: string;
    unit: string;
}

interface OrderAdditionals {
    name: string;
    orderID: number;
    price: number;
    quantity: number;
    revision: string;
    unit: string;
}

interface OrderItemsList {
    [x: string]: {
        items: OrderItems[];
        additionals: OrderAdditionals[];
    }
}

const FetchOrderAdditionals = ORM.Fetch<OrderAdditionals>(Table.additionals)
// const FetchOrderItems = ORM.Fetch<OrderItems>(Table.orderItems)
const FetchKatalogOrderItems = ORM.FetchJoin<OrderItems, Katalog>(Table.katalog, Table.orderItems, 'katalog.id', 'order_items.itemID')

export function AddItems(orders: DetailedOrder[]) {
    const ids = orders.map((order) => (order.details.id))
    return Bluebird.all([
        FetchKatalogOrderItems([
            ORM.FilterIn('orderID', ids),
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
        ]),
        FetchOrderAdditionals([
            ORM.FilterIn('orderID', ids),
            ORM.Select('name', 'unit', 'quantity', 'price', 'orderID', 'revision')
        ]),
    ])
    .then(([items, additionals]) => {
        const itemsDict = lodash.groupBy(items, (item) => (item.orderID))
        const addDict = lodash.groupBy(additionals, (add) => (add.orderID))

        return orders.map((order) => {
            const items: OrderItems[] = itemsDict[order.details.id] || []
            const adds = addDict[order.details.id] || []
            const revision = lodash.uniq(items.map((item) => (item.revision)).concat(adds.map((add) => (add.revision))))

            const version = revision.reduce((accum: OrderItemsList, revisionID): OrderItemsList => {
                accum[revisionID] = {
                    additionals: additionals.filter((item) => (item.revision === revisionID)),
                    items: items.filter((item) => (item.revision === revisionID)),
                }
                return accum
            }, {} as OrderItemsList)

            return Object.assign(order, {version})
        })
    })
}

export default {
    AddItems,
}
