const admin = require('firebase-admin');

admin.initializeApp();

const version = process.env.APP_VERSION || new Date().toISOString();
const title = process.env.APP_UPDATE_TITLE || 'DormMate updated';
const body = process.env.APP_UPDATE_BODY || 'A new version of DormMate is available.';

admin.firestore().collection('appUpdates').add({
  id: version,
  version,
  title,
  body,
  url: '/',
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
}).then((reference) => {
  console.log(`Published app update event ${reference.id}.`);
}).catch((error) => {
  console.error('Unable to publish app update event:', error.message);
  process.exitCode = 1;
});
