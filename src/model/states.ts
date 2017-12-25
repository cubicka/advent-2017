import * as lodash from 'lodash';

import * as bankJSON from '../raw/bank.json';
import * as stateJSON from '../raw/state.json';

const cities = lodash.map(lodash.range(1, 35), id => {
    const scity = require('../raw/city/' + id.toString());
    return lodash.reduce(scity.data.rows, (accum, c) => {
        accum[c.CityID] = c;
        return accum;
    }, {} as any);
});

const states = lodash.reduce(stateJSON.data.rows, (accum, s) => {
    accum[s.StateID] = s;
    return accum;
}, {} as any);

const banks = lodash.reduce(bankJSON.banks, (accum, b) => {
    accum[b.code] = b;
    return accum;
}, {} as any);

interface PublicData {
    bankID: string;
    cityID: string;
    stateID: string;
}

export function AddCity<T extends PublicData>(user: T) {
    return lodash.assign(user, {
        bank: user.bankID && banks[user.bankID],
        city: user.cityID && user.stateID && cities[parseInt(user.stateID, 10) - 1][user.cityID],
        state: user.stateID && states[user.stateID],
    });
}

export default {
    banks, cities, states,
};
