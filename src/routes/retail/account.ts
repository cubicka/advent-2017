import express from 'express';

import Buyers from '../../model/buyers';
import Delivery from '../../model/deliveryOptions';
import Users from '../../model/users';
import Auth from '../../service/auth';
import SMS from '../../service/sms';
import { IsParseNumber, IsString, Middleware } from '../../util/validation';

import S3Middleware from '../middleware/s3';

function UserDetail(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = req.kulakan.user;
    return Buyers.ListByID(user.id)
    .then(details => {
        if (details.length === 0) {
            return res.send403();
        }

        const details2 = Object.assign({
            verified: user.verified,
        }, details[0]);

        return Delivery.GetDeliveryOptions(user.id)
        .then(options => {
            res.send({
                details: details2,
                availableDeliveryOptions: options || ['pickup'],
            });
        });
    });
}

function NotVerified(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = req.kulakan.user;

    if (user.verified) {
        res.send400();
        return;
    }

    next();
}

function SignOut(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = req.kulakan.user;
    return Users.SignOut(user)
    .then(() => {
        res.send({status: 'success', success: true, message: 'Successfully signed out.'});
    });
}

function Upload(name: string) {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const {user, uploads} = req.kulakan;
        return Buyers.UpdateImage(user.id, name, uploads.Location)
        .then(() => {
            res.send({[name]: uploads.Location});
        });
    };
}

function SendSMS(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = req.kulakan.user;
    return Buyers.ListByID(user.id)
    .then(buyers => {
        return Buyers.CreateVerification(user.id)
        .then(token => {
            return SMS(buyers[0].phone, 'verification code is ' + token.toString())
            .then(response => {
                res.send({
                    status: 'verification code is sent',
                    temp: response,
                });
            });
        });
    });
}

const verificationSpecs = {
    body: {
        verificationToken: IsString,
    },
};

function VerifyBuyer(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = req.kulakan.user;
    return Buyers.Verify(user.id, req.body.verificationToken)
    .then(isVerified => {
        if (!isVerified) {
            res.send400('Invalid verification token.');
            return;
        }

        res.send({status: 'Verification succeed.'});
    });
}

const latlongSpecs = {
    body: {
        latitude: IsParseNumber,
        longitude: IsParseNumber,
    },
};

function ChangeLatLong(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = req.kulakan.user;
    return Buyers.ChangeLatLong(user.id, req.body)
    .then(users => {
        res.send({user: users[0]});
    });
}

const changePassSpecs = {
    body: {
        newpassword: IsString,
        oldpassword: IsString,
    },
};

function ChangePass(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = req.kulakan.user;

    return Auth.AuthenticateLogin({ username: user.username, password: req.body.oldpassword })
    .then(() => {
        return Auth.ChangePassword(user.id, req.body.newpassword);
    })
    .then(() => {
        res.send({status: 'Password successfully changed'});
    });
}

function EditProfile(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = req.kulakan.user;
    let valid = false;

    const updated = ['name', 'shop', 'address', 'cityID', 'stateID', 'zipcode'].reduce((accum: any, attr) => {
        if (attr in req.body) {
            valid = true;
            accum[attr] = req.body[attr];
        }

        return accum;
    }, {});

    if (!valid) {
        res.send400('Data kosong.');
        return;
    }

    return Buyers.Update(user.id, updated)
    .then(() => {
        res.send({updated});
    });
}

export default {
    get: [
        ['/', UserDetail],
        ['/send-verification', NotVerified, SendSMS],
    ],
    post: [
        ['/change-password', Middleware(changePassSpecs), ChangePass],
        ['/change-location', Middleware(latlongSpecs), ChangeLatLong],
        ['/edit-profile', EditProfile],
        ['/sign-out', SignOut],
        ['/upload-ktp', ...S3Middleware('ktp'), Upload('ktp')],
        ['/upload-selfie', ...S3Middleware('selfie'), Upload('selfie')],
        ['/upload-signature', ...S3Middleware('signature'), Upload('signature')],
        ['/upload-profile-picture', ...S3Middleware('profilePicture'), Upload('profilePicture')],
        ['/verify', NotVerified, Middleware(verificationSpecs), VerifyBuyer],
    ],
};
