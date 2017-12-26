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
