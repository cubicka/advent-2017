import express from 'express';

import { UserType } from '../../model/users';
import Auth from '../../service/auth';
import { IsString, Middleware } from '../../util/validation';

const signInSpecs = {
    body: {
        username: IsString,
        password: IsString,
    },
};

function SignIn(req: express.Request, res: express.Response, next: express.NextFunction) {
    return Auth.AuthenticateLogin(req.body)
    .then(user => {
        if (user.type !== UserType.admin) {
            return res.send400('Authentication failed.');
        }

        req.kulakan.userID = user.id;
        next();
    });
}

function CreateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
    const userID = req.kulakan.userID;
    return Auth.CreateToken(userID)
    .then(token => {
        res.send({token});
    });
}

export default {
    post: [
        ['/sign-in', Middleware(signInSpecs), SignIn, CreateToken],
    ],
};
