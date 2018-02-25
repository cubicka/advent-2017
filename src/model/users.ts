// import * as Bluebird from 'bluebird';

import pg, { FetchTable, Table, Where } from './index';

export enum UserType {
    // admin = 'admin',
    // courier = 'courier',
    buyer = 'buyer',
    // seller = 'seller',
}

export interface User {
    usercode: number;
    name: string;
    address: string;
    city: string;
    phoneno: string;
    email: string;
    fax: string;
    longitude: string;
    latitude: string;
    postalcode: string;
    storecode: number;
    createdate: string;
    netizenid: string;
    username: string;
    password: string;
    active: boolean;
}

// export interface User extends UserInsertParams {
//     id: number;
//     updated_at?: string;
// }

export const FetchUsers = FetchTable<User>(Table.user);

export function CheckCredentials(username: string, password: string) {
    return FetchUsers([
        Where({ username, password }),
    ])
    .then(users => {
        if (users.length !== 1) throw new Error('Autentikasi gagal.');
        return users[0];
    });
}

// export function CreateUser(user: UserInsertParams): Bluebird<User> {
//     return FetchUsers([
//         ORM.Where({ username: user.username }),
//     ])
//     .then(users => {
//         if (users.length > 0 && users.some(u => u.verified === true)) throw new Error('User telah terdaftar');

//         if (users.length > 0) {
//             return FetchUsers([
//                 ORM.Where({ id: users[0].id }),
//                 ORM.Update({
//                     ...user,
//                     notificationID: user.notificationID || null,
//                     token: user.token || null,
//                     verified: user.verified || null, updated_at: new Date(),
//                 }, ['id']),
//             ]);
//         }

//         return FetchUsers([
//             ORM.Insert({
//                 ...user,
//                 notificationID: user.notificationID || null,
//                 token: user.token || null,
//                 verified: user.verified || null,
//         }, ['id']),
//         ]);
//     })
//     .then(createdUsers => createdUsers[0]);
// }

// function GetByToken(token: string): Bluebird<User[]> {
//     return FetchUsers([ ORM.Where({ token }) ]);
// }

// function GetByUsername(username: string): Bluebird<User[]> {
//     return FetchUsers([ ORM.Where({username}) ]);
// }

// function SetSaltHash(id: number, { salt, hash }: { salt: string, hash: string }) {
//     return FetchUsers([ ORM.Where({ id }) ])
//     .then(users => {
//         if (users.length !== 1) throw new Error('User tidak ditemukan');
//         return FetchUsers([
//             ORM.Where({ id }),
//             ORM.Update({ salt, hash, updated_at: new Date() }),
//         ]);
//     });
// }

// function SetToken(id: number, token: string, notificationID?: string): Bluebird<string> {
//     const builders = [ ORM.Where({id}), ORM.Select('token', 'updated_at') ];

//     return FetchUsers(builders)
//     .then(users => {
//         if (users.length === 0) throw new Error('User tidak ditemukan.');

//         const now = new Date();
//         const lastUpdateInString = users[0].updated_at;

//         let lastUpdate = new Date();
//         if (lastUpdateInString !== undefined) {
//             lastUpdate = new Date(lastUpdateInString);
//         }

//         let targetToken = users[0].token || token;
//         if (now.getTime() - lastUpdate.getTime() > 7 * 24 * 3600 * 1000) {
//             targetToken = token;
//         }

//         const updateBuilders = [
//             ORM.Where({ id }),
//             ORM.Update({
//                 notificationID: notificationID || null,
//                 token: targetToken,
//                 updated_at: now,
//             }),
//         ];

//         return FetchUsers(updateBuilders)
//         .then(() => (targetToken));
//     });
// }

// function SignOut(id: string) {
//     const builders = [
//         ORM.Where({ id }),
//         ORM.Update({
//             notificationID: null,
//             token: null, updated_at: new Date(),
//         }),
//     ];

//     return FetchUsers(builders);
// }

// function GetByID(id: string) {
//     return FetchUsers([ ORM.Where({id}) ]);
// }

// export default {
//     GetByID,
//     GetByToken,
//     GetByUsername,
//     SetSaltHash,
//     SetToken,
//     SignOut,
// };
