import Bluebird from 'bluebird'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import Buyers, { Buyer } from '../model/buyer'
import Sellers, { Seller } from '../model/seller'
import Users, { User, UserType } from '../model/user'
import { Omit } from '../util/type'
// import Courier from './model/courier'

interface Login {
    password: string;
    username: string;
}

const config = require('../config.json')

function HashOfPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 64000, 512, 'sha512').toString('hex')
}

function AuthenticateLogin(login: Login): Bluebird<User> {
    const {username, password} = login

    return Users.GetByUsername(username)
    .then(users => {
        if (users.length !== 1) throw new Error('Autentikasi gagal')

        const {salt, hash} = users[0]
        const hashedPassword = HashOfPassword(password, salt)

        if (hash !== hashedPassword) throw new Error('Autentikasi gagal')
        return users[0]
    })
}

function RandomBytes(length = 512): string {
    return crypto.randomBytes(length).toString('hex')
}

function CreateToken(userID: string, notificationID?: string): Bluebird<string> {
    const token = RandomBytes()
    return Users.SetToken(userID, token, notificationID)
    .then((usedToken) => {
        const signedToken = jwt.sign({token: usedToken}, config.secret, {
            expiresIn: '3d',
        })

        return signedToken
    })
}

function CalculateSaltHash(password: string) {
    const salt = RandomBytes()
    const hash = HashOfPassword(password, salt)

    return { hash, salt }
}

function RegisterBuyer(login: Login, buyer: Omit<Buyer, 'userID'>): Bluebird<Buyer> {
    const { hash, salt } = CalculateSaltHash(login.password)
    return Buyers.CreateBuyer(buyer, {
        hash,
        salt,
        username: login.username,
        type: UserType.buyer,
    })
}

function RegisterSeller(login: Login, seller: Omit<Seller, 'userID'>): Bluebird<Seller> {
    const { hash, salt } = CalculateSaltHash(login.password)
    return Sellers.CreateSeller(seller, {
        hash,
        salt,
        username: login.username,
        type: UserType.seller,
    })
}

function ChangePassword(userID: string, password: string) {
    const { salt, hash } = CalculateSaltHash(password)
    return Users.SetSaltHash(userID, { salt, hash })
}

export default {
    AuthenticateLogin,
    ChangePassword,
    CreateToken,
    RegisterBuyer,
    RegisterSeller,
}

// function RandomString(length = 40, chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'): string {
//     var result = '';
//     for (var i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
//     return result;
// }

// const huh = jwt.sign({token: "5eec1cd8587d3402bb6cb1d0c7e218a8cde96c62bf38ff11f2994b4e0d2f15cf863130738b27a3986002678fe152fae9db8a3d62e601386e0ec95f5d5c1961d577ec3f28ae507db4d25196c25bb966f5393ad05abf231436b9ebd62ca242c22ae6d2559d83863bd69604b23fdcc6ae6eb28c1159c0dff31f8c08af01cc788274e9f6007de37223c960439602a8d6269a5ac400f7b7a796fba617ba302ac4442edd4fdb860df6da6cb17e638845ea6bd7a6e048a85d6a3e4ed15719112f713cdce7a4ab0ace84eb13db0ebe49477d9fc4846fc2e2229a2478dfd005236537615730b1d43758434c5702a6b2a32c13002f3ab60311b7c0e21cd98a732889563fcbe176e603e7c3ee843e34997a767d56eae524967a15998231cc06823f725e7f753411db4c87221a7d89e6bcf2f77e708f403dd47576b7732fe7a887b6f4e487303c5271757432726b6da84c29953094451de66cc1acf56605229dbedf1accbcf8dac108673e04a2d348063a7af4ef5ba3d78cdccfef02622f43c385fd08f93ff6b6dd3217fd87f0971e6a34e36264c861bed8ef3aeb9b003b41df2ee35754d5cd7f9b522117be6de4a184ebdaae74ddf89a60149170bf85d0399b73ea4cdc185b451d7004165ba75f5add2ec127cae29e8c3bd0dc4da8b3527ca1462b9bb643c27772996cd546263b5c91ce686b46400120313415cd81c51eb1072c5ddbf6c02b"}, config.secret, {
//     expiresIn: '3d',
// })

// function SignOut({id}) {
//     return Users.SignOut(id)
// }

// function AuthorizeMiddleware(req, res, next) {
//     function Fail() {
//         res.send403('Authentication failed.')
//     }

//     const signedToken = req.headers && req.headers['x-access-token']
//     if (!signedToken) return Fail()

//     jwt.verify(signedToken, config.secret, (err, {token} = {}) => {
//         if (err || !token) return Fail()

//         return Users.ByToken(token)
//         .then((user) => {
//             if (!user.username) {
//                 return Fail()
//             }

//             req.kulakan.user = user
//             return next()
//         })
//     })
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
