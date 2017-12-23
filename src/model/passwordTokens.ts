import Bluebird from 'bluebird';

import { getRandomIntInclusive } from '../util/num';

import { ORM, Table } from './index';

export interface PasswordToken {
    token: string;
    used: string;
    userID: string;
}

const FetchPasswordToken = ORM.Fetch<PasswordToken>(Table.passwordTokens);

export function GetByToken(token: string): Bluebird<PasswordToken[]> {
    return FetchPasswordToken([
        ORM.FilterBy({ used: false, token }),
    ])
    .then(tokens => {
        if (tokens.length === 0) throw new Error('Token tidak ditemukan');
        return tokens;
    });
}

function CreatePassToken(userID: string): Bluebird<string> {
    const token = Array.from({ length: 10 }).map(x => (getRandomIntInclusive(0, 9))).join('');
    return FetchPasswordToken([
        ORM.FilterBy({ userID }),
        ORM.Update({ used: true }),
    ])
    .then(() => FetchPasswordToken([
        ORM.FilterBy({ token }),
        ORM.Update({ used: true }),
    ]))
    .then(() => FetchPasswordToken([
        ORM.FilterBy({ token, userID }),
    ]))
    .then(() => token);
}

export default {
    CreatePassToken,
    GetByToken,
};