import express from 'express';

export function Middleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    req.didi.usercode = (req.headers && req.headers['x-access-token']) || '';

    if (!req.didi.usercode) {
        res.send401('Authentication failed.');
    } else {
        next();
    }
}
