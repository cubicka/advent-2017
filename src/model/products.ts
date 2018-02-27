import * as lodash from 'lodash';

import pg, { Fetch, FetchTable, JoinFactory, Table, Where, WhereIn } from './index';

interface Brand {
    brandcode: string;
    brandname: string;
    id: number;
    subcategorycode: string;
}

interface Category {
    categorycode: string;
    categoryname: string;
}

interface Price {
    price: number;
    skucode: string;
    storecode: string;
}

interface Product {
    categorycode: string;
    skucode: string;
}

const FetchSellerProducts = JoinFactory(
    pg(Table.sku), pg(Table.distribution),
    `${Table.sku}.skucode`, `${Table.distribution}.skucode`, Table.distribution,
);

const FetchBrands = JoinFactory(
    pg(Table.brand), pg(Table.subcategory),
    `${Table.brand}.subcategorycode`, `${Table.subcategory}.subcategorycode`, Table.subcategory,
);

const FetchCategories = FetchTable<Category>(Table.category);
const FetchPrices = FetchTable<Price>(Table.prices);

export function GetCategories(storecode: string) {
    return Fetch<Product>(
        FetchSellerProducts([
        ], [
            Where({
                storecode: parseInt(storecode, 10),
            }),
        ]),
        {
            columns: ['categorycode'],
        },
    )
    .then(products => {
        const categorycodes = lodash.uniq(products.map(c => c.categorycode));

        return FetchCategories([
            WhereIn('categorycode', categorycodes),
        ], {
            sortBy: 'categorycode',
            sortOrder: 'asc',
        });
    });
}

export function GetPrices(storecode: string, skucodes: string[]) {
    return FetchPrices([
        Where({
            storecode,
        }),
        WhereIn('skucode', skucodes),
    ]);
}

export function GetProductByBrand(storecode: string, brandcodes: string[]) {
    return Fetch<Product>(
        FetchSellerProducts([
            WhereIn('brandcode', brandcodes),
        ], [
            Where({
                storecode: parseInt(storecode, 10),
            }),
        ]),
    );
}

export function GetProductByCategory(storecode: string, categorycode: string) {
    return Fetch<Product>(
        FetchSellerProducts([
            Where({
                categorycode,
            }),
        ], [
            Where({
                storecode: parseInt(storecode, 10),
            }),
        ]),
    );
}

export function GetProductByIDs(storecode: string, skucodes: string[]) {
    return Fetch<Product>(
        FetchSellerProducts([
            WhereIn('skucode', skucodes),
        ], [
            Where({
                storecode: parseInt(storecode, 10),
            }),
        ]),
    );
}

export function GetProductByWord(storecode: string, word: string) {
    return Fetch<Brand>(
        FetchBrands([
            Where(function(this: any) {
                word.split(' ').filter((s: string) => (s.length > 0)).forEach((s: string) => {
                    this.andWhere(function(this: any) {
                        this.orWhere('brandname', 'ilike', `%${s}%`)
                        .orWhere('subcategoryname', 'ilike', `%${s}%`);
                    });
                });
            }),
        ]),
    )
    .then(brands => {
        return GetProductByBrand(storecode, brands.map(b => b.brandcode));
    });
}

// order_detail
// orderid character varying(50) NOT NULL,
// skucode character varying(50) NOT NULL,
// caseqty integer,
// pcsqty integer,
// casesize smallint NOT NULL,
// price numeric(12,2) NOT NULL,
// total numeric(18,4),
// seq character varying(30),
// CONSTRAINT x_order_detail_pkey PRIMARY KEY (orderid, skucode),
// CONSTRAINT x_order_detail_skucode_fkey FOREIGN KEY (skucode)
//     REFERENCES x_product_sku (skucode) MATCH SIMPLE
//     ON UPDATE NO ACTION ON DELETE NO ACTION

// order_master
// orderid character varying(50) NOT NULL,
// dated date NOT NULL,
// storecode bigint NOT NULL,
// usercode bigint NOT NULL,
// uploadtime timestamp without time zone NOT NULL,
// picktime timestamp without time zone NOT NULL,
// remarks character varying(150),
// total numeric(18,4) NOT NULL,
// longitude numeric(18,4),
// latitude numeric(18,4),
// isprint bit(1) NOT NULL DEFAULT B'0'::"bit",
// ischeckout bit(1) NOT NULL DEFAULT B'0'::"bit",
// iscanceled bit(1) NOT NULL DEFAULT B'0'::"bit",
// CONSTRAINT x_order_master_pkey PRIMARY KEY (orderid)

// orderdraft
// usercode bigint NOT NULL,
// storecode bigint NOT NULL,
// skucode character varying(25) NOT NULL,
// qty integer NOT NULL,
// price numeric(14,2) NOT NULL DEFAULT 0,
// sequence character varying(50),
// createdate timestamp without time zone NOT NULL,
// isinvoice bit(1) NOT NULL DEFAULT B'0'::"bit",
// id bigserial NOT NULL,
// CONSTRAINT x_orderdraft_pkey PRIMARY KEY (usercode, storecode, skucode, id)
