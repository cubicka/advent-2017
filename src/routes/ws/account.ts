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
import Auth from '../../service/auth';
import { IsParseNumber, IsString, Middleware } from '../../util/validation';

import S3Middleware from '../middleware/s3';

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

// function ReportPipe(req: express.Request, res: express.Response, next: express.NextFunction) {
//     const user = req.kulakan.user;
//     const {startDate, endDate} = req.query;

//     return Dashboard.ExportOrders(
//         res,
//         user.id,
//         new Date(parseInt(startDate, 10) * 1000),
//         new Date(parseInt(endDate, 10) * 1000),
//     );
// }

// function BuyersReport(req: express.Request, res: express.Response, next: express.NextFunction) {
//     const user = req.kulakan.user;
//     const {startDate, endDate} = req.query;

//     return Dashboard.AggregateBuyersReport(
//         user.id,
//         new Date(parseInt(startDate, 10) * 1000),
//         new Date(parseInt(endDate, 10) * 1000),
//     )
//     .then(result => {
//         res.send(result);
//     });
// }

function EditProfile(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = req.kulakan.user;
    let valid = false;
    const updated = ['name', 'ktp', 'shop', 'phone', 'address', 'stateID', 'cityID', 'birth',
        'bankAccountNumber', 'bankAccountName', 'bankID', 'bankBranch'].reduce((accum: any, attr) => {
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

    return Sellers.Update(user.id, updated)
    .then(() => {
        res.send({updated});
    });
}

function Upload(name: string) {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const {user, uploads} = req.kulakan;
        return Sellers.UpdateImage(user.id, name, uploads.Location)
        .then(() => {
            res.send({[name]: uploads.Location});
        });
    };
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
    post: [
        ['/', EditProfile],
        ['/upload-image', ...S3Middleware('image'), Upload('image')],
        ['/change-password', Middleware(changePassSpecs), ChangePass],
    ],
};
