import * as Bluebird from 'bluebird';
import express from 'express';

export function ParseLimitOffset(req: express.Request, res: express.Response, next: express.NextFunction) {
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = parseInt(req.query.offset, 10) || 0;

    req.kulakan.params = req.kulakan.params || {};
    Object.assign(req.kulakan.params, { limit, offset });
    next();
}

export function ErrorLogger(fn: express.Router) {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
        Bluebird.try(() => {
            return fn(req, res, next);
        })
        .catch(next);
    };
}
