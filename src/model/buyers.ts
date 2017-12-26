import * as Bluebird from 'bluebird';
import knex from 'knex';
import * as lodash from 'lodash';

import { Normalize } from '../util/phone';
import { Omit } from '../util/type';

import { Relations } from './buyerRelations';
import DeliveryOptions from './deliveryOptions';
import pg, { Fetch, FetchAndCount, FetchFactory, FetchJoin, JoinFactory, LeftJoinFactory, ORM, Table } from './index';
import { AddCity } from './states';
import { CreateUser, FetchUsers, User } from './users';

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
export const FetchBuyerUsers = FetchJoin<Buyer & User>(
    pg(Table.buyers),
    pg(Table.users),
    'buyer_details.userID',
    'users.id',
    'users',
);

export const JoinBuyerRelations = JoinFactory(
    pg(Table.buyers), pg(Table.buyersRelations), 'buyer_details.userID', 'buyer_relations.buyerID', 'buyer_relations');

export const LeftJoinBuyerRelations = LeftJoinFactory(
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
            }, ['id', 'userID']),
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
        const userIDs = result.map(user => user.userID);

        return DeliveryOptions.GetDeliveryOptionsBulk(userIDs)
        .then(options => {
            return result.map((user, idx) => {
                return lodash.assign(user, {deliveryOptions: options[idx]});
            });
        })
        .then(usersWithOptions => {
            return {
                count,
                retailers: usersWithOptions,
            };
        });
    });
}

function ListByPhone(phone: string) {
    return Fetch<Buyer & Relations>(
        LeftJoinBuyerRelations([ORM.Where({phone: Normalize(phone)})], []),
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

function ListByID(userID: string) {
    return FetchBuyerUsers([
        ORM.Where({ userID }),
    ], [], {
        columns: ['userID', 'name', 'shop', 'address', 'stateID', 'cityID', 'phone', 'ktp', 'selfie',
            'signature', 'profilePicture', 'latitude', 'longitude', 'zipcode', 'username'],
    })
    .then(results => {
        return results.map(AddCity);
    });
}

function getRandomIntInclusive(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function CreateVerification(userID: string) {
    const token = [1, 2, 3, 4].map(x => (getRandomIntInclusive(0, 9)));
    const verification = token.join('');

    return FetchBuyer([
        ORM.Where({userID}),
        ORM.Update({verification}),
    ])
    .then(() => (verification));
}

function UpdateImage(userID: number, name: string, image: string) {
    return FetchBuyer([
        ORM.Where({ userID }),
        ORM.Update({ [name]: image }),
    ]);
}

function Verify(userID: string, token: string) {
    return FetchBuyer([
        ORM.Where({userID}),
    ])
    .then(buyers => {
        const buyer = buyers[0];
        if (buyer === undefined || buyer.verification !== token) return false;

        return FetchUsers([
            ORM.Where({id: userID}),
            ORM.Update({verified: true}),
        ])
        .then(() => (true));
    });
}

function ChangeLatLong(userID: string, {latitude, longitude}: { latitude: string, longitude: string}) {
    return FetchBuyer([
        ORM.Where({ userID }),
        ORM.Update({ latitude, longitude }, ['id', 'latitude', 'longitude']),
    ]);
}

function Update(userID: number, buyer: any) {
    return FetchBuyer([
        ORM.Where({ userID }),
        ORM.Update({
            ...buyer,
        }),
    ]);
}

function ChangeDelivery(sellerID: string, buyerID: string, options: string, active: boolean) {
    return pg('delivery_options').where({userID: buyerID, options})
    .then(results => {
        if (results.length === 0) return pg('delivery_options').insert({ userID: buyerID, options, active });
        return pg('delivery_options').where({userID: buyerID, options}).update({active});
    });
}

export default {
    ChangeDelivery,
    ChangeLatLong,
    CreateBuyer,
    CreateVerification,
    ListByID,
    ListByPhone,
    ListForSeller,
    Update,
    UpdateImage,
    Verify,
};
