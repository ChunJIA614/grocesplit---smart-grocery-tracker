const admin = require('firebase-admin');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');

admin.initializeApp();

const firestore = admin.firestore();
const messaging = admin.messaging();

exports.sendSplitPaymentPush = onDocumentCreated('paymentHistory/{entryId}', async (event) => {
  const entry = event.data && event.data.data();

  if (!entry || entry.type !== 'BILL_CREATED') {
    return;
  }

  const pushTokensSnapshot = await firestore.collection('pushTokens').get();
  if (pushTokensSnapshot.empty) {
    console.log('No push tokens registered.');
    return;
  }

  const tokens = pushTokensSnapshot.docs
    .map((doc) => doc.data().token)
    .filter(Boolean);

  if (tokens.length === 0) {
    console.log('No valid push tokens found.');
    return;
  }

  const title = `New split payment: ${entry.itemName}`;
  const body = `Latest bill $${Number(entry.latestBillAmount || entry.amount || 0).toFixed(2)} | Total overdue $${Number(entry.totalOutstanding || 0).toFixed(2)}`;

  const responses = await Promise.allSettled(
    tokens.map((token) =>
      messaging.send({
        token,
        notification: {
          title,
          body,
        },
        data: {
          title,
          body,
          url: '/',
          entryId: entry.id,
          itemId: entry.itemId,
        },
      })
    )
  );

  const invalidTokens = [];
  responses.forEach((result, index) => {
    if (result.status === 'rejected') {
      const errorMessage = String(result.reason && result.reason.message ? result.reason.message : result.reason);
      console.warn(`Failed to send push to token ${tokens[index]}:`, errorMessage);
      if (errorMessage.includes('registration-token-not-registered') || errorMessage.includes('invalid-registration-token')) {
        invalidTokens.push(tokens[index]);
      }
    }
  });

  await Promise.all(
    invalidTokens.map((token) => firestore.collection('pushTokens').doc(token).delete())
  );
});