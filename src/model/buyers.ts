import * as Bluebird from 'bluebird';
import knex from 'knex';

import { Normalize } from '../util/phone';
import { Omit } from '../util/type';

import { Relations } from './buyerRelations';
import pg, { Fetch, FetchAndCount, FetchFactory, JoinFactory, ORM, Table } from './index';
import { CreateUser, User } from './users';

export interface BuyerInsertParams {
    address: string;
    cityID: string;
    ktp?: string;
    latitude?: number;
    longitude?: number;
    name: string;
    phone: string;
    profilePicture?: string;
    selfie?: string;
    shop: string;
    signature?: string;
    stateID: string;
    verification?: string;
    zipcode?: string;
}

export interface Buyer extends BuyerInsertParams {
    id: number;
    userID: number;
}

export const FetchBuyer = FetchFactory<Buyer>(pg(Table.buyers));
export const JoinBuyerRelations = JoinFactory(
    pg(Table.buyers), pg(Table.buyersRelations), 'buyer_details.userID', 'buyer_relations.buyerID', 'buyer_relations');

function CreateBuyer(buyer: BuyerInsertParams, userData: Omit<User, 'id'>): Bluebird<Buyer> {
    return CreateUser(userData)
    .then(createdUser => {
        return FetchBuyer([
            ORM.Insert({
                ...buyer,
                ktp: buyer.ktp || null,
                latitude: buyer.latitude || null,
                longitude: buyer.longitude || null,
                profilePicture: buyer.profilePicture || null,
                selfie: buyer.selfie || null,
                signature: buyer.signature || null,
                verification: buyer.verification || null,
                zipcode: buyer.zipcode || null,
                userID: createdUser.id,
            }),
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
            // default: return ['buyer_relations.created_at', 'desc'];
            default: return ['name', 'desc'];
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

    const query = JoinBuyerRelations([
        ORM.Where(function(this: knex.QueryBuilder) {
            const nameTokens = name.split(' ').map(s => (s.replace(/[^0-9a-z]/gi, ''))).filter(s => (s.length > 0));

            nameTokens.forEach(token => {
                this.andWhere(function(this: knex.QueryBuilder) {
                    this.orWhere('name', 'ilike', `%${token}%`).orWhere('shop', 'ilike', `%${token}%`);
                });
            });
        }),
    ], [
        ORM.Where({ sellerID }),
    ]);

    return FetchAndCount<Buyer & Relations>(query, {
        limit, offset, sortBy: sortByParam[0], sortOrder: sortOrderParam,
    })
    .then(({ result, count }) => {
        return {
            count,
            retailers: result,
        };
    });
}

function ListByPhone(phone: string) {
    return Fetch<Buyer & Relations>(
        JoinBuyerRelations([ORM.Where({phone: Normalize(phone)})], []),
    )
    .then(buyers => {
        return buyers.map(buyer => {
            return Object.assign(buyer, {
                tier: buyer.type || 'normal',
                active: buyer.active || false,
            });
        });
    });
}

export default {
    CreateBuyer,
    ListByPhone,
    ListForSeller,
};
