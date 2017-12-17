import Bluebird from 'bluebird'

import { Omit } from '../util/type'

import { ORM, Table } from './index'
import { CreateUser, User } from './users'

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

const FetchBuyer = ORM.Fetch<Buyer>(Table.buyers)
// const FetchUsersBuyers = ORM.FetchJoin<User, Buyer>(Table.users, Table.buyer, 'buyer_details.userID', 'users.id')

function CreateBuyer(seller: Omit<Buyer, 'userID'>, userData: Omit<User, 'id'>): Bluebird<Buyer> {
    return CreateUser(userData)
    .then(createdUser => {
        return FetchBuyer([
            ORM.Insert({ ...seller, userID: createdUser.id })
        ])
        .then(users => users[0])
    })
}

export default {
    CreateBuyer,
}
