import * as Bluebird from 'bluebird';
import * as Nexmo from 'nexmo';

import * as config from '../config.json';

const nexmoApp = new Nexmo({
    apiKey: config.nexmo.apiKey,
    apiSecret: config.nexmo.apiSecret,
});

export default function SMS(phoneNumber: string, message: string) {
    return Bluebird.try(() => {
        nexmoApp.message.sendSms('Rulo', `+62${phoneNumber}`, message);
        return { status: 'sms delivered' };
    });
}
