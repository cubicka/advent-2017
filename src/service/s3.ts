import AWS from 'aws-sdk';
import bluebird from 'bluebird';

import * as config from '../config.json';

AWS.config.update({
    accessKeyId: config.aws.accessKeyID,
    secretAccessKey: config.aws.secretAccessKey,
    region: config.aws.s3.region,
});

const s3 = new AWS.S3({
    apiVersion: config.aws.s3.apiVersion,
    region: config.aws.s3.region,
    s3BucketEndpoint: true,
    endpoint: 'https://rulo-katalog.s3.amazonaws.com',
});

const s3Async: any = bluebird.promisifyAll(s3);

export default function Upload(data: any, fileName: any, fileMime: any) {
    const s3Params = {
        Bucket: config.aws.s3.bucket,
        Key: fileName,
        Body: data,
        ACL: 'public-read',
        ContentType: fileMime,
    };

    return s3Async.uploadAsync(s3Params);
}
