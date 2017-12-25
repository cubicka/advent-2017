import * as Bluebird from 'bluebird';
import * as lodash from 'lodash';

import pg, { BuilderFn, Count, Extender, Fetch,
    FetchFactory, LeftJoin, LeftJoinFactory, ORM, Table } from './index';
import { FetchItemPrices, UpdatePrices } from './itemPrices';

export interface Katalog {
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

export interface KatalogWS {
    category?: string;
    description?: string;
    id: number;
    image?: string;
    katalogID?: number;
    name?: string;
    sellerID: number;
}

interface KatalogParams {
    category?: string;
    ids?: string[];
    limit?: number;
    name?: string;
    noImage?: boolean;
    offset?: number;
    price?: string;
}

// const FetchKatalog = FetchFactory<Katalog>(pg(Table.katalog));
const FetchKatalogWs = FetchFactory<KatalogWS>(pg(Table.katalogWs));
const JoinKatalogWS = LeftJoinFactory(pg(Table.katalog), pg(Table.katalogWs),
    'katalog.id', 'katalog_ws.katalogID', 'katalog_ws');

function QueryKatalog(katalogWsBuilders: BuilderFn[], katalogBuilders: BuilderFn[], pricesBuilders: BuilderFn[]) {
    const katalogQuery = Extender(pg(Table.katalog), katalogBuilders);
    const priceQuery = Extender(pg(Table.itemPrices), pricesBuilders);

    return [pg(Table.katalogWs)]
        .map(query => LeftJoin(query, katalogQuery, 'katalog_ws.katalogID', 'katalog.id', 'katalog'))
        .map(query => LeftJoin(query, priceQuery, 'katalog_ws.id', 'item_prices.itemID', 'item_prices'))
        .map(query => Extender(query, katalogWsBuilders))
        [0];
}

interface KatalogPrice {
    itemID: number;
    katalogCategory: string;
    katalogDescription: string;
    katalogID: number;
    katalogImage: string;
    katalogName: string;
    principalID: number;
    sku: string;
    wsCategory: string;
    wsDescription: string;
    wsImage: string;
    wsName: string;
}

export function KatalogPriceListed(
    sellerID: string,
    {category, ids, limit, name, noImage, offset, price: priceFilter}: KatalogParams,
) {
    const katalogWsQueries = [
        ORM.Where({ 'katalog_ws.sellerID': sellerID }),
        ORM.Where(function(this: any) {
            if (!name) return;

            name.split(' ').filter((s: string) => (s.length > 0)).forEach((s: string) => {
                this.andWhere(function(this: any) {
                    this.orWhere('katalog.name', 'ilike', `%${s}%`)
                    .orWhere('katalog_ws.name', 'ilike', `%${s}%`)
                    .orWhere('katalog.description', 'ilike', `%${s}%`)
                    .orWhere('katalog_ws.description', 'ilike', `%${s}%`);
                });
            });
        }),
        ORM.Where(function(this: any) {
            if (!noImage) return;

            this.andWhere(pg.raw('katalog.image is null'))
            .andWhere(pg.raw('katalog_ws.image is null'));
        }),
        ORM.Where(function(this: any) {
            if (!category) return;

            this.orWhere('katalog.category', 'ilike', category)
            .orWhere('katalog_ws.category', 'ilike', category);
        }),
        ...(ids !== undefined && ids.length > 0 ? [ORM.WhereIn('katalog_ws.id', ids)] : []),
        // ...(priceFilter === 'price' ? [ ORM.WhereNotNull('item_prices.sellerID') ] : []),
        // ...(priceFilter === 'noPrice' ? [ ORM.WhereNull('item_prices.sellerID') ] : []),
        ORM.GroupBy([
            'katalog_ws.id', 'principalID', 'sku', 'katalog.name', 'katalog_ws.name',
            'katalog.category', 'katalog_ws.category', 'katalog.image', 'katalog_ws.image',
            'katalog.description', 'katalog_ws.description', 'katalog.priority',
        ]),
        ORM.Having(pg.raw('count(*)'), ['>', 0]),
    ];

    const query = QueryKatalog(katalogWsQueries, [],
        [ ORM.Where({ 'item_prices.sellerID': sellerID, 'active': true }) ]);

    return Bluebird.all([
        Fetch<KatalogPrice>(
            Extender(query, [ORM.OrderBy('priority', 'desc'), ORM.OrderBy('katalog_ws.id', 'asc') ]),
            {
                columns: [
                    'katalog_ws.id as itemID', 'principalID', 'sku', 'katalog.name as katalogName',
                    'katalog_ws.name as wsName', 'katalog.category as katalogCategory',
                    'katalog_ws.category as wsCategory', 'katalog.image as katalogImage',
                    'katalog_ws.image as wsImage', pg.raw('coalesce(priority, 0) as priority'),
                    'katalog_ws.description as wsDescription', 'katalog.description as katalogDescription',
                ],
                limit, offset,
            },
        ),
        Count(query, 'katalog_ws.id', true),
    ])
    .then(([ katalog, count ]) => {
        const itemIDs = katalog.map(item => (item.itemID));

        return FetchItemPrices([
            ORM.Where({ sellerID, active: true }),
            ORM.WhereIn('itemID', itemIDs),
        ])
        .then(prices => {
            const pricesGrouped = lodash.groupBy(prices, price => (price.itemID));
            return katalog.map(ki => {
                const item = lodash.assign(ki, {
                    name: ki.wsName || ki.katalogName,
                    category: ki.wsCategory || ki.katalogCategory,
                    image: ki.wsImage || ki.katalogImage,
                    description: ki.wsDescription || ki.katalogDescription,
                    prices: pricesGrouped[ki.itemID],
                });

                delete item.wsCategory;
                delete item.wsDescription;
                delete item.wsImage;
                delete item.wsName;

                delete item.katalogCategory;
                delete item.katalogDescription;
                delete item.katalogImage;
                delete item.katalogName;

                return item;
            });
        })
        .then(items => {
            return { count, items };
        });
    });
}

export function KatalogPriceUnlisted(sellerID: string, {name, limit, offset, category}: KatalogParams) {
    const katalogQuery = [
        ORM.WhereNull('sellerID'),
        ORM.Where(function(this: any) {
            if (!name) return;

            name.split(' ').filter((s: string) => (s.length > 0)).forEach((s: string) => {
                this.andWhere(function(this: any) {
                    this.orWhere('katalog.name', 'ilike', `%${s}%`)
                    .orWhere('katalog_ws.name', 'ilike', `%${s}%`)
                    .orWhere('katalog.description', 'ilike', `%${s}%`)
                    .orWhere('katalog_ws.description', 'ilike', `%${s}%`);
                });
            });
        }),
        ORM.Where(function(this: any) {
            if (!category) return;

            this.orWhere('katalog.category', 'ilike', category)
            .orWhere('katalog_ws.category', 'ilike', category);
        }),
    ];

    const query = JoinKatalogWS(katalogQuery, [ORM.Where({ sellerID })]);
    return Bluebird.all([
        Fetch<Katalog>(
            Extender(query, [ ORM.OrderBy('priority', 'desc'), ORM.OrderBy('katalog_ws.id', 'asc') ]),
            {
                limit, offset,
                columns: [
                    'katalog.id as itemID', 'katalog.category as category', 'katalog.image as image',
                    'katalog.name as name', 'katalog.description as description',
                ],
            },
        ),
        Count(query),
    ])
    .then(([items, count]) => {
        return { count, items };
    });
}

interface KatalogWSParams {
    category?: string;
    description?: string;
    image?: string;
    itemID?: number;
    name?: string;
    prices?: Array<{unit: string, prices: number[]}>;
}

export function WSUpdate(sellerID: number, katalogWsID: string, updateData: KatalogWSParams) {
    return Bluebird.try(() => {
        if (katalogWsID === undefined) {
            return FetchKatalogWs([
                ORM.Insert({
                    sellerID,
                }, ['id']),
            ]);
        }

        return FetchKatalogWs([
            ORM.Where({ id: parseInt(katalogWsID, 10), sellerID }),
        ]);
    })
    .then(katalogs => {
        if (katalogs.length === 0) throw new Error('Data barang tidak ditemukan.');

        const { category, description, image, itemID, name } = updateData;
        const validData: { [x: string]: string | number } = {};
        if (category !== undefined) validData.category = category;
        if (description !== undefined) validData.description = description;
        if (image !== undefined) validData.image = image;
        if (itemID !== undefined) validData.katalogID = itemID;
        if (name !== undefined) validData.name = name;

        return FetchKatalogWs([
            ORM.Where({ id: katalogs[0].id }),
            ORM.Update({...validData}, ['id']),
        ]);
    })
    .then(katalogs => {
        if (updateData.prices !== undefined) {
            return UpdatePrices(sellerID, katalogs[0].id, updateData.prices);
        }

        return [];
    });
}

export function WSImageUpdate(sellerID: number, itemID: number, image: string) {
    return FetchKatalogWs([
        ORM.Where({ id: itemID, sellerID }),
        ORM.Update({ image }),
    ]);
}

export function WSDelete(sellerID: number, itemID: number) {
    return FetchKatalogWs([
        ORM.Where({ id: itemID, sellerID }),
        ORM.Update({ sellerID: -1 * sellerID }),
    ]);
}
