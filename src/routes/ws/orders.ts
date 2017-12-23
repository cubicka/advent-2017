// import LifeCycleEndpoint, {Fetch, EndpointNotif} from '../../middleware/orderLifeCycle'
// import {SendMobileNotification} from '../../middleware/firebase'
// import {Seller as Orders} from '../../../model/orders'
// import {Seller as OrderManager} from '../../../model/orderLifeCycle'
// import {FindDriver as Trucktobee} from '../../../service/trucktobee'
// import {MergeDeep} from '../../../util/obj'
// import Courier from '../../../model/courier'
import express from 'express';

import Orders from '../../model/orders';

import { ParseLimitOffset } from '../middleware/helper';

function List(req: express.Request, res: express.Response, next: express.NextFunction) {
    const { user, params } = req.kulakan;

    return Orders.ListBySeller(user.id, { ...params, status: req.query.status })
    .then(result => {
        res.send(result);
    });
}

function Unread(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = req.kulakan.user;
    return Orders.ListUnread(user.id)
    .then(count => {
        res.send({count});
    });
}

// function Detail(req: express.Request, res: express.Response, next: express.NextFunction) {
//     const user = req.kulakan.user
//     return Orders.Detail(user.id, req.params.id)
//     .then(order => {
//         res.send({ order })
//     })
// }

export default {
    get: [
        ['/', ParseLimitOffset, List],
        ['/unread', Unread],
        // ['/:id(\\d+)', Detail],
    ],
    post: [
        // ['/:id(\\d+)', Accept, SendMobileNotification, SendRes],
        // ['/:id(\\d+)/draft', Draft, SendMobileNotification, SendRes],
        // ['/:id(\\d+)/cancel', Cancel, SendMobileNotification, SendRes],
        // ['/:id(\\d+)/ready-for-pickup', ReadyForPickup, SendMobileNotification, SendRes],
        // ['/:id(\\d+)/find-driver', Fetch(OrderManager.Fetch), GetBuyer, FindDriver],
        // ['/:id(\\d+)/deliver', FetchOrder, DeliverValidator, Deliver],
    ],
};

// const RuloMapping = require('../../../model/ruloMapping.json')

// function ChangeName(item) {
//     if (!item || !item.name) return item
//     const realName = Object.keys(RuloMapping).find((baseName) => (RuloMapping[baseName].katalog.id === item.itemID))

//     if (!realName) return item
//     return MergeDeep(item, {
//         okcuk: realName,
//     })
// }

// function ChangeImageUrl(item) {
//     if (!item.image) return item

//     const fullUrl = item.image
//     const splittedUrl = fullUrl.split('/')

//     const fileName = splittedUrl[splittedUrl.length-1]
//     const prefix = 'https://rulo-katalog.s3.amazonaws.com'
//     const subs = ['img512', 'img256', 'img128', 'img64', 'img32']

//     return subs.reduce((accum, sub) => {
//         return Object.assign(accum, {
//             [sub]: `${prefix}/${sub}/${fileName}`,
//         })
//     }, Object.assign(item, {
//         image: `${prefix}/img256/${fileName}`,
//         imageFull: item.image,
//     }))
// }

// function AddDriverDetail(req, res, next) {
//     const order = req.kulakan.order
//     return OrderManager.DriverInfo(order)
//     .then((order) => {
//         req.kulakan.order = order
//         next()
//     })
// }

// function CheckDriver(req, res, next) {
//     const order = req.kulakan.order
//     if(order['driver_assignments'].length > 0 && order.driver_assignments[0].cancelled === null) {
//         res.send400()
//         return
//     }

//     next()
// }

// function GetBuyer(req, res, next) {
//     const {user, order} = req.kulakan
//     return Orders.Detail(user.id, order.id)
//     .then((orders) => {
//         if (orders[0].details.assigned || !orders[0].details.accepted) {
//             res.send400()
//             return
//         }

//         req.kulakan.buyer = orders[0].buyer
//         next()
//     })
// }

// function FindDriver(req, res, next) {
//     const {buyer, order} = req.kulakan

//     return Trucktobee(buyer, order.id)
//     .then((result) => {
//         if (!result.status || result.status !== "success") {
//             res.send400("Failed to get driver.")

//             return
//         }

//         return Courier.Create(order.id, result)
//         .then(() => {
//             res.send({
//                 status: "success",
//                 result,
//             })
//         })
//     })
// }

// function Accept(req, res, next) {
//     const {user} = req.kulakan
//     const {items, additionals, notes} = req.body
//     return Orders.Accept(user.id, {items, additionals: additionals || [], orderID: req.params.id}, notes)
//     .then((orders) => {
//         const order = orders[0]
//         if (!order) {
//             res.send403()
//             return
//         }

//         if (order.message) {
//             res.send403(order.message)
//             return
//         }

//         req.kulakan.order = order
//         req.kulakan.buyerID = order.details.buyerID
//         req.kulakan.payload = {
//             notification: {
//                 title: 'Pesanan Mulai Diproses',
//                 body: notes || "",
//             },
//             data: {
//                 orderID: req.params.id.toString(),
//             }
//         }

//         next()
//     })
// }

// function Draft(req, res, next) {
//     const {user} = req.kulakan
//     const {items, additionals} = req.body
//     return Orders.Draft(user.id, {items, additionals: additionals || [], orderID: req.params.id})
//     .then((orders) => {
//         const order = orders[0]
//         if (!order || order.message) {
//             res.send403(order.message)
//             return
//         }

//         req.kulakan.order = order
//         req.kulakan.buyerID = order.details.buyerID
//         req.kulakan.payload = {
//             notification: {
//                 title: `Pesanan diubah oleh ${order.seller.shop}`,
//                 body: 'Pesanan anda mengalami sedikit perubahan',
//             },
//             data: {
//                 orderID: req.params.id.toString(),
//             }
//         }

//         next()
//     })
// }

// function Cancel(req, res, next) {
//     const {user} = req.kulakan
//     const {notes} = req.body
//     return Orders.Cancel(user.id, req.params.id, notes)
//     .then((orders) => {
//         const order = orders[0]
//         if (!order || order.message) {
//             res.send401(order.message)
//             return
//         }

//         req.kulakan.order = order
//         req.kulakan.buyerID = order.details.buyerID
//         req.kulakan.payload = {
//             notification: {
//                 title: 'Pesanan Ditolak',
//                 body: notes || "",
//             },
//             data: {
//                 orderID: req.params.id.toString(),
//             }
//         }

//         next()
//     })
// }

// function SendRes(req, res, next) {
//     res.send({order: req.kulakan.order})
// }

// function FetchOrder(req, res, next) {
//     const user = req.kulakan.user
//     const id = req.params.id

//     return OrderManager.Fetch(user.id, id)
//     .then((orders) => {
//         const order = orders[0]
//         if (!order) {
//             return res.send403()
//         }

//         req.kulakan.order = order
//         next()
//     })
// }

// function DeliverValidator(req, res, next) {
//     const order = req.kulakan.order

//     if (!OrderManager.Validator('deliver2')(order)) {
//         return res.send401()
//     }

//     next()
// }

// function Deliver(req, res, next) {
//     const order = req.kulakan.order
//     return OrderManager.deliver(order.id)
//     .then((result) => {
//         res.send({order: result})
//     })
// }

// function ReadyForPickup(req, res, next) {
//     const {user} = req.kulakan
//     return Orders.AssignOrder(user.id, req.params.id)
//     .then((orders) => {
//         const order = orders[0]
//         if (!order) {
//             return res.send403()
//         }

//         if (order.message) {
//             return res.send403(order.message)
//         }

//         req.kulakan.order = order
//         req.kulakan.buyerID = order.details.buyerID
//         req.kulakan.payload = {
//             notification: {
//                 title: 'Pesanan Siap Diambil',
//                 body: '',
//             },
//             data: {
//                 orderID: req.params.id.toString(),
//             }
//         }

//         next()
//     })
// }
