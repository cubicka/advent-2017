import * as admin from 'firebase-admin';

import * as serviceAccount from '../setara-firebase.json';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://setara-d95e9.firebaseio.com/',
});

export default function SendNotif(registrationToken: string, payload: any) {
    if (!registrationToken) return Promise.resolve();

    return admin.messaging().sendToDevice(registrationToken, payload);
    // .then(() => '')
    // .catch((error: any) => (''));
}
