import express from 'express';
// import Users from '../../model/users'
// import {SendNotif} from '../../service/firebase'

export function SendMobileNotification(req: express.Request, res: express.Response, next: express.NextFunction) {
    next();
    // const userID = req.kulakan.buyerID
    // const payload = req.kulakan.payload

    // return Users.GetNotifID(userID)
    // .then((users) => {
    //     const user = users[0]
    //     if (!user || ! user.notificationID) {
    //         req.kulakan.notification = false
    //         next()
    //         return
    //     }

    //     return SendNotif(user.notificationID, payload)
    //     .then((result) => {
    //         next()
    //     })
    //     .catch((err) => {
    //         next()
    //     })
    // })
}
