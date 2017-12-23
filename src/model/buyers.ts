import * as Bluebird from 'bluebird';
import knex from 'knex';

import { Normalize } from '../util/phone';
import { Omit } from '../util/type';

import { ORM, Table } from './index';
import { CreateUser, User } from './users';

export interface Buyer {
    address: string;
    cityID: string;
    ktp?: string;
    latitude?: string;
    longitude?: string;
    name: string;
    phone: string;
    profilePicture?: string;
    selfie?: string;
    shop: string;
    signature?: string;
    stateID: string;
    userID: string;
    verification?: string;
    wsrange?: string;
    zipcode?: string;
}

export enum RelationsTier {
    normal = 'normal',
    bronze = 'bronze',
    silver = 'silver',
    gold = 'gold',
}

export interface Relations {
    buyerID: string;
    id: number;
    sellerID: string;
    type: RelationsTier;
    active: boolean;
}

const FetchBuyer = ORM.Fetch<Buyer>(Table.buyers);
const FetchRelations = ORM.Fetch<Relations>(Table.buyersRelations);
const FetchLeftJoinBuyerDetailsRelations = ORM.FetchLeftJoin<Relations,  Buyer>(
    Table.buyers, Table.buyersRelations, 'buyer_details.userID', 'buyer_relations.buyerID');
const FetchAndCountBuyerDetailsRelations = ORM.FetchJoinAndCount<Relations,  Buyer>(
    Table.buyers, Table.buyersRelations, 'buyer_details.userID', 'buyer_relations.buyerID');

function CreateBuyer(seller: Omit<Buyer, 'userID'>, userData: Omit<User, 'id'>): Bluebird<Buyer> {
    return CreateUser(userData)
    .then(createdUser => {
        return FetchBuyer([
            ORM.Insert({ ...seller, userID: createdUser.id }),
        ])
        .then(users => users[0]);
    });
}

interface ListForSellerParams {
    limit: number;
    name: string;
    offset: number;
    sortBy: string;
    sortOrder: string;
}

function ListForSeller(sellerID: string, {limit, name = '', offset, sortBy = '', sortOrder = ''}: ListForSellerParams) {
    function SortByParam() {
        switch (sortBy.toLowerCase()) {
            case 'name': return ['name', 'asc'];
            case 'shop': return ['shop', 'asc'];
            default: return ['buyer_relations.created_at', 'desc'];
        }
    }

    function SortOrderParam(defaultValue: string) {
        switch (sortOrder.toLowerCase()) {
            case 'asc': return 'asc';
            case 'desc': return 'desc';
            default: return defaultValue;
        }
    }

    const sortByParam = SortByParam();
    const sortOrderParam = SortOrderParam(sortByParam[1]);

    return FetchAndCountBuyerDetailsRelations([
        ORM.FilterBy(function(this: knex.QueryBuilder) {
            const nameTokens = name.split(' ').map(s => (s.replace(/[^0-9a-z]/gi, ''))).filter(s => (s.length > 0));

            nameTokens.forEach(token => {
                this.andWhere(function(this: knex.QueryBuilder) {
                    this.orWhere('name', 'ilike', `%${token}%`).orWhere('shop', 'ilike', `%${token}%`);
                });
            });
        }),
    ], [
        ORM.FilterBy({ sellerID }),
    ], {
        limit, offset, sortBy: sortByParam[0], sortOrder: sortOrderParam,
    })
    .then(({ count, list }) => {
        return {
            count,
            retailers: list,
        };
    });
}

function ListByPhone(phone: string) {
    return FetchLeftJoinBuyerDetailsRelations([
        ORM.FilterBy({phone: Normalize(phone)}),
    ])
    .then(buyers => {
        return buyers.map(buyer => {
            return Object.assign(buyer, {
                tier: buyer.type || 'normal',
                active: buyer.active || false,
            });
        });
    });
}

function Activate(sellerID: string, buyerID: string) {
    return FetchRelations([
        ORM.FilterBy({ buyerID, sellerID }),
    ])
    .then(relations => {
        if (relations.length === 0) {
            return FetchRelations([
                ORM.Insert({
                    buyerID, sellerID,
                    active: true,
                    tier: 'normal',
                }),
            ]);
        }

        return FetchRelations([
            ORM.FilterBy({ id: relations[0].id }),
            ORM.Update({ active: true }),
        ]);
    })
    .then(() => {
        return 'Retailer telah diaktivasi.';
    });
}

function Deactivate(sellerID: string, buyerID: string) {
    return FetchRelations([
        ORM.FilterBy({ buyerID, sellerID }),
    ])
    .then(relations => {
        if (relations.length === 0) {
            return 'Retailer tidak ditemukan';
        }

        return FetchRelations([
            ORM.FilterBy({ id: relations[0].id }),
            ORM.Update({ active: false }),
        ])
        .then(() => {
            return 'Retailer is dinonaktifkan.';
        });
    });
}

function ChangeTier(sellerID: string, buyerID: number, tier: RelationsTier) {
    return FetchRelations([
        ORM.FilterBy({ buyerID, sellerID }),
    ])
    .then(relations => {
        if (relations.length === 0) throw new Error('Tidak ada relasi antara ws dan retailer');
        return FetchRelations([
            ORM.FilterBy({ id: relations[0].id }),
            ORM.Update({ type: tier }),
        ]);
    });
}

export default {
    Activate,
    ChangeTier,
    CreateBuyer,
    Deactivate,
    ListByPhone,
    ListForSeller,
};
