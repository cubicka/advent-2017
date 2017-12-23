import * as Bluebird from 'bluebird';
import * as knex from 'knex';

import * as config from '../config.json';

const pg = knex({
    client: 'postgresql',
    connection: config.dbConnection,
});

export enum Table {
    additionals = 'additionals',
    buyers = 'buyer_details',
    deliveryOptions = 'delivery_options',
    itemPrices = 'item_prices',
    katalog = 'katalog',
    orderItems = 'order_items',
    orders = 'orders',
    passwordTokens = 'password_token',
    sellers = 'seller_details',
    users = 'users',
}

export type BuilderFn = (builder: knex.QueryBuilder) => knex.QueryBuilder;
type knexValue = boolean | Date | null | string;

// function Count(name: Table): (builders: BuilderFn[]) =>  {
//     return builders => {
//         return builders.reduce((accum, builder): knex.QueryBuilder => {
//             return builder(accum);
//         }, pg(name)).count()
//         .then(counts => counts);
//     };
// }

function Count(name: Table) {
    return (builders: BuilderFn[]): Bluebird<number> => {
        return builders.reduce((accum, builder): knex.QueryBuilder => {
            return builder(accum);
        }, pg(name)).count()
        .then(counts => counts[0].count);
    };
}

function Fetch<T>(name: Table) {
    return (builders: BuilderFn[]): Bluebird<T[]> => {
        return builders.reduce((accum, builder): knex.QueryBuilder => {
            return builder(accum);
        }, pg(name))
        .then(result => result);
    };
}

function FetchJoin<T, K>(
    firstTable: Table,
    secondTable: Table,
    firstID: string,
    secondID: string,
) {
    return (firstBuilders: BuilderFn[], secondBuilders: BuilderFn[] = [], columns: string[] = [])
    : Bluebird<Array<(T & K)>> => {
        const builtSecondTable = secondBuilders.reduce((accum, builder): knex.QueryBuilder => {
            return builder(accum);
        }, pg(secondTable));

        return firstBuilders.reduce((accum, builder): knex.QueryBuilder => {
            return builder(accum);
        }, pg(firstTable).join(pg.raw('(' + builtSecondTable + ') as ' + secondTable), firstID, secondID))
        .select(...columns)
        .then(result => result);
    };
}

// function FetchJoin<T, K>(
//     firstTable: string,
//     secondTable: string,
//     firstID: string,
//     secondID: string,
// ): (builders: BuilderFn[]) => Bluebird<Array<(T & K)>> {
//     return (builders: BuilderFn[]) => {
//         return builders.reduce((accum, builder): knex.QueryBuilder => {
//             return builder(accum);
//         }, pg(firstTable).join(secondTable, firstID, secondID))
//         .then(result => result);
//     };
// }

function FilterBy(filters: { [x: string]: knexValue }): BuilderFn {
    return builder => builder.where(filters);
}

function FilterIn(key: string, values: Array<string | number>): BuilderFn {
    return builder => builder.whereIn(key, values);
}

function FilterNotNull(key: string): BuilderFn {
    return builder => builder.whereNotNull(key);
}

function FilterNull(key: string): BuilderFn {
    return builder => builder.whereNull(key);
}

function Insert(obj: any, returning?: string[]): BuilderFn {
    return builder => builder.insert(obj, returning);
}

function Join(tableName: string, firstID: string, secondID: string): BuilderFn {
    return builder => builder.innerJoin(tableName, firstID, secondID);
}

function Limit(n: number): BuilderFn {
    return builder => builder.limit(n);
}

function Offset(n: number): BuilderFn {
    return builder => builder.offset(n);
}

function Select(...keys: string[]): BuilderFn {
    return builder => builder.select(...keys);
}

function Update(updateInfo: { [x: string]: knexValue }, returning?: string[]): BuilderFn {
    return builder => builder.update(updateInfo, returning);
}

export const ORM = {
    Count, Fetch, FetchJoin, FilterBy, FilterIn, FilterNotNull, FilterNull, Insert, Join, Limit, Offset, Select, Update,
};

// export function FilterBy(key: string, value: string): BuilderFn {
//     return builder => builder.where({[key]: value})
// }

// export function FilterIn(key: string, )

export function Selector(names: string[]) {
    return names.map((name: string) => (pg.raw(`to_json(${name}.*) as ${name}`)));
}

export default pg;
