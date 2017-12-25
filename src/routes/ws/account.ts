// import lodash from 'lodash'
// import {ParseLimitOffset} from '../middleware/helper'
// import {Seller as Orders} from '../../model/orders'
// import Users from '../../model/users'
// import S3Middleware from '../../util/s3'
// import fetch from 'node-fetch'
// import Auth from '../../auth'
// import {IsParseDate, IsParseNumber, IsString, Middleware} from '../../util/validation'
// import Dashboard, {AggregateBuyersReport, BuyerReport, ExportOrders} from '../../model/dashboard'
// import {SMS} from '../../util/s3'

import express from 'express';

import Dashboard from '../../model/dashboard';
import Sellers from '../../model/sellers';
import { IsParseNumber, Middleware } from '../../util/validation';

function UserDetail(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = req.kulakan.user;
    return Sellers.Details(user.id)
    .then(users => {
        res.send({details: users[0]});
    });
}

const dashboardSpecs = {
    query: {
        startDate: IsParseNumber,
        endDate: IsParseNumber,
    },
};

function DashboardPipe(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = req.kulakan.user;
    const {startDate, endDate} = req.query;

    return Dashboard.Dashboard(
        user.id,
        new Date(parseInt(startDate, 10) * 1000),
        new Date(parseInt(endDate, 10) * 1000),
    )
    .then(result => {
        res.send(result);
    });
}

// function Upload(name) {
//     return (req, res, next) => {
//         const {user, uploads} = req.kulakan
//         return Users.UpdateImageSeller(user.id, name, uploads.Location)
//         .then(() => {
//             res.send({[name]: uploads.Location})
//         })
//     }
// }

// function SendSMS(req, res, next) {
//     const user = req.kulakan.user
//     return Users.Buyer(user.id)
//     .then((buyer) => {
//         return Users.CreateBuyerVerification(user.id)
//         .then((token) => {
//             return SMS(buyer[0].phone, 'verification code is ' + token.toString())
//             .then((response) => {
//                 res.send({
//                     status: 'verification code is sent',
//                     temp: response
//                 })
//             })
//         })
//     })
// }

// const verificationSpecs = {
//     body: {
//         verificationToken: IsString
//     }
// }

// function VerifyBuyer(req, res, next) {
//     const user = req.kulakan.user
//     return Users.VerifyBuyer(user.id, req.body.verificationToken)
//     .then((isVerified) => {
//         if (!isVerified) {
//             res.send400('Invalid verification token.')
//             return
//         }

//         res.send({status: 'Verification succeed.'})
//     })
// }

// function NotVerified(req, res, next) {
//     const user = req.kulakan.user
//     if (user.verified) {
//         res.send400()
//         return
//     }

//     next()
// }

// const latlongSpecs = {
//     body: {
//         latitude: IsParseNumber,
//         longitude: IsParseNumber
//     }
// }

// function ChangeLatLong(req, res, next) {
//     const user = req.kulakan.user
//     return Users.ChangeLatLong(user.id, req.body)
//     .then((user) => {
//         res.send({user: user[0]})
//     })
// }

// const changePassSpecs = {
//     body: {
//         newpassword: IsString,
//         oldpassword: IsString
//     }
// }

// function ChangePass(req, res, next) {
//     const user = req.kulakan.user
//     const hashedOldPass = Auth.HashOfPassword(req.body.oldpassword, user.salt)

//     if (hashedOldPass !== user.hash) {
//         res.send403()
//         return
//     }

//     let securedUser = Auth.AddSecurity({password: req.body.newpassword})
//     delete securedUser.password
//     return Users.UpdateUser(user.id, securedUser)
//     .then(() => {
//         res.send({status: "Password successfully changed"})
//     })
// }

// function EditProfile(req, res, next) {
//     const user = req.kulakan.user
//     let valid = false
//     const updated = ['name', 'ktp', 'shop','phone','address','stateID','cityID','birth','bankAccountNumber','bankAccountName','bankID','bankBranch'].reduce((accum, attr) => {
//         if (attr in req.body) {
//             valid = true
//             accum[attr] = req.body[attr]
//         }

//         return accum
//     }, {})

//     if (!valid) {
//         res.send401()
//         return
//     }

//     return Users.UpdateSeller(user.id, updated)
//     .then(() => {
//         res.send({updated})
//     })
// }

// function ReportPipe(req, res, next) {
//     const user = req.kulakan.user
//     const {startDate, endDate} = req.query

//     return ExportOrders(res, user.id, new Date(startDate*1000), new Date(endDate*1000))
// }

// function BuyersReport(req, res, next) {
//     const user = req.kulakan.user
//     const {startDate, endDate} = req.query

//     return AggregateBuyersReport(user.id, new Date(startDate*1000), new Date(endDate*1000))
//     .then((result) => {
//         res.send(result)
//     })
// }

// function BuyerReportDetails(req, res, next) {
//     const user = req.kulakan.user
//     const {startDate, endDate} = req.query

//     return BuyerReport(user.id, req.params.id, new Date(startDate*1000), new Date(endDate*1000))
//     .then((result) => {
//         res.send(result)
//     })
// }

// function AllOrders(req, res, next) {
//     const user = req.kulakan.user
//     const {startDate, endDate} = req.query

//     return Orders.AllOrders(user.id, new Date(startDate*1000), new Date(endDate*1000))
//     .then((orders) => {
//         res.send({orders})
//     })
// }

export default {
    get: [
        ['/', UserDetail],
        ['/dashboard', Middleware(dashboardSpecs), DashboardPipe],
        // ['/dashboard/report', Middleware(dashboardSpecs), ReportPipe],
        // ['/buyer-reports', Middleware(dashboardSpecs), BuyersReport],
        // ['/buyer-reports/:id(\\d+)', Middleware(dashboardSpecs), BuyerReportDetails],
        // ['/general-report', Middleware(dashboardSpecs), AllOrders],
    ],
    // post: [
        // ['/', EditProfile],
        // ['/upload-image', ...S3Middleware('image'), Upload('image')],
        // ['/change-password', Middleware(changePassSpecs), ChangePass],
    // ],
};
