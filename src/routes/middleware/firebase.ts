import * as Bluebird from 'bluebird';
import express from 'express';

import Users from '../../model/users';
import SendNotif from '../../service/firebase';

export function SendMobileNotification(req: express.Request, res: express.Response, next: express.NextFunction) {
    const userID = req.kulakan.buyerID;
    const payload = req.kulakan.payload;

    return Users.GetByID(userID)
    .then(users => {
        const user = users[0];
        const notifID = user.notificationID;
        if (!user || notifID === undefined) {
            req.kulakan.notification = false;
            next();
            return;
        }

        return Bluebird.try((): Bluebird<any> => {
            return SendNotif(notifID, payload) as any;
        })
        .then(() => {
            next();
        })
        .catch(() => {
            next();
        });
    });
}
