import * as bluebird from 'bluebird';
import * as Excel from 'exceljs';
import express from 'express';
import * as tempfile from 'tempfile';

import pg, { Fetch, FetchTable, Insert, JoinFactory, Table, Update, Where, WhereIn } from './index';
import { Brand, Category, GetAllMasterSKU, GetPrices } from './products';
import { FetchSellers } from './sellers';
import { FetchUsers } from './users';

interface OrderItem {
    orderid: string;
    skucode: string;
    brandcode: string;
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
const FetchBrand = FetchTable<Brand>(Table.brand);
const FetchCategory = FetchTable<Category>(Table.category);
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
        const usercodes = orders.map(order => order.usercode);
        const storecodes = orders.map(order => order.storecode);

        return bluebird.all([
            Fetch<OrderItem>(
                FetchOrderItemDetail([], [
                    WhereIn('orderid', orderIDs),
                ]),
            ),
            FetchUsers([
                WhereIn('usercode', usercodes),
            ]),
            FetchSellers([
                WhereIn('storecode', storecodes),
            ]),
        ])
        .then(([orderItems, users, stores]) => {
            return orders.map(order => {
                return Object.assign({}, order, {
                    items: orderItems.filter(item => item.orderid === order.orderid),
                    retailer: users.find(u => u.usercode.toString() === order.usercode),
                    grosir: stores.find(s => s.storecode.toString() === order.storecode),
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
        const usercodes = orders.map(order => order.usercode);
        const storecodes = orders.map(order => order.storecode);

        return bluebird.all([
            Fetch<OrderItem>(
                FetchOrderItemDetail([], [
                    WhereIn('orderid', orderIDs),
                ]),
            ),
            FetchUsers([
                WhereIn('usercode', usercodes),
            ]),
            FetchSellers([
                WhereIn('storecode', storecodes),
            ]),
        ])
        .then(([orderItems, users, stores]) => {
            return orders.map(order => {
                return Object.assign({}, order, {
                    items: orderItems.filter(item => item.orderid === order.orderid),
                    retailer: users.find(u => u.usercode.toString() === order.usercode),
                    grosir: stores.find(s => s.storecode.toString() === order.storecode),
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

export function GenerateTransactionExcel(stream: express.Response) {
    const fileName = 'report';
    stream.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    stream.setHeader('Content-Disposition', 'attachment; filename=\'export_' + fileName + '.xlsx\'');

    const workbook = new Excel.Workbook();

    function SimplerTime(datetime: string) {
        const d = new Date(datetime);
        d.setHours(d.getHours() + 7);
        const iso = d.toISOString();
        return `${iso.slice(0, 10)} ${iso.slice(11, 16)} (WIB)`;
    }

    function FormatHarga(x: number) {
        if (!x) {
            return 0;
        }
        return x.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    }

    function Status(order: any) {
        if (order.cancelled) return 'Dibatalkan';
        if (order.delivered) return 'Telah Diterima';
        if (order.pickedup) return 'Dalam Pengantaran';
        return 'Sedang Diproses';
    }

    const sheet = workbook.addWorksheet('detail pesanan');
    const columns = ['City', 'Date', 'Year', 'Month', 'Day', 'Hour', 'OrderID', 'Store Name', 'User', 'Category Name',
        'Brand Name', 'SKU Name', 'Qty', 'Price', 'Total', 'Pick Time', 'Create Date', 'Status'];
    sheet.addRow(columns).commit();

    return FetchOrderMaster([
    ], {
        sortBy: 'orderid',
        sortOrder: 'desc',
    })
    .then(orders => {
        const orderIDs = orders.map(order => order.orderid);
        const usercodes = orders.map(order => order.usercode);
        const storecodes = orders.map(order => order.storecode);

        return bluebird.all([
            Fetch<OrderItem>(
                FetchOrderItemDetail([], [
                    WhereIn('orderid', orderIDs),
                ]),
            ),
            FetchUsers([
                WhereIn('usercode', usercodes),
            ]),
            FetchSellers([
                WhereIn('storecode', storecodes),
            ]),
        ])
        .then(([orderItems, users, stores]) => {
            const brandcodes = orderItems.map(item => item.brandcode);
            const categorycodes = orderItems.map(item => item.categorycode);

            return bluebird.all([
                FetchBrand([
                    WhereIn('brandcode', brandcodes),
                ]),
                FetchCategory([
                    WhereIn('categorycode', categorycodes),
                ]),
            ])
            .then(([brands, categories]) => {
                return [ orderItems.map(item => {
                    return Object.assign(item, {
                        brand: brands.find(b => b.brandcode === item.brandcode),
                        category: categories.find(c => c.categorycode === item.categorycode),
                    });
                }), users, stores];
            });
        })
        .then(([orderItems, users, stores]) => {
            return orders.map(order => {
                return Object.assign({}, order, {
                    items: orderItems.filter(item => item.orderid === order.orderid),
                    retailer: users.find(u => u.usercode.toString() === order.usercode),
                    grosir: stores.find(s => s.storecode.toString() === order.storecode),
                });
            });
        });
    })
    .then(transactions => {
        transactions.forEach(t => {
            const d = new Date(t.uploadtime);
            const city = t.retailer.City;
            const date = SimplerTime(d);
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const day = d.getDay();
            const time = d.toISOString().slice(11, 16);
            const orderID = t.orderid;
            const user = t.retailer.name;
            const store = t.grosir.name;
            const picktime = SimplerTime(new Date(t.picktime));
            const createdate = SimplerTime(new Date(t.uploadtime));
            const status = t.iscanceled === '1' ? 'Batal' : (t.isprint === '1' ? 'Printed' : 'Antri');

            t.items.forEach(item => {
                const categoryname = item.category.categoryname;
                const brandname = item.brand.brandname;
                const skuname = item.description;
                const qty = item.pcsqty;
                const price = parseFloat(item.price);
                const total = item.pcsqty * parseFloat(item.price);

                sheet.addRow([
                    city, date, year, month, day, time, orderID, store, user, categoryname, brandname,
                    skuname, qty, price, total, picktime, createdate, status,
                ]).commit();
            });
        });

        const tempFilePath = tempfile((new Date()).getTime().toString() + '.xlsx');
        workbook.xlsx.writeFile(tempFilePath).then(() => {
            stream.sendFile(tempFilePath, (err: any) => {
                if (err) throw new Error('Gagal mengirim report.');
            });
        });
    });

    // let totalTransaksi = 0;
    // orders.forEach(order => {
    //     const row = [];
    //     row.push(SimplerTime(order.created));
    //     row.push(order.buyer.shop);
    //     row.push(order.buyer.address);
    //     row.push(order.buyer.phone);
    //     row.push(Status(order));
    //     row.push(`Rp ${FormatHarga(order.totalPrice)}`);
    //     row.push(order.pickedup ? SimplerTime(order.pickedup) : '-');
    //     row.push(order.delivered ? SimplerTime(order.delivered) : '-');
    //     row.push(order.cancelled ? SimplerTime(order.cancelled) : '-');

    //     totalTransaksi += order.totalPrice;
    //     buyerMap[order.buyerID].totalTransaksi += order.totalPrice;
    //     buyerMap[order.buyerID].jumlahTransaksi += 1;
    //     sheet.addRow(row).commit();
    // });

    // const buyerSheet = workbook.addWorksheet('retailer aktif');
    // buyerSheet.addRow(['Nama Toko', 'Nama Pemilik', 'No. Telp', 'Alamat', 'Jumlah Transaksi',
    //     'Total Nilai Transaksi']).commit();
    // const buyersOrdered = Object.keys(buyerMap).map(buyerID => {
    //     const buyer = buyerMap[buyerID];
    //     return buyer;
    // }).sort((a, b) => ((a.totalTransaksi - b.totalTransaksi) * -1));
    // buyersOrdered.forEach((buyer: any) => {
    //     const row = [];
    //     row.push(buyer.shop);
    //     row.push(buyer.name);
    //     row.push(buyer.phone);
    //     row.push(buyer.address);
    //     row.push(buyer.jumlahTransaksi);
    //     row.push(buyer.totalTransaksi);
    //     buyerSheet.addRow(row).commit();
    // });

    // const katalogMap = katalog.reduce((accum: any, item: any) => {
    //     accum[item.id] = item;
    //     return accum;
    // }, {});

    // const itemSheet = workbook.addWorksheet('detail barang');
    // itemSheet.addRow(['Tangal Pemesanan', 'Pemesan', 'No Telp', 'Nama Barang', 'Unit', 'Jumlah',
    //     'Harga Per Barang', 'Harga Total']).commit();
    // orders.forEach(order => {
    //     const row: any[] = [];
    //     row.push(SimplerTime(order.created));
    //     row.push(order.buyer.shop);
    //     row.push(order.buyer.phone);
    //     order.latestItems.forEach((item: any) => {
    //         const katalogItem = katalogMap[item.itemID] || {};
    //         const itemRow = [...row];

    //         itemRow.push(katalogItem.name);
    //         itemRow.push(item.unit);
    //         itemRow.push(item.quantity);
    //         itemRow.push(item.price);
    //         itemRow.push(item.quantity * item.price);
    //         itemSheet.addRow(itemRow).commit();
    //     });

    //     order.latestAdds.forEach((item: any) => {
    //         const itemRow = [...row];

    //         itemRow.push(item.name);
    //         itemRow.push(item.unit);
    //         itemRow.push(item.quantity);
    //         itemRow.push(item.price);
    //         itemRow.push(item.quantity * item.price);
    //         itemSheet.addRow(itemRow).commit();
    //     });
    // });

    // const rekapSheet = workbook.addWorksheet('rekap');
    // rekapSheet.addRow(['Jumlah Pesanan', orders.length + ' pesanan']).commit();
    // rekapSheet.addRow(['Total Transaksi', `Rp ${FormatHarga(totalTransaksi)}`]).commit();
    // rekapSheet.addRow(['Jumlah Sedang Diproses',
    //     orders.filter(order => (Status(order) === 'Sedang Diproses')).length + ' pesanan']).commit();
    // rekapSheet.addRow(['Jumlah Dalam Pengantaran',
    //     orders.filter(order => (Status(order) === 'Dalam Pengantaran')).length + ' pesanan']).commit();
    // rekapSheet.addRow(['Jumlah Dalam Pengantaran',
    //     orders.filter(order => (Status(order) === 'Dalam Pengantaran')).length + ' pesanan']).commit();
    // rekapSheet.addRow(['Jumlah Dibatalkan',
    //     orders.filter(order => (Status(order) === 'Dibatalkan')).length]).commit();

    // const tempFilePath = tempfile((new Date()).getTime().toString() + '.xlsx');
    // workbook.xlsx.writeFile(tempFilePath).then(() => {
    //     stream.sendFile(tempFilePath, (err: any) => {
    //         throw new Error('Gagal mengirim report.');
    //     });
    // });
}

export function generateMasterSKU(stream: express.Response, limit: number, offset: number) {
    const fileName = 'master_sku';
    stream.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    stream.setHeader('Content-Disposition', 'attachment; filename=\'export_' + fileName + '.xlsx\'');

    const workbook = new Excel.Workbook();

    function SimplerTime(datetime: string) {
        const d = new Date(datetime);
        d.setHours(d.getHours() + 7);
        const iso = d.toISOString();
        return `${iso.slice(0, 10)} ${iso.slice(11, 16)} (WIB)`;
    }

    function FormatHarga(x: number) {
        if (!x) {
            return 0;
        }
        return x.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    }

    const sheet = workbook.addWorksheet('detail pesanan');
    const columns = ['SKU Code', 'Nama', 'Brand', 'Deskripsi', 'Kategori', 'Sub Kategori', 'Barcode',
    'Case Size', 'Weight'];
    sheet.addRow(columns).commit();

    return GetAllMasterSKU(limit, offset)
    .then(products => {
        // return products.map(p => [
        //             p.skucode,
        //             p.description,
        //             p.brand,
        //             p.fulldescription,
        //             p.category,
        //             p.subcategory,
        //             p.barcode,
        //             p.casesize,
        //             p.weight,
        //         ]);
        products.forEach(p => {
            sheet.addRow([
                p.skucode,
                p.description,
                p.brandname,
                p.fulldescription,
                p.categoryname,
                p.subcategoryname,
                p.barcode,
                p.casesize,
                p.weight,
            ]).commit();
        });

        const tempFilePath = tempfile((new Date()).getTime().toString() + '.xlsx');
        workbook.xlsx.writeFile(tempFilePath).then(() => {
            stream.sendFile(tempFilePath, (err: any) => {
                if (err) throw new Error('Gagal mengirim report.');
            });
        });
    });
}
