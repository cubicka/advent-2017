import Bluebird from 'bluebird'
import express from 'express'

import PasswordTokens from '../../model/passwordToken'
import Sellers from '../../model/seller'
import { UserType } from '../../model/user'
import Auth from '../../service/auth'
import SMS from '../../service/sms'
import { ProjectObj } from '../../util/obj'
import * as Phone from '../../util/phone'
import { ComposeOr, IsParseDate, IsParseNumber, IsString, Middleware} from '../../util/validation'

const signInSpecs = {
    body: {
        username: IsString,
        password: IsString,
    }
}

function SignIn(req: express.Request, res: express.Response, next: express.NextFunction) {
    return Auth.AuthenticateLogin(req.body)
    .then(user => {
        if (user.type !== UserType.seller) throw new Error('Autentikasi gagal.')

        req.kulakan.user = user
        next()
    })
    .catch(err => res.send400(err.message))
}

function CreateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = req.kulakan.user
    return Auth.CreateToken(user)
    .then((token) => {
        res.send({token})
    })
    .catch(err => res.send400(err.message))
}

const registrationSpecs = {
    body: {
        username: IsString,
        password: IsString,
        name: IsString,
        ktp: IsString,
        shop: IsString,
        phone: IsString,
        address: IsString,
        stateID: IsParseNumber,
        cityID: IsParseNumber,
        birth: IsParseDate,
        bankAccountNumber: IsString,
        bankAccountName: IsString,
        bankID: IsString,
        bankBranch: IsString,
    }
}

function Register(req: express.Request, res: express.Response, next: express.NextFunction) {
    const seller = ProjectObj(req.body, ['name', 'ktp', 'shop', 'address', 'phone', 'stateID', 'cityID', 'birth', 'bankAccountNumber', 'bankAccountName', 'bankID', 'bankBranch'])

    seller.phone = Phone.Normalize(seller.phone)

    return Auth.RegisterSeller(req.body, seller)
    .then(() => res.send({ status: 'User sukses didaftar' }))
    .catch(err => res.send400(err.message))
}

const forgotPassSpecs = {
    body: ComposeOr(
        {
            username: IsString,
        },
        {
            phone: IsString,
        },
    )
}

function SellerByNameOrPhone(req: express.Request, res: express.Response, next: express.NextFunction) {
    return Bluebird.try(() => {
        if (req.body.username !== undefined) {
            return Sellers.GetByUsername(req.body.username)
        }

        return Sellers.GetByPhone(Phone.Normalize(req.body.phone))
    })
    .then(users => {
        req.kulakan.user = users[0]
        next()
    })
    .catch(err => res.send400(err.message))
}

function ForgotPassword(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = req.kulakan.user
    return PasswordTokens.CreatePassToken(user.userID)
    .then(token => {
        req.kulakan.token = token
        next()
    })
    .catch(err => res.send400(err.message))
}

function SendSMS(req: express.Request, res: express.Response, next: express.NextFunction) {
    const { token, user } = req.kulakan
    return SMS(Phone.Normalize(user.phone), 'kode verifikasi penggantian password: ' + token.toString())
    .then((response) => {
        res.send({
            status: 'verification code is sent',
            temp: response
        })
    })
    .catch(err => res.send400(err.message))
}

const setPassSpecs = {
    body: {
        token: IsString,
        password: IsString,
    }
}

function ValidateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
    const { token } = req.body
    return PasswordTokens.GetByToken(token)
    .then(tokens => {
        req.kulakan.token = tokens[0]
        next()
    })
    .catch(err => res.send400(err.message))
}

function ChangePassByToken(req: express.Request, res: express.Response, next: express.NextFunction) {
    const { password } = req.body
    const token = req.kulakan.token

    return Auth.ChangePassword(token.userID, password)
    .then(() => {
        res.send({status: "Password telah diganti"})
    })
    .catch(err => res.send400(err.message))
}

export default {
    post: [
        ['/sign-in', Middleware(signInSpecs), SignIn, CreateToken],
        ['/register', Middleware(registrationSpecs), Register],
        ['/forgot-password', Middleware(forgotPassSpecs), SellerByNameOrPhone, ForgotPassword, SendSMS],
        ['/set-password', Middleware(setPassSpecs), ValidateToken, ChangePassByToken],
    ]
}
