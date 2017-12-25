import * as Bluebird from 'bluebird';

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

export default {
    GetDeliveryOptions,
};
