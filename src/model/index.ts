import * as Bluebird from 'bluebird';
import * as knex from 'knex';

import * as config from '../config.json';

const pg = knex({
    client: 'postgresql',
    connection: config.dbConnection,
});

export enum Table {
    brand = 'x_product_brand',
    category = 'x_product_category',
    distribution = 'x_product_distribution',
    orderDetail = 'x_order_detail',
    orderMaster = 'x_order_master',
    prices = 'x_product_price',
    sellers = 'x_store_master',
    sku = 'x_product_sku',
    subbrand = 'x_product_subbrand',
    subcategory = 'x_product_subcategory',
    user = 'x_user',
}

export type BuilderFn = (builder: knex.QueryBuilder) => knex.QueryBuilder;
export type QueryBuilder = knex.QueryBuilder;
type knexValue = boolean | Date | null | string | number;

export interface QueryParams {
    columns?: Array<string | knex.Raw>;
    count?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: string;
}

export function Extender(query: knex.QueryBuilder, builders: BuilderFn[]): knex.QueryBuilder {
    return builders.reduce((accum, builder) => builder(accum), query.clone());
}

export function Fetch<T>(query: knex.QueryBuilder, params: QueryParams = {}): Bluebird<T[]> {
    const paramsBuilder = [];
    const { columns, limit, offset, sortBy, sortOrder } = params;
    if (limit) paramsBuilder.push(Limit(limit));
    if (offset) paramsBuilder.push(Offset(offset));
    if (sortBy && sortOrder) paramsBuilder.push(OrderBy(sortBy, sortOrder));
    if (columns) paramsBuilder.push(Select(...columns));

    return Extender(query.clone(), paramsBuilder).then(result => result);
}

export function FetchTable<T>(name: Table) {
    return FetchFactory<T>(pg(name));
}

export function FetchFactory<T>(query: knex.QueryBuilder) {
    return (builders: BuilderFn[], params: QueryParams = {}): Bluebird<T[]> => {
        return Fetch<T>(Extender(query.clone(), builders), params);
    };
}

export function Count(query: knex.QueryBuilder, column?: string, length: boolean = false): Bluebird<number> {
    return query.clone().count(column).then(result => (length ? result.length : result[0].count));
}

export function CountFactory(query: knex.QueryBuilder) {
    return (builders: BuilderFn[], column?: string): Bluebird<number> => {
        return Count(Extender(query.clone(), builders));
    };
}

export function FetchAndCount<T>(
    query: knex.QueryBuilder,
    params: QueryParams = {},
): Bluebird<{ result: T[], count: number }> {
    return Bluebird.all([
        Fetch<T>(query, params),
        Count(query, params.count),
    ])
    .then(([result, count]) => {
        return { result, count };
    });
}

export function Join(
    firstQuery: knex.QueryBuilder,
    secondQuery: knex.QueryBuilder,
    firstID: string,
    secondID: string,
    alias: string,
): knex.QueryBuilder {
    return firstQuery.join(pg.raw('(' + secondQuery + ') as ' + alias), firstID, secondID);
}

export function LeftJoin(
    firstQuery: knex.QueryBuilder,
    secondQuery: knex.QueryBuilder,
    firstID: string,
    secondID: string,
    alias: string,
): knex.QueryBuilder {
    return firstQuery.leftJoin(pg.raw('(' + secondQuery + ') as ' + alias), firstID, secondID);
}

export function JoinFactory(
    firstQuery: knex.QueryBuilder,
    secondQuery: knex.QueryBuilder,
    firstID: string,
    secondID: string,
    alias: string,
) {
    return (firstBuilders: BuilderFn[], secondBuilders: BuilderFn[] = []): knex.QueryBuilder => {
        return Extender(
            Join(firstQuery.clone(), Extender(secondQuery.clone(), secondBuilders), firstID, secondID, alias),
            firstBuilders,
        );
    };
}

export function LeftJoinFactory(
    firstQuery: knex.QueryBuilder,
    secondQuery: knex.QueryBuilder,
    firstID: string,
    secondID: string,
    alias: string,
) {
    return (firstBuilders: BuilderFn[], secondBuilders: BuilderFn[] = []): knex.QueryBuilder => {
        return Extender(
            LeftJoin(firstQuery.clone(), Extender(secondQuery.clone(), secondBuilders), firstID, secondID, alias),
            firstBuilders,
        );
    };
}

export function FetchJoin<T>(
    firstQuery: knex.QueryBuilder,
    secondQuery: knex.QueryBuilder,
    firstID: string,
    secondID: string,
    alias: string,
) {
    return (firstBuilders: BuilderFn[], secondBuilders: BuilderFn[] = [], params: QueryParams = {}): Bluebird<T[]> => {
        return Fetch<T>(
            JoinFactory(firstQuery, secondQuery, firstID, secondID, alias)(firstBuilders, secondBuilders),
            params,
        );
    };
}

export function FetchLeftJoin<T>(
    firstQuery: knex.QueryBuilder,
    secondQuery: knex.QueryBuilder,
    firstID: string,
    secondID: string,
    alias: string,
) {
    return (firstBuilders: BuilderFn[], secondBuilders: BuilderFn[] = [], params: QueryParams = {}): Bluebird<T[]> => {
        return Fetch<T>(
            LeftJoinFactory(firstQuery, secondQuery, firstID, secondID, alias)(firstBuilders, secondBuilders),
            params,
        );
    };
}

function From(key: string): BuilderFn {
    return builder => builder.from(key);
}

function GroupBy(keys: string[]): BuilderFn {
    return builder => builder.groupBy(...keys);
}

function Having(firstKey: knex.Raw, keys: Array<string | number>): BuilderFn {
    return builder => builder.having(firstKey, ...keys);
}

export function Insert(
    obj: { [x: string]: knexValue } | Array<{[x: string]: knexValue}>,
    returning?: string[],
): BuilderFn {
    return builder => builder.insert(obj, returning);
}

function Limit(n: number): BuilderFn {
    return builder => builder.limit(n);
}

function Offset(n: number): BuilderFn {
    return builder => builder.offset(n);
}

function OrderBy(column: string, dir: string): BuilderFn {
    return builder => builder.orderBy(column, dir);
}

function Select(...keys: Array<string | knex.Raw>): BuilderFn {
    return builder => builder.select(...keys);
}

export function Update(updateInfo: { [x: string]: knexValue }, returning?: string[]): BuilderFn {
    return builder => builder.update(updateInfo, returning);
}

export function Where(filters: { [x: string]: knexValue } | (() => any)): BuilderFn {
    return builder => builder.where(filters);
}

function WhereA(key: string, ...params: Array<string | number | Date>): BuilderFn {
    return builder => builder.where(key, ...params);
}

export function WhereIn(key: string, values: Array<string | number>): BuilderFn {
    return builder => builder.whereIn(key, values);
}

export function WhereLike(key: string, values: string): BuilderFn {
    return builder => builder.where(key, 'ilike', values);
}

function WhereNot(key: string, value: string | number): BuilderFn {
    return builder => builder.whereNot(key, value);
}

function WhereNotNull(key: string): BuilderFn {
    return builder => builder.whereNotNull(key);
}

function WhereNull(key: string): BuilderFn {
    return builder => builder.whereNull(key);
}

// export const ORM = {
//     Count, Fetch, FetchAndCount, From, Join, LeftJoin,
//     GroupBy, Having, Insert, Limit, Offset, OrderBy, Select, Update,
//     Where, WhereA, WhereIn, WhereNot, WhereNotNull, WhereNull,
// };

export function Selector(names: string[]) {
    return names.map((name: string) => (pg.raw(`to_json(${name}.*) as ${name}`)));
}

export default pg;
