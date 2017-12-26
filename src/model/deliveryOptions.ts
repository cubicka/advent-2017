import * as Bluebird from 'bluebird';
import * as lodash from 'lodash';

import pg, { FetchFactory, ORM, Table } from './index';

export enum DeliveryOptionsType {
    delivery = 'delivery',
    pickup = 'pickup',
}

interface DeliveryOptions {
    active: string;
    options: DeliveryOptionsType;
    userID: string;
}

const FetchDeliveryOptions = FetchFactory<DeliveryOptions>(pg(Table.deliveryOptions));

function GetDeliveryOptions(userID: string): Bluebird<DeliveryOptionsType[]> {
    return FetchDeliveryOptions([
        ORM.Where({ userID, active: true }),
    ])
    .then(options => {
        if (options.length !== 0) return options.map(opt => opt.options);
        return [ DeliveryOptionsType.pickup ];
    });
}

function GetDeliveryOptionsBulk(userIDs: number[]): Bluebird<DeliveryOptionsType[][]> {
    return FetchDeliveryOptions([
        ORM.WhereIn('userID', userIDs),
        ORM.Where({ active: true }),
    ])
    .then(options => {
        const groupedOptions = lodash.groupBy(options, opt => opt.userID);
        // if (options.length !== 0) return options.map(opt => opt.options);
        // return [ DeliveryOptionsType.pickup ];
        return userIDs.map(id => {
            const userOptions = groupedOptions[id];

            if (userOptions === undefined) return [DeliveryOptionsType.pickup];
            return userOptions.map(opt => opt.options);
        });
    });
}

export default {
    GetDeliveryOptions,
    GetDeliveryOptionsBulk,
};
