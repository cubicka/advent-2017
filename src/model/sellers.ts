import * as Bluebird from 'bluebird';
import * as lodash from 'lodash';

import { Omit } from '../util/type';

import { FetchRelations } from './buyerRelations';
import pg, { Fetch, FetchFactory, FetchLeftJoin, JoinFactory, ORM, Table } from './index';
import { AddCity } from './states';
import { CreateUser, User, UserType } from './users';

export interface Seller {
    address: string;
    bankAccountName: string;
    bankAccountNumber: string;
    bankBranch: string;
    bankID: string;
    birth: string;
    cityID: string;
    hasbeenverified?: string;
    image?: string;
    ktp: string;
    latitude?: string;
    longitude?: string;
    name: string;
    phone: string;
    shop: string;
    stateID: string;
    userID: string;
}

const FetchSellers = FetchFactory<Seller>(pg(Table.sellers));
const FetchUsersSellers = FetchLeftJoin<Seller>(
    pg(Table.users), pg(Table.sellers), 'seller_details.userID', 'users.id', 'seller_details');
const JoinUsersSellers = JoinFactory(
    pg(Table.users), pg(Table.sellers), 'seller_details.userID', 'users.id', 'seller_details');

function CreateSeller(seller: Omit<Seller, 'userID'>, userData: Omit<User, 'id'>): Bluebird<Seller> {
    return CreateUser(userData)
    .then(createdUser => {
        return FetchSellers([
            ORM.Insert({
                ...seller,
                hasbeenverified: seller.hasbeenverified || null,
                image: seller.image || null,
                latitude: seller.latitude || null,
                longitude: seller.longitude || null,
                userID: createdUser.id,
            }),
        ])
        .then(users => users[0]);
    });
}

function GetByPhone(phone: string): Bluebird<Array<User & Seller>> {
    return Fetch<User & Seller>(
        JoinUsersSellers([
            ORM.Where({ type: UserType.seller }),
        ], [
            ORM.Where({ phone }),
        ]),
    )
    .then(users => {
        if (users.length === 0) {
            throw new Error('Seller tidak ditemukan');
        }

        return users;
    });
}

function GetByUsername(username: string): Bluebird<Array<User & Seller>> {
    return Fetch<User & Seller>(
        JoinUsersSellers([
            ORM.Where({ username, type: UserType.seller }),
        ]),
    )
    .then(users => {
        if (users.length === 0) {
            throw new Error('Seller tidak ditemukan');
        }

        return users;
    });
}

function MarkNeedSync(userID: string) {
    return FetchSellers([
        ORM.Where({ userID }),
        ORM.Update({ needSync: true }),
    ]);
}

function Details(userID: number) {
    return FetchUsersSellers([
        ORM.Where({ userID }),
        ORM.Select(
            'address',
            'bankAccountName',
            'bankAccountNumber',
            'bankBranch',
            'bankID',
            'birth',
            'cityID',
            'image',
            'ktp',
            'latitude',
            'longitude',
            'name',
            'phone',
            'shop',
            'stateID',
            'userID',
            'username',
        ),
    ])
    .then(sellers => sellers.map(AddCity));
}

function Update(userID: number, seller: any) {
    return FetchSellers([
        ORM.Where({ userID }),
        ORM.Update({
            ...seller,
        }),
    ]);
}

function UpdateImage(userID: number, name: string, image: string) {
    return FetchSellers([
        ORM.Where({ userID }),
        ORM.Update({ [name]: image }),
    ]);
}

function ListForBuyer(buyerID: string, limit?: number, offset?: number) {
    return FetchRelations([
        ORM.Where({ active: true, buyerID }),
    ], {
        limit, offset,
        sortBy: 'id', sortOrder: 'asc',
    })
    .then(relations => {
        const sellerIDs = relations.map(r => r.sellerID);
        return FetchSellers([
            ORM.WhereIn('userID', sellerIDs),
        ], {
            columns: ['userID', 'name', 'address', 'cityID', 'stateID', 'image', 'phone', 'latitude',
            'longitude', 'shop'],
        })
        .then(sellers => {
            return sellers.map(seller => {
                const relation = relations.find(r => r.sellerID.toString() === seller.userID);
                return lodash.assign(seller, { tier: relation === undefined ? 'normal' : relation.type });
            });
        });
    });
}

function DetailsForBuyer(buyerID: string, sellerID: string) {
    return FetchUsersSellers([
        ORM.Where({ 'users.id': sellerID }),
    ], [
        ORM.Where({ userID: sellerID }),
    ], {
        columns: ['userID', 'name', 'address', 'cityID', 'stateID', 'image', 'phone', 'latitude', 'longitude', 'shop'],
    })
    .then(sellers => {
        return Bluebird.reduce(sellers, (accum, seller) => {
            return pg('buyer_relations').where({ sellerID, buyerID })
            .then((relations: any) => {
                if (relations.length === 0) return 'normal';
                return relations[0].type as string;
            })
            .then(tier => {
                accum.push(lodash.assign(seller, { tier }));
                return accum;
            });
        }, [] as Seller[]);
    });
}

function Favorites(buyerID: string, sellerID: string) {
    return pg('favorites').where({sellerID, buyerID, isFavorites: true})
    .then(favorites => {
        const itemIDs = favorites.map((fav: any) => (fav.itemID));
        return pg('item_prices').where({sellerID, active: true}).whereIn('itemID', itemIDs)
        .then((prices: any) => {
            const priceIDs = prices.map((price: any) => (price.itemID));
            return favorites.filter((fav: any) => {
                return priceIDs.indexOf(fav.itemID) !== -1;
            });
        });
    });
}

function SetFavorites(buyerID: string, sellerID: string, items: Array<{ itemID: string, isFavorites: boolean}>) {
    return Bluebird.reduce(items, (accum, {itemID, isFavorites}) => {
        return pg('favorites').where({buyerID, sellerID, itemID })
        .then((favs: any) => {
            if (favs.length === 0) {
                return pg('favorites').insert({buyerID, sellerID, itemID, isFavorites}, ['itemID', 'isFavorites']);
            }

            return pg('favorites').where({buyerID, sellerID, itemID}).update({isFavorites}, ['itemID', 'isFavorites']);
        })
        .then((results: any) => {
            return accum.concat(results);
        });
    }, []);
}

export default {
    CreateSeller,
    Details,
    DetailsForBuyer,
    Favorites,
    GetByPhone,
    GetByUsername,
    ListForBuyer,
    MarkNeedSync,
    SetFavorites,
    Update,
    UpdateImage,
};
