import * as Bluebird from 'bluebird';

import { Omit } from '../util/type';

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

function Update(sellerID: number, seller: any) {
    return FetchSellers([
        ORM.Where({ sellerID }),
        ORM.Update({
            ...seller,
        }),
    ]);
}

function UpdateImage(sellerID: number, name: string, image: string) {
    return FetchSellers([
        ORM.Where({ sellerID }),
        ORM.Update({ [name]: image }),
    ]);
}

export default {
    CreateSeller,
    Details,
    GetByPhone,
    GetByUsername,
    MarkNeedSync,
    Update,
    UpdateImage,
};
