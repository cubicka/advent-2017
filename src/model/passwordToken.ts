import Bluebird from 'bluebird'

import { getRandomIntInclusive } from '../util/num'

import { ORM } from './index'

export interface PasswordToken {
    token: string;
    used: string;
    userID: string;
}

const FetchPasswordToken = ORM.Fetch<PasswordToken>('password_token')

export function GetByToken(token: string): Bluebird<PasswordToken[]> {
    return FetchPasswordToken([
        ORM.FilterBy({ used: false, token: token }),
    ])
    .then(tokens => {
        if (tokens.length === 0) throw new Error('Token tidak ditemukan')
        return tokens
    })
}

function CreatePassToken(userID: string): Bluebird<string> {
    const token = [1,2,3,4,5,6,7,8,9,10].map((x) => (getRandomIntInclusive(0, 9))).join('')
    return FetchPasswordToken([
        ORM.FilterBy({ userID }),
        ORM.Update({ used: true }),
    ])
    .then(() => FetchPasswordToken([
        ORM.FilterBy({ token }),
        ORM.Update({ used: true })
    ]))
    .then(() => FetchPasswordToken([
        ORM.FilterBy({ token, userID }),
    ]))
    .then(() => token)
}

export default {
    CreatePassToken,
    GetByToken,
}
