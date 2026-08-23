const admin = require('firebase-admin');
const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');

admin.initializeApp();

const firestore = admin.firestore();
const messaging = admin.messaging();

const INVALID_TOKEN_ERRORS = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

const getPushTokens = async (recipientIds) => {
  const snapshot = await firestore.collection('pushTokens').get();
  const recipients = recipientIds && new Set(recipientIds);
  return snapshot.docs
    .filter((doc) => !recipients || recipients.has(doc.data().userId))
    .map((doc) => doc.data().token)
    .filter(Boolean);
};

const normalizeRecipientIds = (ids) => [...new Set(
  (Array.isArray(ids) ? ids : []).filter((id) => typeof id === 'string' && id.length > 0)
)];

const haveSameRecipients = (left, right) => {
  const leftIds = normalizeRecipientIds(left).sort();
  const rightIds = normalizeRecipientIds(right).sort();
  return leftIds.length === rightIds.length && leftIds.every((id, index) => id === rightIds[index]);
};

const sendPush = async ({ title, body, url = '/', data = {}, recipientIds }) => {
  if (recipientIds && recipientIds.length === 0) {
    console.log('No notification recipients assigned.');
    return;
  }

  const tokens = [...new Set(await getPushTokens(recipientIds))];
  if (tokens.length === 0) {
    console.log('No push tokens registered.');
    return;
  }

  const invalidTokens = [];

  // FCM multicast requests accept at most 500 registration tokens.
  for (let index = 0; index < tokens.length; index += 500) {
    const chunk = tokens.slice(index, index + 500);
    const response = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: {
        title,
        body,
      },
      data: {
        title,
        body,
        url,
        ...Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])),
      },
    });

    response.responses.forEach((result, responseIndex) => {
      const code = result.error && result.error.code;
      if (code && INVALID_TOKEN_ERRORS.has(code)) {
        invalidTokens.push(chunk[responseIndex]);
      } else if (!result.success) {
        console.warn('Push notification delivery failed:', code || 'unknown error');
      }
    });
  }

  await Promise.all(
    invalidTokens.map((token) => firestore.collection('pushTokens').doc(token).delete())
  );
};

exports.sendSplitPaymentPush = onDocumentWritten('items/{itemId}', async (event) => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const item = event.data.after.exists ? event.data.after.data() : null;

  if (!item || item.status !== 'USED') {
    return;
  }

  const recipientIds = normalizeRecipientIds(item.sharedBy);
  const becameUsed = !before || before.status !== 'USED';
  const assignmentChanged = before && !haveSameRecipients(before.sharedBy, item.sharedBy);

  if (recipientIds.length === 0 || (!becameUsed && !assignmentChanged)) {
    return;
  }

  const amount = Number(item.totalPrice || 0);
  const share = amount / recipientIds.length;

  await sendPush({
    title: `New grocery bill: ${item.name || 'Shared grocery'}`,
    body: `Your share is $${share.toFixed(2)} from a $${amount.toFixed(2)} grocery bill.`,
    data: {
      kind: 'grocery-bill',
      itemId: item.id || event.params.itemId,
    },
    recipientIds,
  });
});

if (require.main === module) {
  const assert = require('node:assert/strict');
  assert.equal(haveSameRecipients(['u1', 'u2'], ['u2', 'u1']), true);
  assert.equal(haveSameRecipients(['u1'], ['u1', 'u2']), false);
}

exports.sendRentalExpensePush = onDocumentCreated('rentalExpenses/{expenseId}', async (event) => {
  const expense = event.data && event.data.data();

  if (!expense) {
    return;
  }

  await sendPush({
    title: `New shared bill: ${expense.title || 'Rental or utility bill'}`,
    body: `Shared bill added for $${Number(expense.amount || 0).toFixed(2)}.`,
    data: {
      kind: 'rental-expense',
      expenseId: expense.id || event.params.expenseId,
    },
    // Missing recipient data must not fall back to a household-wide payment alert.
    recipientIds: Array.isArray(expense.splitWithIds) ? expense.splitWithIds : [],
  });
});

exports.sendAppUpdatePush = onDocumentCreated('appUpdates/{updateId}', async (event) => {
  const update = event.data && event.data.data();

  if (!update) {
    return;
  }

  await sendPush({
    title: update.title || 'DormMate updated',
    body: update.body || 'A new version of DormMate is available.',
    url: update.url || '/',
    data: {
      kind: 'app-update',
      updateId: update.id || event.params.updateId,
      version: update.version || '',
    },
  });
});
