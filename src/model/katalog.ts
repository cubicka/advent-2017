import * as Bluebird from 'bluebird';
import * as lodash from 'lodash';

import pg, { BuilderFn, Count, Extender, Fetch,
    FetchFactory, FetchLeftJoin, LeftJoin, LeftJoinFactory, ORM, QueryParams, Table } from './index';
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
    forWs?: boolean;
}

// const FetchKatalog = FetchFactory<Katalog>(pg(Table.katalog));
const FetchKatalogWs = FetchFactory<KatalogWS>(pg(Table.katalogWs));
const JoinKatalogWS = LeftJoinFactory(pg(Table.katalog), pg(Table.katalogWs),
    'katalog.id', 'katalog_ws.katalogID', 'katalog_ws');

function CleanKatalogPrice(katalogs: KatalogPrice[]) {
    return katalogs.map(katalog => {
        const item = lodash.assign(katalog, {
            name: katalog.wsName || katalog.katalogName,
            category: katalog.wsCategory || katalog.katalogCategory,
            image: katalog.wsImage || katalog.katalogImage,
            description: katalog.wsDescription || katalog.katalogDescription,
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
}

export function FetchJoinKatalogWs(
    katalogWsBuilders: BuilderFn[] = [],
    katalogBuilders: BuilderFn[] = [],
    params: QueryParams = {},
) {
    return FetchLeftJoin<KatalogPrice>(pg(Table.katalogWs), pg(Table.katalog),
        'katalog_ws.katalogID', 'katalog.id', 'katalog')
        (katalogWsBuilders, katalogBuilders, {
            ...params,
            columns: [
                pg.raw('coalesce(priority, 0) as priority'), 'principalID', 'katalog.sku as sku',
                'katalog_ws.id as itemID', 'katalog.id as katalogID',
                'katalog.category as katalogCategory', 'katalog_ws.category as wsCategory',
                'katalog_ws.description as wsDescription', 'katalog.description as katalogDescription',
                'katalog.image as katalogImage', 'katalog_ws.image as wsImage',
                'katalog.name as katalogName', 'katalog_ws.name as wsName',
            ],
        })
    .then(CleanKatalogPrice);
}

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
    id: number;
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
    price: number;
    price2: number;
    price3: number;
    price4: number;
}

export function KatalogPriceListed(
    sellerID: string,
    {category, forWs, ids, limit, name, noImage, offset, price: priceFilter}: KatalogParams,
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
        ...(priceFilter === 'price' ? [ ORM.WhereNotNull('item_prices.sellerID') ] : []),
        ...(priceFilter === 'noPrice' ? [ ORM.WhereNull('item_prices.sellerID') ] : []),
        ORM.GroupBy([
            'katalog_ws.id', 'katalog.id', 'principalID', 'katalog.sku', 'katalog.name', 'katalog_ws.name',
            'katalog.category', 'katalog_ws.category', 'katalog.image', 'katalog_ws.image',
            'katalog.description', 'katalog_ws.description', 'katalog.priority',
        ]),
        ORM.Having(pg.raw('count(*)'), ['>', 0]),
    ];

    const itemPricesFilter: {[name: string]: string | boolean} = {
        'item_prices.sellerID': sellerID,
        'active': true,
    };

    if (!forWs) {
        itemPricesFilter.onSale = true;
    }

    const query = QueryKatalog(katalogWsQueries, [], [ ORM.Where(itemPricesFilter) ]);

    return Bluebird.all([
        Fetch<KatalogPrice>(
            Extender(query, [ORM.OrderBy('priority', 'desc'), ORM.OrderBy('katalog_ws.id', 'asc') ]),
            {
                columns: [
                    pg.raw('coalesce(priority, 0) as priority'), 'principalID', 'katalog.sku as sku',
                    'katalog_ws.id as itemID', 'katalog.id as katalogID',
                    'katalog.category as katalogCategory', 'katalog_ws.category as wsCategory',
                    'katalog_ws.description as wsDescription', 'katalog.description as katalogDescription',
                    'katalog.image as katalogImage', 'katalog_ws.image as wsImage',
                    'katalog.name as katalogName', 'katalog_ws.name as wsName',
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
                    // .orWhere('katalog_ws.name', 'ilike', `%${s}%`)
                    .orWhere('katalog.description', 'ilike', `%${s}%`);
                    // .orWhere('katalog_ws.description', 'ilike', `%${s}%`);
                });
            });
        }),
        ORM.Where(function(this: any) {
            if (!category) return;

            this.orWhere('katalog.category', 'ilike', category);
            // .orWhere('katalog_ws.category', 'ilike', category);
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
    prices?: Array<{unit: string, prices: number[], ratio: number, onSale: boolean}>;
}

export function WSUpdate(sellerID: number, katalogWsID: string, updateData: KatalogWSParams) {
    function CleanCategory(category: string) {
        return category.split('').map(c => c === '&' ? '-' : c).join('');
    }

    return Bluebird.try(() => {
        if (katalogWsID === undefined) {
            return FetchKatalogWs([
                ORM.Insert({
                    sellerID,
                    name: updateData.name || '',
                    category: CleanCategory(updateData.category || ''),
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
        if (category !== undefined) validData.category = CleanCategory(category);
        if (description !== undefined) validData.description = description;
        if (image !== undefined) validData.image = image;
        if (itemID !== undefined) validData.katalogID = itemID;
        if (name !== undefined) validData.name = name;

        return FetchKatalogWs([
            ORM.Where({ id: katalogs[0].id }),
            ORM.Update({...validData, updated_at: new Date()}, ['id']),
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
        ORM.Update({ image, updated_at: new Date() }),
    ]);
}

export function WSDelete(sellerID: number, itemID: number) {
    return FetchKatalogWs([
        ORM.Where({ id: itemID, sellerID }),
        ORM.Update({ sellerID: -1 * sellerID, updated_at: new Date() }),
    ]);
}

export function SellerCategory(sellerID: string) {
    return FetchJoinKatalogWs([
        ORM.Where({ sellerID }),
    ], [], {
        // columns: ['katalog_ws.category as category', pg.raw('coalesce(priority,0) as priority')],
        sortOrder: 'desc',
        sortBy: 'priority',
    })
    .then(result => {
        return lodash.uniq(result.map(x => (x.category.toLowerCase())));
    });
}
