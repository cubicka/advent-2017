import Bluebird from 'bluebird';

import { Omit } from '../util/type';

import { ORM, Table } from './index';

export enum UserType {
    admin = 'admin',
    courier = 'courier',
    buyer = 'buyer',
    seller = 'seller',
}

export interface User {
    hash: string;
    id: string;
    notificationID?: string;
    salt: string;
    token?: string;
    type: UserType;
    username: string;
    updated_at?: string;
    verified?: boolean;
}

export const FetchUsers = ORM.Fetch<User>(Table.users);

export function CreateUser(user: Omit<User, 'id'>): Bluebird<User> {
    return FetchUsers([ ORM.FilterBy({ username: user.username }) ])
    .then(users => {
        if (users.length > 0 && users.some(u => u.verified === true)) throw new Error('User telah terdaftar');

        return FetchUsers([
            ORM.Insert({ ...user }, ['id']),
        ])
        .then(createdUsers => createdUsers[0]);
    });
}

function GetByToken(token: string): Bluebird<User[]> {
    return FetchUsers([ ORM.FilterBy({ token }) ]);
}

function GetByUsername(username: string): Bluebird<User[]> {
    return FetchUsers([ ORM.FilterBy({username}) ]);
}

function SetSaltHash(id: string, { salt, hash }: { salt: string, hash: string }) {
    return FetchUsers([ ORM.FilterBy({ id }) ])
    .then(users => {
        if (users.length !== 1) throw new Error('User tidak ditemukan');
        return FetchUsers([
            ORM.FilterBy({id}),
            ORM.Update({ salt, hash }),
        ]);
    });
}

function SetToken(id: string, token: string, notificationID?: string): Bluebird<string> {
    const builders = [ ORM.FilterBy({id}), ORM.Select('token', 'updated_at') ];

    return FetchUsers(builders)
    .then((users: User[]) => {
        if (users.length === 0) throw new Error('User tidak ditemukan.');

        const now = new Date();
        const lastUpdate = new Date(users[0].updated_at || '');

        let targetToken = users[0].token || token;
        if (now.getTime() - lastUpdate.getTime() > 7 * 24 * 3600 * 1000) {
            targetToken = token;
        }

        const updateBuilders = [
            ORM.FilterBy({id}),
            ORM.Update({
                notificationID: notificationID || '',
                token: targetToken,
                updated_at: now,
            }),
        ];

        return FetchUsers(updateBuilders)
        .then(() => (targetToken));
    });
}

export default {
    GetByToken,
    GetByUsername,
    SetSaltHash,
    SetToken,
};

// function FilterIDs(ids: string[]): BuilderFn {
//     return ORM.FilterIn('id', ids)
// }

// function FilterToken(token: string): BuilderFn {
//     return ORM.FilterBy({ token })
// }

// function FilterID(id: string): BuilderFn {
//     return ORM.FilterBy({ id })
// }

// function FilterUserName(username: string): BuilderFn {
//     return ORM.FilterBy({ username })
// }

// function InserUser(user: User): BuilderFn {
//     const simplifiedUser = ProjectObj(user, ['username', 'salt', 'hash', 'name', 'company', 'phone'])
//     return ORM.Insert(simplifiedUser, ['id', 'created_at'])
// }

// function SignOut(id: string): Bluebird<any> {
//     const builders = [
//         FilterID(id),
//         ORM.Update({
//             notificationID: null,
//             token: null,
//         })
//     ]

//     return ActualizeUser(builders)
// }

// function Create(user: User) {
//     return ActualizeUser([ FilterUserName(user.username), ORM.Select() ])
//     .then(users => {
//         const user = users[0]
//         if (user !== undefined && user.verified) {
//             throw new Error('User telah terdaftar')
//         }

//         if (user !== undefined) {
//             const updatedData = Object.assign({token: null}, user)
//             return ActualizeUser([ FilterID(user.id), ORM.Update(updatedData, ['id']) ])
//         }

//         return ActualizeUser([ ORM.Insert(user, ['id']) ])
//     })
// }

// function CreateBuyer(buyer: Buyer) {
//     return ActualizeBuyer([
//         ORM.FilterBy({userID: buyer.userID}),
//         ORM.Select(),
//     ])
//     .then(buyers => {
//         if (buyers.length > 0) {
//             throw new Error('Buyer telah terdaftar')
//         }

//         return ActualizeBuyer([ ORM.Insert(buyer, ['id']) ])
//     })
// }

// function CreateSeller(seller: Seller) {
//     return ActualizeSeller([
//         ORM.FilterBy({userID: seller.userID}),
//         ORM.Select(),
//     ])
//     .then(sellers => {
//         if (sellers.length > 0) {
//             throw new Error('Seller telah terdaftar')
//         }

//         return ActualizeBuyer([ ORM.Insert(seller, ['id']) ])
//     })
// }

// function Buyer(userID: string) {
//     const builders = [
//         ORM.Join('users', 'users.id', 'buyer_details.userID'),
//         ORM.FilterBy({userID}),
//         ORM.Select(
//             'address',
//             'cityID',
//             'ktp',
//             'latitude',
//             'longitude',
//             'name',
//             'phone',
//             'profilePicture',
//             'selfie',
//             'shop',
//             'signature',
//             'stateID',
//             'userID',
//             'username',
//             'zipcode',
//         ),
//     ]

//     return ActualizeBuyer(builders)
//     .then(buyers => buyers.map(AddCity))
// }

// function Seller(userID: string) {
//     const builders = [
//         ORM.Join('users', 'users.id', 'seller_details.userID'),
//         ORM.FilterBy({userID}),
//         ORM.Select(
//             'address',
//             'bankAccountName',
//             'bankAccountNumber',
//             'bankBranch',
//             'bankID',
//             'birth',
//             'cityID',
//             'image',
//             'ktp',
//             'latitude',
//             'longitude',
//             'name',
//             'phone',
//             'shop',
//             'stateID',
//             'userID',
//             'username',
//         ),
//     ]

//     return ActualizeSeller(builders)
//     .then(sellers => sellers.map(AddCity))
// }

// function CreateBuyerVerification(userID: string) {
//     const token = [1,2,3,4].map((x) => (getRandomIntInclusive(0, 9)))
//     const verification = token.join('')

//     return ActualizeBuyer([
//         ORM.FilterBy({userID}),
//         ORM.Update({verification}),
//     ])
//     .then(() => (verification))
// }

// function VerifyBuyer(userID: string, token: string): Bluebird<boolean> {
//     return ActualizeBuyer([
//         ORM.FilterBy({userID}),
//     ])
//     .then(buyers => {
//         const buyer = buyers[0]
//         if (buyer === undefined || buyer.verification !== token) return false

//         return ActualizeUser([
//             ORM.FilterBy({id: userID}),
//             ORM.Update({verified: true}),
//         ])
//         .then(() => (true))
//     })
// }

// function UpdateImage(userID, name, image) {
//     return pg('buyer_details')
//     .where({userID})
//     .update({[name]: image})
// }

// function UpdateImageSeller(userID, name, image) {
//     return pg('seller_details')
//     .where({userID})
//     .update({[name]: image})
// }

// function ChangeLatLong(userID, {latitude, longitude}) {
//     return pg('buyer_details')
//     .where({userID})
//     .update({latitude, longitude}, ['id', 'latitude', 'longitude'])
// }

// function UpdateUser(id, user) {
//     return pg('users')
//     .where({id})
//     .update(user)
// }

// function UpdateDetail(id, updated) {
//     return pg('buyer_details')
//     .where({userID: id})
//     .update(updated)
// }

// function UpdateSeller(id, updated) {
//     return pg('seller_details')
//     .where({userID: id})
//     .update(updated)
// }

// function GetUserByPhone(phone) {
//     return pg('users')
//     .where({username: phone})
//     .then((users) => {
//         return users[0] || {}
//     })
// }

// function GetSellerByPhone(phone) {
//     return pg('seller_details')
//     .where({phone: phone})
//     .then((seller) => {
//         if (seller.length === 0) return {}
//         return ByIDs([seller.userID])
//         .then((users) => {
//             return users[0] || {}
//         })
//     })
// }

// // function ChangePassByToken(id, token, password) {
// //     const {salt, hash} = Auth.AddSecurity({password})
// //     return pg('password_token')
// //     .where({userID: id, token})
// //     .update({used: true})
// //     .then(() => {
// //         return pg('users')
// //         .where({id: id})
// //         .update({salt, hash})
// //     })
// // }

// function ChangePassByToken(id: string, token: string, salt: string, hash: string) {
//     return pg('password_token')
//     .where({userID: id, token})
//     .update({used: true})
//     .then(() => {
//         return pg('users')
//         .where({id: id})
//         .update({salt, hash})
//     })
// }

// function Buyers({name, limit, offset}) {
//     const buyers = pg('users')
//     .where({type: 'buyer'})
//     .limit(limit)
//     .offset(offset)
//     .innerJoin('buyer_details', 'users.id', 'buyer_details.userID')
//     .where('shop', 'ilike', `%${name ? name : ""}%`)
//     .select('userID', 'buyer_details.id as id', 'name', 'address', 'phone', 'cityID', 'stateID', 'shop')
//     .orderBy('shop')

//     const count = pg('users')
//     .where({type: 'buyer'})
//     .innerJoin('buyer_details', 'users.id', 'buyer_details.userID')
//     .where('shop', 'ilike', `%${name ? name : ""}%`)
//     .count('users.id')

//     return Promise.all([buyers, count])
//     .then((results) => {
//         return {
//             buyers: results[0].map(AddCity),
//             count: results[1][0].count,
//         }
//     })
// }

// export function AddCity(user) {
//     return lodash.assign(user, {
//         bank: user.bankID && States.banks[user.bankID],
//         city: user.cityID && user.stateID && States.cities[user.stateID-1][user.cityID],
//         state: user.stateID && States.states[user.stateID],
//     })
// }

// function WS({name, limit, offset}) {
//     const ws = pg('users')
//     .where({type: 'seller'})
//     .limit(limit)
//     .offset(offset)
//     .innerJoin('seller_details', 'users.id', 'seller_details.userID')
//     .where('shop', 'ilike', `%${name ? name : ""}%`)
//     .where('verified', true)
//     .select('userID', 'seller_details.id as id', 'name', 'ktp', 'birth', 'address', 'phone', 'cityID',
//  'stateID', 'shop', 'bankAccountNumber', 'bankID', 'bankBranch', 'type', 'name', 'verified', 'username')
//     .orderBy('shop')

//     const count = pg('users')
//     .where({type: 'seller'})
//     .innerJoin('seller_details', 'users.id', 'seller_details.userID')
//     .where('shop', 'ilike', `%${name ? name : ""}%`)
//     .where('verified', true)
//     .count('users.id')

//     return Promise.all([ws, count])
//     .then((results) => {
//         return {
//             sellers: results[0].map(AddCity),
//             count: results[1][0].count,
//         }
//     })
// }

// function WSNeedVerification() {
//     const ws = pg('users')
//     .where({type: 'seller'})
//     .innerJoin('seller_details', 'users.id', 'seller_details.userID')
//     .where('hasbeenverified', false)
//     .select('userID', 'seller_details.id as id', 'name', 'ktp', 'birth', 'address', 'phone', 'cityID',
// 'stateID', 'shop', 'bankAccountNumber', 'bankID', 'bankBranch', 'type', 'name', 'hasbeenverified')

//     const count = pg('users')
//     .where({type: 'seller'})
//     .innerJoin('seller_details', 'users.id', 'seller_details.userID')
//     .where('hasbeenverified', false)
//     .count('userID')

//     return Promise.all([ws, count])
//     .then((results) => {

//         return {
//             sellers: results[0].map(AddCity),
//             count: results[1][0].count,
//         }
//     })
// }

// function WSNeedVerificationCount() {
//     return pg('users')
//     .where({type: 'seller'})
//     .innerJoin('seller_details', 'users.id', 'seller_details.userID')
//     .where('hasbeenverified', false)
//     .count('userID')
//     .then((count) => {
//         return {
//             count: count[0].count,
//         }
//     })
// }

// function VerifyWS(userID, verified) {
//     const updateUser = pg('users')
//     .where({id: userID})
//     .update({verified})

//     const updateDetail = pg('seller_details')
//     .where({userID})
//     .update({hasbeenverified: true})

//     return Promise.all([updateUser, updateDetail])
// }

// function UpdateDelivery(userID, options, active) {
//     return pg('delivery_options').where({userID, options})
//     .then((currentOptions) => {
//         if (currentOptions.length === 0) {
//             return pg('delivery_options').insert({userID, options, active}, ['userID'])
//         }

//         return pg('delivery_options').where({userID, options}).update({userID, options, active})
//     })
// }

// function GetDeliveryOptions(userID) {
//     return pg('delivery_options').where({userID, active: true})
// }

// export const Admin = {
//     Buyers, ByIDs, WS, WSNeedVerification, WSNeedVerificationCount, VerifyWS, Seller, Buyer, UpdateImageSeller,
// }
