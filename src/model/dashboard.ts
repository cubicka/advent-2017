// import pg from './index'
// import Excel from 'exceljs'
// import tempfile from 'tempfile'

import * as Bluebird from 'bluebird';
import * as lodash from 'lodash';

import { ORM } from './index';
import { FetchJoinKatalogWs } from './katalog';
import { OrderItems } from './orderItems';
import { CountOrder, DetailedOrder, List } from './orders';

function Dashboard(userID: number, startDate: Date, endDate: Date) {
    return Bluebird.all([
        OrderCreated(userID, startDate, endDate),
        OrderAccepted(userID, startDate, endDate),
        OrderDelivered(userID, startDate, endDate),
        OrderCancelled(userID, startDate, endDate),
        LatestOrder(userID, startDate, endDate),
    ])
    .then(([created, accepted, delivered, cancelled, latest]) => {
        return {
            created, accepted, delivered, cancelled,
            latest: latest.orders,
            popularItems: latest.items,
            revenue: latest.revenue,
            allOrders: latest.orders,
        };
    });
}

function TimeLimitBuilder(startDate: Date, endDate: Date) {
    return [
        ORM.WhereNot('sellerID', -1),
        ORM.WhereNot('buyerID', -1),
        ORM.WhereA('created', '>', startDate),
        ORM.WhereA('created', '<', endDate),
    ];
}

function OrderCreated(sellerID: number, startDate: Date, endDate: Date) {
    const builders = [
        ...TimeLimitBuilder(startDate, endDate),
        ORM.WhereNull('accepted'),
        ORM.WhereNull('cancelled'),
    ];

    if (sellerID !== -1) builders.push(ORM.Where({ sellerID }));
    return CountOrder(builders);
}

function OrderAccepted(sellerID: number, startDate: Date, endDate: Date) {
    const builders = [
        ...TimeLimitBuilder(startDate, endDate),
        ORM.WhereNotNull('accepted'),
        ORM.WhereNull('cancelled'),
        ORM.WhereNull('delivered'),
    ];

    if (sellerID !== -1) builders.push(ORM.Where({ sellerID }));
    return CountOrder(builders);
}

function OrderDelivered(sellerID: number, startDate: Date, endDate: Date) {
    const builders = [
        ...TimeLimitBuilder(startDate, endDate),
        ORM.WhereNotNull('delivered'),
    ];

    if (sellerID !== -1) builders.push(ORM.Where({ sellerID }));
    return CountOrder(builders);
}

function OrderCancelled(sellerID: number, startDate: Date, endDate: Date) {
    const builders = [
        ...TimeLimitBuilder(startDate, endDate),
        ORM.WhereNotNull('cancelled'),
    ];

    if (sellerID !== -1) builders.push(ORM.Where({ sellerID }));
    return CountOrder(builders);
}

export default {
    Dashboard,
};

function LatestOrder(sellerID: number, startDate: Date, endDate: Date) {
    const builders = [
        ...TimeLimitBuilder(startDate, endDate),
        ORM.WhereNull('cancelled'),
        ORM.OrderBy('created', 'desc'),
    ];

    if (sellerID !== -1) builders.push(ORM.Where({ sellerID }));

    const latestOrders: DetailedOrder[] = [];
    const latestItems: OrderItems[] = [];
    let totalRevenue = 0;

    return List(builders, [], [], {})
    .then(({ count, orders }) => {
        orders.forEach(order => {
            const latestVersion = Math.max(...Object.keys(order.version).map(v => parseInt(v, 10)));
            const totalPrice = order.version[latestVersion.toString()].items.reduce((total, item) => {
                return total + item.quantity * item.price;
            }, 0);

            latestOrders.push(lodash.assign(order, {items: order.version[latestVersion.toString()].items, totalPrice}));
            latestItems.push(...order.version[latestVersion.toString()].items);
            totalRevenue += totalPrice;
        });

        const itemByIDs = lodash.groupBy(latestItems, item => (item.itemID.toString() + item.unit));
        const itemPrices = lodash.map(itemByIDs, (details, itemID) => {
            const totalPrice = lodash.reduce(details, (total, detail) => {
                return {
                    price: total.price + detail.quantity * detail.price,
                    quantity: total.quantity + detail.quantity,
                };
            }, {price: 0, quantity: 0});

            return {
                totalPrice: totalPrice.price,
                totalQuantity: totalPrice.quantity,
                unit: details[0].unit, itemID: details[0].itemID,
            };
        });

        const itemIDs = lodash.chain(latestItems).map(item => (item.itemID)).uniq().value();
        return FetchJoinKatalogWs([ ORM.WhereIn('katalog_ws.id', itemIDs) ])
        .then(katalog => {
            return lodash.sortBy(itemPrices, item => (item.totalPrice * -1)).slice(0, 5).map(item => {
                const katalogItem = katalog.find(ki => (ki.id === item.itemID)) || {
                    name: '', image: '',
                };

                return lodash.assign(item, {name: katalogItem.name, image: katalogItem.image});
            });
        });
    })
    .then(items => {
        return {
            orders: latestOrders,
            items, revenue: totalRevenue,
        };
    });
}

// function LatestItems(userID, startDate, endDate) {
//     const clause = userID !== -1 ? pg('orders').where({sellerID: userID}).whereNull('cancelled') : pg
// ('orders').whereNull('cancelled')
//     return AddTimeLimit(clause, startDate, endDate).select('id')
//     .then((orders) => {
//         const orderIDs = orders.map((order) => (order.id))
//         return pg('order_items').whereIn('orderID', orderIDs)
//         .then((items) => {
//             const latestOfIDs = orderIDs.reduce((accum, orderID) => {
//                 const orderItems = items.filter((item) => (item.orderID === orderID))
//                 const latestVersion = Math.max(...orderItems.map((item) => (item.revision)))

//                 accum[orderID] = latestVersion
//                 return accum
//             }, {})

//             return items.filter((item) => (parseInt(item.revision, 10) === latestOfIDs[item.orderID]))
//         })
//     })
//     .then((items) => {
//         const itemByIDs = lodash.groupBy(items, (item) => (item.itemID.toString() + item.unit))
//         const itemPrices = lodash.map(itemByIDs, (details, itemID) => {
//             const totalPrice = lodash.reduce(details, (total, detail) => {
//                 return {
//                     price: total.price + detail.quantity * detail.price,
//                     quantity: total.quantity + detail.quantity,
//                 }
//             }, {price: 0, quantity: 0})

//             return {
//                 totalPrice: totalPrice.price, totalQuantity: totalPrice.quantity, unit: details[0].unit,
// itemID: details[0].itemID
//             }
//         })

//         const itemIDs = lodash.chain(items).map((item) => (item.itemID)).uniq().value()
//         return pg('katalog').whereIn('id', itemIDs)
//         .then((katalog) => {
//             return lodash.sortBy(itemPrices, (item) => (item.totalPrice * -1)).slice(0, 5).map((item) => {
//                 const katalogItem = katalog.find((ki) => (ki.id === item.itemID))
//                 return lodash.assign(item, {name: katalogItem.name, image: katalogItem.image})
//             })
//         })
//     })
// }

// function TotalRevenue(userID, startDate, endDate) {
//     const clause = userID !== -1 ? pg('orders').where({sellerID: userID}).whereNull('cancelled').orderBy
// ('created', 'desc') : pg('orders').whereNull('cancelled').orderBy('created', 'desc')
//     return AddTimeLimit(clause, startDate, endDate)
//     .then((orders) => {
//         const buyerIDs = orders.map((order) => (order.buyerID))
//         const orderIDs = orders.map((order) => (order.id))

//         return Promise.all([
//             pg('buyer_details').whereIn('userID', buyerIDs).select('userID', 'name', 'shop'),
//             pg('order_items').whereIn('orderID', orderIDs),
//         ])
//         .then(([buyers, items]) => {
//             return orders.map((order) => {
//                 const buyer = buyers.find((user) => (user.userID === order.buyerID))
//                 const orderItems = items.filter((item) => (item.orderID === order.id))
//                 const latestVersion = Math.max(...orderItems.map((item) => (item.revision)))
//                 const totalPrice = orderItems.filter((item) => (parseInt(item.revision,10) ===
// latestVersion)).reduce((total, item) => {
//                     return total + item.quantity * item.price
//                 }, 0)

//                 return lodash.assign(order, {buyer: buyer, items: orderItems, totalPrice})
//             })
//         })
//         .then((orders) => {
//             return {
//                 revenue: orders.reduce((total, order) => (total + order.totalPrice), 0),
//                 allOrders: orders,
//             }
//         })
//     })
// }

// export function ExportOrders(stream, userID, startDate, endDate) {
//     const clause = userID === -1 ? pg('orders').orderBy('created', 'desc') : pg('orders').where(
    // {sellerID: userID}).orderBy('created', 'desc')

//     return AddTimeLimit(clause, startDate, endDate)
//     .then((orders) => {
//         const buyerIDs = orders.map((order) => (order.buyerID))
//         const orderIDs = orders.map((order) => (order.id))

//         return Promise.all([
//             pg('buyer_details').whereIn('userID', buyerIDs).select('userID', 'name', 'shop', 'address', 'phone'),
//             pg('order_items').whereIn('orderID', orderIDs),
//             pg('additionals').whereIn('orderID', orderIDs),
//         ])
//         .then(([buyers, items, additionals]) => {
//             return Promise.all([
//                 buyers,
//                 orders.map((order) => {
//                     const buyer = buyers.find((user) => (user.userID === order.buyerID))
//                     const orderItems = items.filter((item) => (item.orderID === order.id))
//                     const orderAdds = additionals.filter((item) => (item.orderID === order.id))

//                     const latestVersion = Math.max(...orderItems.map((item) => (item.revision)),
// ...orderAdds.map((item) => (item.revision)))

//                     const totalPrice = orderItems.filter((item) => (parseInt(item.revision,10) ===
// latestVersion)).reduce((total, item) => {
//                         return total + item.quantity * item.price
//                     }, 0)

//                     return lodash.assign(order, {
//                         buyer: buyer, items: orderItems, totalPrice,
//                         latestAdds: orderAdds.filter((item) => (latestVersion === parseInt(item.revision, 10))),
//                         latestItems: orderItems.filter((item) => (latestVersion === parseInt(item.revision, 10))),
//                     })
//                 }),
//                 pg('katalog').whereIn('id', items.map((item) => (item.itemID))),
//             ])
//         })
//     })
//     .then(([buyers, orders, katalog]) => {
//         var fileName = "report"
//         stream.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
//         stream.setHeader('Content-Disposition', "attachment; filename='export_" + fileName + ".xlsx'");
//         // var workbook = new Excel.stream.xlsx.WorkbookWriter({stream: stream});
//         var workbook = new Excel.Workbook()

//         function SimplerTime(datetime) {
//             var d = new Date(datetime)
//             d.setHours(d.getHours() + 7)
//             const iso = d.toISOString()
//             return `${iso.slice(0,10)} ${iso.slice(11,16)} (WIB)`
//         }

//         function FormatHarga(x) {
//             if (!x) {
//                 return 0;
//             }
//             return x.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
//         }

//         function Status(order) {
//             if (order.cancelled) return "Dibatalkan"
//             if (order.delivered) return "Telah Diterima"
//             if (order.pickedup) return "Dalam Pengantaran"
//             return "Sedang Diproses"
//         }

//         var sheet = workbook.addWorksheet('detail pesanan');
//         const columns = ['Tanggal Pemesanan', 'Pemesan', 'Alamat', 'No. Telp', 'Status', 'Total
// Transaksi', 'Tanggal Pengantaran', 'Tanggal Diterima', 'Tanggal Pembatalan']
//         sheet.addRow(columns).commit()

//         const buyerMap = buyers.reduce((accum, buyer) => {
//             accum[buyer.userID] = buyer
//             accum[buyer.userID].totalTransaksi = 0
//             accum[buyer.userID].jumlahTransaksi = 0
//             return accum
//         }, {})

//         let totalTransaksi = 0
//         orders.forEach((order) => {
//             let row = []
//             row.push(SimplerTime(order.created))
//             row.push(order.buyer.shop)
//             row.push(order.buyer.address)
//             row.push(order.buyer.phone)
//             row.push(Status(order))
//             row.push(`Rp ${FormatHarga(order.totalPrice)}`)
//             row.push(order.pickedup ? SimplerTime(order.pickedup) : "-")
//             row.push(order.delivered ? SimplerTime(order.delivered) : "-")
//             row.push(order.cancelled ? SimplerTime(order.cancelled) : "-")

//             totalTransaksi += order.totalPrice
//             buyerMap[order.buyerID].totalTransaksi += order.totalPrice
//             buyerMap[order.buyerID].jumlahTransaksi += 1
//             sheet.addRow(row).commit()
//         })

//         var buyerSheet = workbook.addWorksheet('retailer aktif')
//         buyerSheet.addRow(['Nama Toko', 'Nama Pemilik', 'No. Telp', 'Alamat', 'Jumlah Transaksi', 'Total
// Nilai Transaksi']).commit()
//         const buyersOrdered = Object.keys(buyerMap).map((buyerID) => {
//             const buyer = buyerMap[buyerID]
//             return buyer
//         }).sort((a, b) => ((a.totalTransaksi - b.totalTransaksi) * -1))
//         buyersOrdered.forEach((buyer) => {
//             let row = []
//             row.push(buyer.shop)
//             row.push(buyer.name)
//             row.push(buyer.phone)
//             row.push(buyer.address)
//             row.push(buyer.jumlahTransaksi)
//             row.push(buyer.totalTransaksi)
//             buyerSheet.addRow(row).commit()
//         })

//         const katalogMap = katalog.reduce((accum, item) => {
//             accum[item.id] = item
//             return accum
//         }, {})

//         var itemSheet = workbook.addWorksheet('detail barang')
//         itemSheet.addRow(['Tangal Pemesanan', 'Pemesan', 'No Telp', 'Nama Barang', 'Unit', 'Jumlah',
// 'Harga Per Barang', 'Harga Total']).commit()
//         orders.forEach((order) => {
//             let row = []
//             row.push(SimplerTime(order.created))
//             row.push(order.buyer.shop)
//             row.push(order.buyer.phone)
//             order.latestItems.forEach((item) => {
//                 const katalogItem = katalogMap[item.itemID] || {}
//                 const itemRow = [...row]

//                 itemRow.push(katalogItem.name)
//                 itemRow.push(item.unit)
//                 itemRow.push(item.quantity)
//                 itemRow.push(item.price)
//                 itemRow.push(item.quantity * item.price)
//                 itemSheet.addRow(itemRow).commit()
//             })

//             order.latestAdds.forEach((item) => {
//                 const itemRow = [...row]

//                 itemRow.push(item.name)
//                 itemRow.push(item.unit)
//                 itemRow.push(item.quantity)
//                 itemRow.push(item.price)
//                 itemRow.push(item.quantity * item.price)
//                 itemSheet.addRow(itemRow).commit()
//             })
//         })

//         // sheet.commit()

//         var rekapSheet = workbook.addWorksheet('rekap');
//         rekapSheet.addRow(['Jumlah Pesanan', orders.length + ' pesanan']).commit()
//         rekapSheet.addRow(['Total Transaksi', `Rp ${FormatHarga(totalTransaksi)}`]).commit()
//         rekapSheet.addRow(['Jumlah Sedang Diproses', orders.filter((order) => (Status(order) === "Sedang
// Diproses")).length + ' pesanan']).commit()
//         rekapSheet.addRow(['Jumlah Dalam Pengantaran', orders.filter((order) => (Status(order) ===
// "Dalam Pengantaran")).length + ' pesanan']).commit()
//         rekapSheet.addRow(['Jumlah Dalam Pengantaran', orders.filter((order) => (Status(order) ===
// "Dalam Pengantaran")).length + ' pesanan']).commit()
//         rekapSheet.addRow(['Jumlah Dibatalkan', orders.filter((order) => (Status(order) === "Dibatalkan")
// ).length]).commit()
//         // rekapSheet.commit()

//         // console.log('--- 0')
//         // // workbook.commit()
//         // console.log('--- 1')
//         // workbook.xlsx.write(stream)
//         // console.log('--- 2')
//         // stream.end()
//         // console.log('--- 3')
//         var tempFilePath = tempfile((new Date()).getTime(),toString() + '.xlsx');
//         workbook.xlsx.writeFile(tempFilePath).then(function() {
//             stream.sendFile(tempFilePath, function(err){
//                 // console.log('---------- error downloading file: ' + err);
//             });
//         });
//     })
// }

// function LatestVersions(orders) {
//     const orderIDs = orders.map((order) => (order.id))

//     return Promise.all([
//         pg('order_items').innerJoin('katalog', 'katalog.id', 'order_items.itemID').whereIn('orderID',
// orderIDs).select('orderID', 'name', 'unit', 'quantity', 'order_items.price as price', 'revision'),
//         pg('additionals').whereIn('orderID', orderIDs)
//     ])
//     .then(([items, adds]) => {
//         return orders.map((order) => {
//             const orderItems = items.filter((item) => (item.orderID === order.id))
//             const orderAdds = adds.filter((item) => (item.orderID === order.id))
//             const latestVersion = Math.max(...orderItems.map((item) => parseInt(item.revision,10)),
// ...orderAdds.map((add) => (parseInt(add.revision, 10))))

//             return lodash.assign(order, {
//                 items: orderItems,
//                 latestAdds: adds.filter((item) => (parseInt(item.revision,10) === latestVersion)),
//                 latestItems: orderItems.filter((item) => (parseInt(item.revision,10) === latestVersion)),
//             })
//         })
//     })
// }

// function Buyers(orders) {
//     const buyerIDs = lodash.uniq(orders.map((order) => (order.buyerID)))
//     return pg('buyer_details').whereIn('userID', buyerIDs)
// }

// export function AggregateBuyersReport(sellerID, startDate, endDate) {
//     return AddTimeLimit(pg('orders').where({sellerID}).whereNull('cancelled') , startDate, endDate)
//     .then((orders) => {
//         return Promise.all([Buyers(orders), LatestVersions(orders)])
//     })
//     .then(([buyers, orders]) => {
//         function OrderValue(order) {
//             return order.latestItems.concat(order.latestAdds).reduce((totalValue, item) => {
//                 return totalValue + (item.quantity * item.price)
//             }, 0)
//         }

//         function BuyerDetails(buyer) {
//             return {
//                 id: buyer.userID,
//                 name: buyer.name,
//                 shop: buyer.shop,
//                 address: buyer.address,
//                 phone: buyer.phone,
//                 numberOfTransaction: groupedOrders[buyer.userID].length,
//                 valueOfTransactions: groupedOrders[buyer.userID].reduce((totalValue, order) => {
//                     return totalValue + OrderValue(order)
//                 }, 0)
//             }
//         }

//         const groupedOrders = lodash.groupBy(orders, (order) => (order.buyerID))
//         const buyerMap = buyers.reduce((accum, buyer) => {
//             accum[buyer.userID] = buyer
//             return accum
//         }, {})

//         return lodash.sortBy(Object.keys(groupedOrders).map((buyerID) => {
//             const buyer = buyerMap[buyerID]
//             return BuyerDetails(buyer)
//         }), (detail) => (-1 * detail.valueOfTransactions))
//     })
// }

// export function BuyerReport(sellerID, buyerID, startDate, endDate) {
//     return AddTimeLimit(pg('orders').where({sellerID, buyerID}).whereNull('cancelled') , startDate, endDate)
//     .then((orders) => {
//         return LatestVersions(orders)
//     })
//     .then((orders) => {
//         function OrderValue(order) {
//             return order.latestItems.concat(order.latestAdds).reduce((totalValue, item) => {
//                 return totalValue + (item.quantity * item.price)
//             }, 0)
//         }

//         function ItemDetail(item) {
//             return {
//                 name: item.name,
//                 unit: item.unit,
//                 price: item.price,
//                 quantity: item.quantity,
//                 category: item.category,
//             }
//         }

//         const itemMap = orders.reduce((accum, order) => {
//             order.latestItems.concat(order.latestAdds).forEach((item) => {
//                 const {name, unit, price, quantity, orderID} = item
//                 const cleanName = `${name} (${unit})`
//                 if (cleanName in accum) {
//                     accum[cleanName].totalQuantity += quantity
//                     accum[cleanName].totalValue += price * quantity
//                     accum[cleanName].details.push({
//                         orderID, price, quantity,
//                     })
//                 } else {
//                     accum[cleanName] = {}
//                     accum[cleanName].name = name
//                     accum[cleanName].unit = unit
//                     accum[cleanName].totalQuantity = quantity
//                     accum[cleanName].totalValue = price * quantity
//                     accum[cleanName].details = []
//                     accum[cleanName].details.push({
//                         orderID, price, quantity,
//                     })
//                 }
//             })

//             return accum
//         }, {})

//         return {
//             orders: orders.map((order) => {
//                 return {
//                     id: order.id,
//                     totalValue: OrderValue(order),
//                     created: order.created,
//                     accepted: order.accepted,
//                     assigned: order.assigned,
//                     delivered: order.delivered,
//                     items: order.latestItems.map(ItemDetail),
//                     additionals: order.latestAdds.map(ItemDetail),
//                 }
//             }),
//             items: lodash.sortBy(Object.keys(itemMap).reduce((accum, itemName) => {
//                 accum.push(itemMap[itemName])
//                 return accum
//             }, []), (details) => (-1 * details.totalValue)),
//         }
//     })
// }

// export function AggregateItemsReport(sellerID, startDate, endDate) {
//     return AddTimeLimit(pg('orders').where({sellerID}).whereNull('cancelled') , startDate, endDate)
//     .then((orders) => {
//         return LatestVersions(orders)
//     })
//     .then((orders) => {
//         function OrderValue(order) {
//             return order.latestItems.concat(order.latestAdds).reduce((totalValue, item) => {
//                 return totalValue + (item.quantity * item.price)
//             }, 0)
//         }

//         const itemMap = orders.reduce((accum, order) => {
//             order.latestItems.concat(order.latestAdds).forEach((item) => {
//                 const {name, unit, price, quantity, orderID} = item
//                 const cleanName = `${name} (${unit})`
//                 if (cleanName in accum) {
//                     accum[cleanName].totalQuantity += quantity
//                     accum[cleanName].totalValue += price * quantity
//                 } else {
//                     accum[cleanName] = {}
//                     accum[cleanName].name = name
//                     accum[cleanName].unit = unit
//                     accum[cleanName].totalQuantity = quantity
//                     accum[cleanName].totalValue = price * quantity
//                 }
//             })

//             return accum
//         }, {})

//         return lodash.sortBy(Object.keys(itemMap).reduce((accum, itemName) => {
//             accum.push(itemMap[itemName])
//             return accum
//         }, []), (details) => (-1 * details.totalValue))
//     })
// }
