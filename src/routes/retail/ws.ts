import * as Bluebird from 'bluebird';
import express from 'express';
import * as lodash from 'lodash';

import { GetTier, PickPrice } from '../../model/buyerRelations';
import Buyers from '../../model/buyers';
import { KatalogPriceListed, SellerCategory } from '../../model/katalog';
import Sellers from '../../model/sellers';
import { ChangeImageUrl } from '../../service/image';
import { CleanQuery } from '../../util/obj';
import { IsString, Middleware } from '../../util/validation';

import { ParseLimitOffset } from '../middleware/helper';

function List(req: express.Request, res: express.Response, next: express.NextFunction) {
    const {limit, offset} = req.kulakan.params;

    return Sellers.ListForBuyer(req.kulakan.user.id, limit, offset)
    .then(ws => {
        res.send({ws});
    });
}

function Detail(req: express.Request, res: express.Response, next: express.NextFunction) {
    return Sellers.DetailsForBuyer(req.kulakan.user.id, req.params.id)
    .then(ws => {
        res.send({ws});
    });
}

function Category(req: express.Request, res: express.Response, next: express.NextFunction) {
    return SellerCategory(req.params.id)
    .then(categories => {
        res.send({categories});
    });
}

function Items(req: express.Request, res: express.Response, next: express.NextFunction) {
    const {limit, offset} = req.kulakan.params;
    const {name, category} = req.query;

    return Bluebird.all([
        KatalogPriceListed(req.params.id, {
            name: CleanQuery(name), category: CleanQuery(category), limit, offset,
            price: 'price',
        }),
        GetTier(req.kulakan.user.id, req.params.id),
    ])
    .then(([items, tier]) => {
        res.send({
            items: {
                count: items.count,
                items: items.items.map(ChangeImageUrl).map(item => {
                    return lodash.assign(item, {
                        prices: item.prices !== undefined ?
                            item.prices.map(prices => PickPrice(prices, tier)) :
                            [],
                    });
                }),
                // items: items.items.map(item => lodash.assign(item, {image: ChangeImageUrlDirectly(item.image)})),
            },
        });
    });
}

function ItemsByIDs(req: express.Request, res: express.Response, next: express.NextFunction) {
    const ids = CleanQuery(req.query.ids).split(',')
        .map(id => (parseInt(id, 10))).filter(x => (!isNaN(x)));

    return Bluebird.all([
        KatalogPriceListed(req.params.id, { ids: ids.map(n => n.toString()) }),
        GetTier(req.kulakan.user.id, req.params.id),
    ])
    .then(([items, tier]) => {
        res.send({
            items: {
                count: items.count,
                items: items.items.map(ChangeImageUrl).map(item => {
                    return lodash.assign(item, {
                        prices: item.prices !== undefined ?
                            item.prices.map(prices => PickPrice(prices, tier)) :
                            [],
                    });
                }),
            },
        });
    });
}

function GetFavorites(req: express.Request, res: express.Response, next: express.NextFunction) {
    const {user} = req.kulakan;
    return Sellers.Favorites(user.id, req.params.id)
    .then((favorites: any) => {
        const retailFavs = lodash.uniqBy(favorites, (fav: any) => {
            return `${fav.buyerID}/${fav.sellerID}/${fav.itemID}/${fav.isFavorites}`;
        });

        res.send({favorites: retailFavs});
    });
}

function UpdateFavorites(req: express.Request, res: express.Response, next: express.NextFunction) {
    const {user} = req.kulakan;
    const {items} = req.body;

    return Sellers.SetFavorites(user.id, req.params.id, items)
    .then((favorites: any) => {
        res.send({favorites});
    });
}

const joinWsSpecs = {
    body: {
        referral: (s: string) => (IsString(s) && s !== ''),
    },
};

function JoinWS(req: express.Request, res: express.Response, next: express.NextFunction) {
    const { user } = req.kulakan;

    return Buyers.JoinWs(user.id, req.body.referral)
    .then(() => {
        res.send({ status: 'success' });
    })
    .catch((e: any) => {
        res.status(400).send({ status: 'failed', message: e.message });
    });
}

export default {
    get: [
        ['/', ParseLimitOffset, List],
        ['/:id(\\d+)', Detail],
        ['/:id(\\d+)/category', Category],
        ['/:id(\\d+)/items', ParseLimitOffset, Items],
        ['/:id(\\d+)/itemsByIDs', ParseLimitOffset, Middleware({query: {ids: IsString}}), ItemsByIDs],
        ['/:id(\\d+)/favorites', GetFavorites],
    ],
    post: [
        ['/join', Middleware(joinWsSpecs), JoinWS],
        ['/:id(\\d+)/favorites', UpdateFavorites],
    ],
};
