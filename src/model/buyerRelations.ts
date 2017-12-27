import pg, { FetchFactory, ORM, Table } from './index';

export enum RelationsTier {
    normal = 'normal',
    bronze = 'bronze',
    silver = 'silver',
    gold = 'gold',
}

export interface RelationsInsertParams {
    active?: boolean;
    buyerID: number;
    notes?: string;
    sellerID: number;
    type?: RelationsTier;
}

export interface Relations extends RelationsInsertParams {
    id: number;
}

export const FetchRelations = FetchFactory<Relations>(pg(Table.buyersRelations));

export function GetTier(buyerID: string, sellerID: string) {
    return FetchRelations([
        ORM.Where({ buyerID, sellerID }),
    ])
    .then(relations => {
        const relation = relations[0];
        if (relation === undefined) return 'normal';
        return relation.type || 'normal';
    });
}

interface Price {
    price: number;
    price2: number;
    price3: number;
    price4: number;
}

export function PickPrice<T extends Price>(item: T, tier: string) {
    let price = item.price;

    switch (tier) {
        case 'gold': price = item.price4 || price; break;
        case 'silver': price = item.price3 || price; break;
        case 'bronze': price = item.price2 || price; break;
        default: price = price;
    }

    delete item.price2;
    delete item.price3;
    delete item.price4;

    return item;
}

export function Activate(sellerID: number, buyerID: number) {
    return FetchRelations([
        ORM.Where({ buyerID, sellerID }),
    ])
    .then(relations => {
        if (relations.length === 0) {
            return FetchRelations([
                ORM.Insert({
                    buyerID, sellerID,
                    active: true,
                    type: 'normal',
                }),
            ]);
        }

        return FetchRelations([
            ORM.Where({ id: relations[0].id }),
            ORM.Update({ active: true, updated_at: new Date() }),
        ]);
    })
    .then(() => {
        return 'Retailer telah diaktivasi.';
    });
}

export function Deactivate(sellerID: number, buyerID: number) {
    return FetchRelations([
        ORM.Where({ buyerID, sellerID }),
    ])
    .then(relations => {
        if (relations.length === 0) {
            return 'Retailer tidak ditemukan';
        }

        return FetchRelations([
            ORM.Where({ id: relations[0].id }),
            ORM.Update({ active: false, updated_at: new Date() }),
        ])
        .then(() => {
            return 'Retailer is dinonaktifkan.';
        });
    });
}

export function ChangeTier(sellerID: number, buyerID: number, tier: RelationsTier) {
    return FetchRelations([
        ORM.Where({ buyerID, sellerID }),
    ])
    .then(relations => {
        if (relations.length === 0) throw new Error('Tidak ada relasi antara ws dan retailer');
        return FetchRelations([
            ORM.Where({ id: relations[0].id }),
            ORM.Update({ type: tier, updated_at: new Date() }),
        ]);
    });
}

export function DeleteRelations(sellerID: string, buyerID: string) {
    return FetchRelations([
        ORM.Where({ buyerID, sellerID }),
        ORM.Update({
            active: false,
            buyerID: parseInt(buyerID, 10) * -1,
            sellerID: parseInt(sellerID, 10) * -1,
        }),
    ]);
}
