// import * as Bluebird from 'bluebird';
// import * as lodash from 'lodash';

// import { Omit } from '../util/type';

// import { FetchRelations } from './buyerRelations';
import { FetchTable, Table, Where } from './index';
import { FetchUsers } from './users';

export interface Seller {
    storecode: number;
    name: string;
    address: string;
}

export const FetchSellers = FetchTable<Seller>(Table.sellers);

export function GetWS(usercode: string) {
    return FetchUsers([
        Where({
            usercode: parseInt(usercode, 10),
        }),
    ])
    .then(users => {
        if (users.length !== 1) throw new Error('Usercode invalid.');
        const user = users[0];

        return FetchSellers([
            Where({
                city: 'BANDUNG',
                storecode: user.storecode,
            }),
        ], {
            sortBy: 'storecode',
            sortOrder: 'desc',
        });
    });
}
