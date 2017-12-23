import Bluebird from 'bluebird';

import { Omit } from '../util/type';

import { ORM, Table } from './index';
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

const FetchSellers = ORM.Fetch<Seller>(Table.sellers);
const FetchUsersSellers = ORM.FetchJoin<User, Seller>(Table.users, Table.sellers, 'seller_details.userID', 'users.id');

function CreateSeller(seller: Omit<Seller, 'userID'>, userData: Omit<User, 'id'>): Bluebird<Seller> {
    return CreateUser(userData)
    .then(createdUser => {
        return FetchSellers([
            ORM.Insert({ ...seller, userID: createdUser.id }),
        ])
        .then(users => users[0]);
    });
}

function GetByPhone(phone: string): Bluebird<Array<User & Seller>> {
    return FetchUsersSellers([
        ORM.FilterBy({ phone, type: UserType.seller }),
    ])
    .then(users => {
        if (users.length === 0) {
            throw new Error('Seller tidak ditemukan');
        }

        return users;
    });
}

function GetByUsername(username: string): Bluebird<Array<User & Seller>> {
    return FetchUsersSellers([
        ORM.FilterBy({ username, type: UserType.seller }),
    ])
    .then(users => {
        if (users.length === 0) {
            throw new Error('Seller tidak ditemukan');
        }

        return users;
    });
}

export default {
    CreateSeller,
    GetByPhone,
    GetByUsername,
};
