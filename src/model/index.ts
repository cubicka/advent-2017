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
    buyersRelations = 'buyer_relations',
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

interface QueryParams {
    columns?: string[];
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: string;
}

function BuilderBase(baseQuery: knex.QueryBuilder, builders: BuilderFn[]): knex.QueryBuilder {
    return builders.reduce((accum, builder) => builder(accum), baseQuery);
}

function BuilderQuery(baseQuery: knex.QueryBuilder) {
    return (builders: BuilderFn[], params: QueryParams = {}): knex.QueryBuilder => {
        const paramsBuilder = [];
        const { columns, limit, offset, sortBy, sortOrder } = params;
        if (limit) paramsBuilder.push(Limit(limit));
        if (offset) paramsBuilder.push(Offset(offset));
        if (sortBy && sortOrder) paramsBuilder.push(Sort(sortBy, sortOrder));
        if (columns) paramsBuilder.push(Select(...columns));

        return BuilderBase(baseQuery, builders.concat(paramsBuilder));
    };
}

function BuilderCount(baseQuery: knex.QueryBuilder) {
    return (builders: BuilderFn[]): knex.QueryBuilder => {
        return BuilderBase(baseQuery, builders).count();
    };
}

function BuilderJoin(
    firstTable: Table,
    secondTable: Table,
    firstID: string,
    secondID: string,
) {
    return (firstBuilders: BuilderFn[], secondBuilders: BuilderFn[] = []): knex.QueryBuilder => {
        const secondTableQuery = BuilderQuery(pg(secondTable))(secondBuilders);
        const secondTableJoin = pg(firstTable)
            .join(pg.raw('(' + secondTableQuery + ') as ' + secondTable), firstID, secondID);

        return BuilderBase(secondTableJoin, firstBuilders);
    };
}

function BuilderLeftJoin(
    firstTable: Table,
    secondTable: Table,
    firstID: string,
    secondID: string,
) {
    return (firstBuilders: BuilderFn[], secondBuilders: BuilderFn[] = []): knex.QueryBuilder => {
        const secondTableQuery = BuilderQuery(pg(secondTable))(secondBuilders);
        const secondTableJoin = pg(firstTable)
            .leftJoin(pg.raw('(' + secondTableQuery + ') as ' + secondTable), firstID, secondID);

        return BuilderBase(secondTableJoin, firstBuilders);
    };
}

function Count(name: Table) {
    return (builders: BuilderFn[]): Bluebird<number> => {
        return BuilderCount(pg(name))(builders)
        .then((result: Array<{count: number}>) => result[0].count);
    };
}

function Fetch<T>(name: Table) {
    return (builders: BuilderFn[], params: QueryParams = {}): Bluebird<T[]> => {
        return BuilderQuery(pg(name))(builders, params)
        .then((result: T[]) => result);
    };
}

function FetchAndCount<T>(name: Table) {
    return (builders: BuilderFn[], params: QueryParams): Bluebird<{ count: number, list: T[]}> => {
        return Bluebird.all([
            Fetch<T>(name)(builders, params),
            Count(name)(builders),
        ])
        .then(([list, count]) => {
            return { count, list };
        });
    };
}

function FetchJoin<T, K>(
    firstTable: Table,
    secondTable: Table,
    firstID: string,
    secondID: string,
) {
    return (firstBuilders: BuilderFn[], secondBuilders: BuilderFn[] = [], params: QueryParams = {})
    : Bluebird<Array<(T & K)>> => {
        const baseQuery = BuilderJoin(firstTable, secondTable, firstID, secondID)(firstBuilders, secondBuilders);
        return BuilderQuery(baseQuery)([], params)
        .then(result => result);
    };
}

function FetchLeftJoin<T, K>(
    firstTable: Table,
    secondTable: Table,
    firstID: string,
    secondID: string,
) {
    return (firstBuilders: BuilderFn[], secondBuilders: BuilderFn[] = [], params: QueryParams = {})
    : Bluebird<Array<(T & K)>> => {
        const baseQuery = BuilderLeftJoin(firstTable, secondTable, firstID, secondID)(firstBuilders, secondBuilders);
        return BuilderQuery(baseQuery)([], params)
        .then(result => result);
    };
}

function FetchJoinAndCount<T, K>(
    firstTable: Table,
    secondTable: Table,
    firstID: string,
    secondID: string,
) {
    return (firstBuilders: BuilderFn[], secondBuilders: BuilderFn[] = [], params: QueryParams = {})
    : Bluebird<{ count: number, list: Array<(T & K)> }> => {
        const baseQuery = BuilderJoin(firstTable, secondTable, firstID, secondID)(firstBuilders, secondBuilders);

        return Bluebird.all([
            BuilderQuery(baseQuery.clone())([], params).then(result => result),
            BuilderCount(baseQuery.clone())([]).count(),
        ])
        .then(([list, counts]) => {
            return { count: counts[0].count, list };
        });
    };
}

function FilterBy(filters: { [x: string]: knexValue } | (() => any)): BuilderFn {
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

function Sort(sortAttr: string, sortDir: string): BuilderFn {
    return builder => builder.orderBy(sortAttr, sortDir);
}

function Select(...keys: string[]): BuilderFn {
    return builder => builder.select(...keys);
}

function Update(updateInfo: { [x: string]: knexValue }, returning?: string[]): BuilderFn {
    return builder => builder.update(updateInfo, returning);
}

export const ORM = {
    Count, Fetch, FetchAndCount, FetchLeftJoin, FetchJoin, FetchJoinAndCount, FilterBy, FilterIn, FilterNotNull,
    FilterNull, Insert, Join, Limit, Offset, Select, Update,
};

export function Selector(names: string[]) {
    return names.map((name: string) => (pg.raw(`to_json(${name}.*) as ${name}`)));
}

export default pg;
