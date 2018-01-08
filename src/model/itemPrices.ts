import * as Bluebird from 'bluebird';

import pg, { Fetch, FetchFactory, JoinFactory, ORM, Table } from './index';
import { Katalog } from './katalog';

export interface ItemPrices {
    id: string;
    itemID: string;
    sellerID: string;
    unit: boolean;
    price: number;
    price2: number;
    price3: number;
    price4: number;
    active: boolean;
}

export const FetchItemPrices = FetchFactory<ItemPrices>(pg(Table.itemPrices));
export const JoinKatalogOrderItems = JoinFactory(
    pg(Table.katalog),
    pg(Table.itemPrices),
    'katalog.id',
    'item_prices.itemID',
    'item_prices',
);

export function FetchItemPricesByIDs(ids: string[]) {
    return FetchItemPrices([
        ORM.WhereIn('id', ids),
    ]);
}

export function FetchKatalogItemPricesByIDs(ids: string[]) {
    return Fetch<Katalog & ItemPrices>(
        JoinKatalogOrderItems([], [ORM.WhereIn('id', ids)]),
    );
}

export function NormalizePrice(prices: number[]) {
    const leftMostNonZeroPrices = prices.reduce((accum, price) => {
        if (accum > 0) return accum;
        return price;
    }, 0);

    const mapZeroPrices = prices.reduce((accum, price) => {
        if (price !== 0) return accum.concat([price]);
        if (accum.length === 0) return accum.concat([leftMostNonZeroPrices]);
        return accum.concat([accum[accum.length - 1]]);
    }, [] as number[]);

    const sortedPrices = mapZeroPrices.filter(x => (x > 0)).sort((a, b) => (b - a));

    while (sortedPrices.length < 4) {
        sortedPrices.push(sortedPrices[sortedPrices.length - 1]);
    }

    return sortedPrices;
}

type PricesData = Array<{unit: string, prices: number[], ratio: number}>;
export function UpdatePrices(sellerID: number, itemID: number, prices: PricesData = []) {
    return FetchItemPrices([
        ORM.Where({itemID, sellerID}),
        ORM.Update({active: false}, ['id']),
    ])
    .then(prevPrices => {
        return Bluebird.reduce(prices.filter(p => p.prices.some(x => x > 0)), (accum, price, idx) => {
            const orderedPrice = NormalizePrice(price.prices);

            if (idx < prevPrices.length) {
                return FetchItemPrices([
                    ORM.Where({id: prevPrices[idx].id}),
                    ORM.Update({
                        price: orderedPrice[0],
                        price2: orderedPrice[1] || 0,
                        price3: orderedPrice[2] || 0,
                        price4: orderedPrice[3] || 0,
                        unit: price.unit,
                        active: true,
                        ratio: price.ratio,
                    }),
                ]);
            }

            return FetchItemPrices([
                ORM.Insert({
                    price: orderedPrice[0],
                    price2: orderedPrice[1] || 0,
                    price3: orderedPrice[2] || 0,
                    price4: orderedPrice[3] || 0,
                    unit: price.unit,
                    active: true,
                    itemID, sellerID,
                    ratio: price.ratio,
                }),
            ]);
        }, []);
    });
}
