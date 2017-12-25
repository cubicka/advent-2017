import express from 'express';
import * as lodash from 'lodash';

import * as bank from '../../raw/bank.json';
import * as state from '../../raw/state.json';

const cities = lodash.map(lodash.range(1, 35), id => {
    return require('../../raw/city/' + id.toString() + '.json');
});

function State(req: express.Request, res: express.Response, next: express.NextFunction) {
    res.send({state: lodash.orderBy(state.data.rows, (s: any) => (s.StateID))});
}

function Bank(req: express.Request, res: express.Response, next: express.NextFunction) {
    res.send({banks: lodash.orderBy(bank.banks, (b: any) => (b.code))});
}

function City(req: express.Request, res: express.Response, next: express.NextFunction) {
    const stateID = parseInt(req.query.stateID, 10);
    if (isNaN(stateID) || stateID < 1 || stateID > 34) {
        res.send400();
        return;
    }

    res.send({cities: lodash.orderBy(cities[stateID - 1].data.rows, (city: any) => (city.CityID))});
}

function Help(req: express.Request, res: express.Response, next: express.NextFunction) {
    res.send({
        email: 'support@rulo.zendesk.com',
        phone: '085574677056',
        sms: '08568055871',
    });
}

export default {
    get: [
        ['/bank', Bank],
        ['/state', State],
        ['/cities', City],
        ['/help', Help],
    ],
};
