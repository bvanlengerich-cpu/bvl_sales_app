import webPush from 'web-push';

const { publicKey, privateKey } = webPush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('Store these values only in your local .env and later in Coolify secrets.');
