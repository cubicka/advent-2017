import Bluebird from 'bluebird'
import knex from 'knex'

const config = require('../config.json')

var pg = knex({
    client: 'postgresql',
    connection: config.dbConnection,
})

export enum Table {
    buyer = 'buyer_details',
    deliveryOptions = 'delivery_options',
    passwordToken = 'password_token',
    seller = 'seller_details',
    users = 'users',
}

export type BuilderFn = (builder: knex.QueryBuilder) => knex.QueryBuilder;
type knexValue = boolean | Date | null | string

function Fetch<T>(name: string): (builders: BuilderFn[]) => Bluebird<T[]> {
    return (builders: BuilderFn[]) => {
        return builders.reduce((accum, builder): knex.QueryBuilder => {
            return builder(accum)
        }, pg(name))
        .then(result => result)
    }
}

function FetchJoin<T,K>(firstTable: string, secondTable: string, firstID: string, secondID: string): (builders: BuilderFn[]) => Bluebird<(T & K)[]> {
    return (builders: BuilderFn[]) => {
        return builders.reduce((accum, builder): knex.QueryBuilder => {
            return builder(accum)
        }, pg(firstTable).join(secondTable, firstID, secondID))
        .then(result => result)
    }
}

function FilterBy(filters: { [x: string]: knexValue }): BuilderFn {
    return builder => builder.where(filters)
}

function FilterIn(key: string, values: string[]): BuilderFn {
    return builder => builder.whereIn(key, values)
}

function Insert(obj: any, returning?: string[]): BuilderFn {
    return builder => builder.insert(obj, returning)
}

function Join(tableName: string, firstID: string, secondID: string): BuilderFn {
    return builder => builder.innerJoin(tableName, firstID, secondID)
}

function Select(...keys: string[]): BuilderFn {
    return builder => builder.select(...keys)
}

function Update(updateInfo: { [x: string]: knexValue }, returning?: string[]): BuilderFn {
    return builder => builder.update(updateInfo, returning)
}

export const ORM = {
    Fetch, FetchJoin, FilterBy, FilterIn, Insert, Join, Select, Update,
}

// export function FilterBy(key: string, value: string): BuilderFn {
//     return builder => builder.where({[key]: value})
// }

// export function FilterIn(key: string, )

export function Selector(names: string[]) {
    return names.map((name: string) => (pg.raw(`to_json(${name}.*) as ${name}`)))
}

export default pg
