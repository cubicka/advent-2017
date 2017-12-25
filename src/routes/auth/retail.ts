import express from 'express';

import PasswordTokens from '../../model/passwordTokens';
import Users, { UserType } from '../../model/users';
import Auth from '../../service/auth';
import SMS from '../../service/sms';
import { ProjectObj } from '../../util/obj';
import * as Phone from '../../util/phone';
import {IsParseNumber, IsPhone, IsString, Middleware} from '../../util/validation';

const signInSpecs = {
    body: {
        username: IsString,
        password: IsString,
        udid: IsString,
    },
};

function SignIn(req: express.Request, res: express.Response, next: express.NextFunction) {
    const username = Phone.Normalize(req.body.username);
    return Auth.AuthenticateLogin({username, password: req.body.password})
    .then(user => {
        if (user.type !== UserType.buyer) {
            return res.send400('Autentikasi gagal');
        }

        req.kulakan.userID = user.id;
        next();
    });
}

function CreateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
    const userID = req.kulakan.userID;
    return Auth.CreateToken(userID, req.body.udid)
    .then(token => {
        res.send({token});
    });
}

const registrationSpecs = {
    body: {
        password: IsString,
        name: IsString,
        shop: IsString,
        address: IsString,
        zipcode: IsString,
        phone: IsString,
        stateID: IsParseNumber,
        cityID: IsParseNumber,
    },
};

function Register(req: express.Request, res: express.Response, next: express.NextFunction) {
    const {password} = req.body;
    const buyer = ProjectObj(req.body, ['name', 'shop', 'address', 'phone', 'stateID', 'cityID', 'zipcode']);
    buyer.phone = Phone.Normalize(buyer.phone);

    return Auth.RegisterBuyer({ password, username: buyer.phone }, buyer)
    .then(registeredBuyer => {
        req.kulakan.userID = registeredBuyer.userID;
        next();
    });
}

const forgotPassSpecs = {
    body: {
        phone: IsPhone,
    },
};

function UserByPhone(req: express.Request, res: express.Response, next: express.NextFunction) {
    const phone = Phone.Normalize(req.body.phone);
    return Users.GetByUsername(phone)
    .then(users => {
        if (users.length === 0 || users[0].type !== UserType.buyer) {
            res.send400('User tidak ditemukan');
            return;
        }

        req.kulakan.user = users[0];
        next();
    });
}

function ForgotPassword(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = req.kulakan.user;
    return PasswordTokens.CreatePassToken(user.userID)
    .then(token => {
        req.kulakan.token = token;
        next();
    });
}

function SendSMS(req: express.Request, res: express.Response, next: express.NextFunction) {
    const { token, user } = req.kulakan;
    return SMS(user.username, 'kode verifikasi penggantian password: ' + token.toString())
    .then(response => {
        res.send({
            status: 'verification code is sent',
            temp: response,
        });
    });
}

const setPassSpecs = {
    body: {
        token: IsString,
        password: IsString,
    },
};

function ValidateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
    const { token } = req.body;
    return PasswordTokens.GetByToken(token)
    .then(tokens => {
        req.kulakan.token = tokens[0];
        next();
    });
}

function ChangePassByToken(req: express.Request, res: express.Response, next: express.NextFunction) {
    const { password } = req.body;
    const token = req.kulakan.token;

    return Auth.ChangePassword(token.userID, password)
    .then(() => {
        res.send({status: 'Password telah diganti'});
    });
}

export default {
    post: [
        ['/sign-in', Middleware(signInSpecs), SignIn, CreateToken],
        ['/register', Middleware(registrationSpecs), Register, CreateToken],
        ['/forgot-password', Middleware(forgotPassSpecs), UserByPhone, ForgotPassword, SendSMS],
        ['/set-password', Middleware(setPassSpecs), ValidateToken, ChangePassByToken],
    ],
};
