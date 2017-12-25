import * as Bluebird from 'bluebird';

import { getRandomIntInclusive } from '../util/num';

import pg, { FetchFactory, ORM, Table } from './index';

export interface PasswordToken {
    token: string;
    used: string;
    userID: string;
}

const FetchPasswordToken = FetchFactory<PasswordToken>(pg(Table.passwordTokens));

export function GetByToken(token: string): Bluebird<PasswordToken[]> {
    return FetchPasswordToken([
        ORM.Where({ used: false, token }),
    ])
    .then(tokens => {
        if (tokens.length === 0) throw new Error('Token tidak ditemukan');
        return tokens;
    });
}

function CreatePassToken(userID: string): Bluebird<string> {
    const token = Array.from({ length: 10 }).map(x => (getRandomIntInclusive(0, 9))).join('');
    return FetchPasswordToken([
        ORM.Where({ userID }),
        ORM.Update({ used: true }),
    ])
    .then(() => FetchPasswordToken([
        ORM.Where({ token }),
        ORM.Update({ used: true }),
    ]))
    .then(() => FetchPasswordToken([
        ORM.Where({ token, userID }),
    ]))
    .then(() => token);
}

export default {
    CreatePassToken,
    GetByToken,
};
