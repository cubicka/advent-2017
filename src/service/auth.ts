import Bluebird from 'bluebird';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

import * as config from '../config.json';
import Buyers, { Buyer } from '../model/buyers';
import Sellers, { Seller } from '../model/sellers';
import Users, { User, UserType } from '../model/users';
import { Omit } from '../util/type';
// import Courier from './model/courier'

interface Login {
    password: string;
    username: string;
}

function HashOfPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 64000, 512, 'sha512').toString('hex');
}

function AuthenticateLogin(login: Login): Bluebird<User> {
    const {username, password} = login;

    return Users.GetByUsername(username)
    .then(users => {
        if (users.length !== 1) throw new Error('Autentikasi gagal');

        const {salt, hash} = users[0];
        const hashedPassword = HashOfPassword(password, salt);

        if (hash !== hashedPassword) throw new Error('Autentikasi gagal');
        return users[0];
    });
}

function RandomBytes(length = 512): string {
    return crypto.randomBytes(length).toString('hex');
}

function CreateToken(userID: string, notificationID?: string): Bluebird<string> {
    const token = RandomBytes();
    return Users.SetToken(userID, token, notificationID)
    .then(usedToken => {
        const signedToken = jwt.sign({token: usedToken, userID}, config.secret, {
            expiresIn: '3d',
        });

        return signedToken;
    });
}

function CalculateSaltHash(password: string) {
    const salt = RandomBytes();
    const hash = HashOfPassword(password, salt);

    return { hash, salt };
}

function RegisterBuyer(login: Login, buyer: Omit<Buyer, 'userID'>): Bluebird<Buyer> {
    const { hash, salt } = CalculateSaltHash(login.password);
    return Buyers.CreateBuyer(buyer, {
        hash,
        salt,
        username: login.username,
        type: UserType.buyer,
    });
}

function RegisterSeller(login: Login, seller: Omit<Seller, 'userID'>): Bluebird<Seller> {
    const { hash, salt } = CalculateSaltHash(login.password);
    return Sellers.CreateSeller(seller, {
        hash,
        salt,
        username: login.username,
        type: UserType.seller,
    });
}

function ChangePassword(userID: string, password: string) {
    const { salt, hash } = CalculateSaltHash(password);
    return Users.SetSaltHash(userID, { salt, hash });
}

export default {
    AuthenticateLogin,
    ChangePassword,
    CreateToken,
    RegisterBuyer,
    RegisterSeller,
};

// function RandomString(length = 40, chars =
// '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'): string {
//     var result = '';
//     for (var i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
//     return result;
// }

// function SignOut({id}) {
//     return Users.SignOut(id)
// }

// function CourierMiddleware(req, res, next) {
//     function Fail() {
//         res.send401('Authentication failed.')
//     }

//     const token = req.headers && req.headers['x-api-key']
//     if (!token) return Fail()

//     // jwt.verify(signedToken, config.secret, (err, {token} = {}) => {
//     //     if (err || !token) return Fail()

//     return Courier.Identity()
//     .then((user) => {
//         if (!user.type || user.type !== 'courier') {
//             return Fail()
//         }

//         if (user.hash !== HashOfPassword(token, user.salt)) {
//             return Fail()
//         }

//         req.kulakan.user = user
//         return next()
//     })
//     // })
// }

// function AdminMiddleware(req, res, next) {
//     function Fail() {
//         res.send403('Authentication failed.')
//     }

//     const signedToken = req.headers && req.headers['x-access-token']
//     if (!signedToken) return Fail()

//     jwt.verify(signedToken, config.secret, (err, {token} = {}) => {
//         if (err || !token) return Fail()

//         return Users.ByToken(token)
//         .then((user) => {
//             if (!user.username || user.type !== 'admin') {
//                 return Fail()
//             }

//             req.kulakan.user = user
//             return next()
//         })
//     })
// }

// function CreateUser({username, password, type}) {
//     const user = {username, password, type, verified: false}
//     const expandedUser = AddSecurity(user)
//     delete expandedUser.password
//     return Users.Create(expandedUser)
// }

//     AddSecurity,
//     AdminMiddleware,
//     AuthorizeMiddleware,
//     CourierMiddleware,
//     CreateToken,
//     CreateUser,
//     HashOfPassword,
//     RandomBytes,
//     SignOut,
