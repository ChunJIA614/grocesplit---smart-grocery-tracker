const admin = require('firebase-admin');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');

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

const getGroceryRecipientIds = async (entry) => {
  const directRecipients = Array.isArray(entry.recipientIds)
    ? entry.recipientIds.filter((id) => typeof id === 'string' && id.length > 0)
    : [];

  if (directRecipients.length > 0) {
    return [...new Set(directRecipients)];
  }

  const itemId = typeof entry.itemId === 'string' ? entry.itemId : '';
  if (!itemId) return [];

  const itemSnapshot = await firestore.collection('items').doc(itemId).get();
  const item = itemSnapshot.exists ? itemSnapshot.data() : null;
  const sharedBy = item && Array.isArray(item.sharedBy) ? item.sharedBy : [];
  return [...new Set(sharedBy.filter((id) => typeof id === 'string' && id.length > 0))];
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

exports.sendSplitPaymentPush = onDocumentCreated('paymentHistory/{entryId}', async (event) => {
  const entry = event.data && event.data.data();

  if (!entry || entry.type !== 'BILL_CREATED') {
    return;
  }

  const recipientIds = await getGroceryRecipientIds(entry);

  await sendPush({
    title: `New grocery bill: ${entry.itemName || 'Shared grocery'}`,
    body: `Latest bill $${Number(entry.latestBillAmount || entry.amount || 0).toFixed(2)} | Total overdue $${Number(entry.totalOutstanding || 0).toFixed(2)}`,
    data: {
      kind: 'grocery-bill',
      entryId: entry.id || event.params.entryId,
      itemId: entry.itemId || '',
    },
    recipientIds,
  });
});

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
