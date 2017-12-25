import * as Bluebird from 'bluebird';
// import Excel from 'exceljs';
// import express from 'express';
import * as lodash from 'lodash';
// import tempfile from 'tempfile';

// import { FetchBuyer } from './buyers';
import { ORM } from './index';
import { FetchJoinKatalogWs } from './katalog';
import { OrderItems } from './orderItems';
import { CountOrder, DetailedOrder, List } from './orders';
// import { CountOrder, DetailedOrder, FetchOrders, List, Order } from './orders';

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

function LatestOrder(sellerID: number, startDate: Date, endDate: Date) {
    const builders = [
        ...TimeLimitBuilder(startDate, endDate),
        ORM.WhereNull('cancelled'),
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
            orders: latestOrders.sort((a, b) => {
                if (a.details.created < b.details.created) return 1;
                if (a.details.created > b.details.created) return -1;
                return 0;
            }),
            items, revenue: totalRevenue,
        };
    });
}

// export function ExportOrders(stream: express.Response, sellerID: number, startDate: Date, endDate: Date) {
//     const builders = [
//         ...TimeLimitBuilder(startDate, endDate),
//     ];

//     if (sellerID !== -1) {
//         builders.push(ORM.Where({ sellerID }));
//     }

//     return FetchOrders(builders, { sortBy: 'created', sortOrder: 'desc' })
//     .then(orders => {
//         const buyerIDs = orders.map(order => (order.buyerID));
//         const orderIDs = orders.map(order => (order.id));

//         return Promise.all([
//             pg('buyer_details').whereIn('userID', buyerIDs).select('userID', 'name', 'shop', 'address', 'phone'),
//             pg('order_items').whereIn('orderID', orderIDs),
//             pg('additionals').whereIn('orderID', orderIDs),
//         ])
//         .then(([buyers, items, additionals]) => {
//             return Promise.all([
//                 buyers,
//                 orders.map(order => {
//                     const buyer = buyers.find((user: any) => (user.userID === order.buyerID));
//                     const orderItems = items.filter((item: any) => (item.orderID === order.id));
//                     const orderAdds = additionals.filter((item: any) => (item.orderID === order.id));

//                     const latestVersion = Math.max(
//                         ...orderItems.map((item: any) => (item.revision)),
//                         ...orderAdds.map((item: any) => (item.revision)),
//                     );

//                    const totalPrice = orderItems.filter((item: any) =>
//                        (parseInt(item.revision, 10) === latestVersion))
//                     .reduce((total: any, item: any) => {
//                         return total + item.quantity * item.price;
//                     }, 0);

//                     return lodash.assign(order, {
//                         buyer, items: orderItems, totalPrice,
//                         latestAdds: orderAdds.filter((item: any) => (latestVersion === parseInt(item.revision, 10))),
//                        latestItems: orderItems.filter((item: any) =>
//                            (latestVersion === parseInt(item.revision, 10))),
//                     });
//                 }),

//                 pg('katalog_ws').whereIn('id', items.map((item: any) => (item.itemID))),
//             ]);
//         });
//     })
//     .then(([buyers, orders, katalog]) => {
//         const fileName = 'report';
//         stream.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//         stream.setHeader('Content-Disposition', 'attachment; filename=\'export_' + fileName + '.xlsx\'');

//         const workbook = new Excel.Workbook();

//         function SimplerTime(datetime: string) {
//             const d = new Date(datetime);
//             d.setHours(d.getHours() + 7);
//             const iso = d.toISOString();
//             return `${iso.slice(0, 10)} ${iso.slice(11, 16)} (WIB)`;
//         }

//         function FormatHarga(x: number) {
//             if (!x) {
//                 return 0;
//             }
//             return x.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
//         }

//         function Status(order: any) {
//             if (order.cancelled) return 'Dibatalkan';
//             if (order.delivered) return 'Telah Diterima';
//             if (order.pickedup) return 'Dalam Pengantaran';
//             return 'Sedang Diproses';
//         }

//         const sheet = workbook.addWorksheet('detail pesanan');
//         const columns = ['Tanggal Pemesanan', 'Pemesan', 'Alamat', 'No. Telp', 'Status', 'Total Transaksi',
//             'Tanggal Pengantaran', 'Tanggal Diterima', 'Tanggal Pembatalan'];
//         sheet.addRow(columns).commit();

//         const buyerMap = buyers.reduce((accum: any, buyer: any) => {
//             accum[buyer.userID] = buyer;
//             accum[buyer.userID].totalTransaksi = 0;
//             accum[buyer.userID].jumlahTransaksi = 0;
//             return accum;
//         }, {});

//         let totalTransaksi = 0;
//         orders.forEach(order => {
//             const row = [];
//             row.push(SimplerTime(order.created));
//             row.push(order.buyer.shop);
//             row.push(order.buyer.address);
//             row.push(order.buyer.phone);
//             row.push(Status(order));
//             row.push(`Rp ${FormatHarga(order.totalPrice)}`);
//             row.push(order.pickedup ? SimplerTime(order.pickedup) : '-');
//             row.push(order.delivered ? SimplerTime(order.delivered) : '-');
//             row.push(order.cancelled ? SimplerTime(order.cancelled) : '-');

//             totalTransaksi += order.totalPrice;
//             buyerMap[order.buyerID].totalTransaksi += order.totalPrice;
//             buyerMap[order.buyerID].jumlahTransaksi += 1;
//             sheet.addRow(row).commit();
//         });

//         const buyerSheet = workbook.addWorksheet('retailer aktif');
//         buyerSheet.addRow(['Nama Toko', 'Nama Pemilik', 'No. Telp', 'Alamat', 'Jumlah Transaksi',
//             'Total Nilai Transaksi']).commit();
//         const buyersOrdered = Object.keys(buyerMap).map(buyerID => {
//             const buyer = buyerMap[buyerID];
//             return buyer;
//         }).sort((a, b) => ((a.totalTransaksi - b.totalTransaksi) * -1));
//         buyersOrdered.forEach((buyer: any) => {
//             const row = [];
//             row.push(buyer.shop);
//             row.push(buyer.name);
//             row.push(buyer.phone);
//             row.push(buyer.address);
//             row.push(buyer.jumlahTransaksi);
//             row.push(buyer.totalTransaksi);
//             buyerSheet.addRow(row).commit();
//         });

//         const katalogMap = katalog.reduce((accum: any, item: any) => {
//             accum[item.id] = item;
//             return accum;
//         }, {});

//         const itemSheet = workbook.addWorksheet('detail barang');
//         itemSheet.addRow(['Tangal Pemesanan', 'Pemesan', 'No Telp', 'Nama Barang', 'Unit', 'Jumlah',
//             'Harga Per Barang', 'Harga Total']).commit();
//         orders.forEach(order => {
//             const row: any[] = [];
//             row.push(SimplerTime(order.created));
//             row.push(order.buyer.shop);
//             row.push(order.buyer.phone);
//             order.latestItems.forEach((item: any) => {
//                 const katalogItem = katalogMap[item.itemID] || {};
//                 const itemRow = [...row];

//                 itemRow.push(katalogItem.name);
//                 itemRow.push(item.unit);
//                 itemRow.push(item.quantity);
//                 itemRow.push(item.price);
//                 itemRow.push(item.quantity * item.price);
//                 itemSheet.addRow(itemRow).commit();
//             });

//             order.latestAdds.forEach((item: any) => {
//                 const itemRow = [...row];

//                 itemRow.push(item.name);
//                 itemRow.push(item.unit);
//                 itemRow.push(item.quantity);
//                 itemRow.push(item.price);
//                 itemRow.push(item.quantity * item.price);
//                 itemSheet.addRow(itemRow).commit();
//             });
//         });

//         const rekapSheet = workbook.addWorksheet('rekap');
//         rekapSheet.addRow(['Jumlah Pesanan', orders.length + ' pesanan']).commit();
//         rekapSheet.addRow(['Total Transaksi', `Rp ${FormatHarga(totalTransaksi)}`]).commit();
//         rekapSheet.addRow(['Jumlah Sedang Diproses',
//             orders.filter(order => (Status(order) === 'Sedang Diproses')).length + ' pesanan']).commit();
//         rekapSheet.addRow(['Jumlah Dalam Pengantaran',
//             orders.filter(order => (Status(order) === 'Dalam Pengantaran')).length + ' pesanan']).commit();
//         rekapSheet.addRow(['Jumlah Dalam Pengantaran',
//             orders.filter(order => (Status(order) === 'Dalam Pengantaran')).length + ' pesanan']).commit();
//         rekapSheet.addRow(['Jumlah Dibatalkan',
//             orders.filter(order => (Status(order) === 'Dibatalkan')).length]).commit();

//         const tempFilePath = tempfile((new Date()).getTime().toString() + '.xlsx');
//         workbook.xlsx.writeFile(tempFilePath).then(() => {
//             stream.sendFile(tempFilePath, (err: any) => {
//                 throw new Error('Gagal mengirim report.');
//             });
//         });
//     });
// }

// function LatestVersions(orders: Order[]) {
//     const orderIDs = orders.map(order => (order.id));

//     return Promise.all([
//         pg('order_items').innerJoin('katalog', 'katalog.id', 'order_items.itemID').whereIn('orderID',
// orderIDs).select('orderID', 'name', 'unit', 'quantity', 'order_items.price as price', 'revision'),
//         pg('additionals').whereIn('orderID', orderIDs),
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

// function Buyers(orders: Order[]) {
//     const buyerIDs = lodash.uniq(orders.map(order => (order.buyerID)));
//     return FetchBuyer([ ORM.WhereIn('userID', buyerIDs) ]);
// }

// export function AggregateBuyersReport(sellerID: number, startDate: Date, endDate: Date) {
//     const builders = [
//         ...TimeLimitBuilder(startDate, endDate),
//         ORM.WhereNull('cancelled'),
//         ORM.Where({ sellerID }),
//     ];

//     return FetchOrders(builders)
//     .then(orders => {
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

export default {
    Dashboard,
    // ExportOrders,
};

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
