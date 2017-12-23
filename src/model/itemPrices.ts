import { ORM, Table } from './index';
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

const FetchItemPrices = ORM.Fetch<ItemPrices>(Table.itemPrices);
const FetchKatalogOrderItems = ORM.FetchJoin<Katalog, ItemPrices>(
    Table.katalog, Table.itemPrices,
    'katalog.id',
    'item_prices.itemID',
);

export function FetchItemPricesByIDs(ids: string[]) {
    return FetchItemPrices([
        ORM.FilterIn('id', ids),
    ]);
}

export function FetchKatalogItemPricesByIDs(ids: string[]) {
    return FetchKatalogOrderItems([], [
        ORM.FilterIn('id', ids),
    ]);
}
