import express from 'express';
import * as jwt from 'jsonwebtoken';

import * as config from '../../config.json';
import Users from '../../model/users';

export function Middleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    function Fail() {
        res.send401('Authentication failed.');
    }

    const signedToken = (req.headers && req.headers['x-access-token']) || '';
    if (signedToken === undefined || typeof signedToken !== 'string') return Fail();

    jwt.verify(signedToken, config.secret, (err: any, result: any) => {
        if (err || result === undefined || result.userID === undefined || result.token === undefined) return Fail();

        return Users.GetByToken(result.token)
        .then(users => {
            if (users.length !== 1 || users[0].id !== result.userID) {
                return Fail();
            }

            req.kulakan.user = users[0];
            return next();
        });
    });
}
