export function ChangeImageUrl<T extends {image?: string}>(item: T) {
    if (!item.image) return item;

    const fullUrl = item.image;
    const splittedUrl = fullUrl.split('/');

    const fileName = splittedUrl[splittedUrl.length - 1];
    const splittedFileName = fileName.split('.');
    const extension = splittedFileName[splittedFileName.length - 1];

    const prefix = 'https://rulo-katalog.s3.amazonaws.com';
    const subs = ['img512', 'img256', 'img128', 'img64', 'img32'];

    return subs.reduce((accum, sub) => {
        return Object.assign(accum, {
            [sub]: (extension !== 'png') ? `${prefix}/${sub}/${fileName}` : `${prefix}/${fileName}`,
        });
    }, Object.assign(item, {
        image: (extension !== 'png') ? `${prefix}/img256/${fileName}` : `${prefix}/${fileName}`,
        imageFull: item.image,
    }));
}

export function ChangeImageUrlDirectly(prevUrl: string, size: string = 'img64') {
    if (!prevUrl) return prevUrl;

    const splittedUrl = prevUrl.split('/');

    const fileName = splittedUrl[splittedUrl.length - 1];
    const splittedFileName = fileName.split('.');
    const extension = splittedFileName[splittedFileName.length - 1];

    const prefix = 'https://rulo-katalog.s3.amazonaws.com';

    return (extension !== 'png') ? `${prefix}/${size}/${fileName}` : `${prefix}/${fileName}`;
}
