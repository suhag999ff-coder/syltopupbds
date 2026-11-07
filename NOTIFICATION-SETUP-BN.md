# SYL TOPUP BD — Notification Inbox Integration

## Added
- Admin Panel > Notify section to send a title and message to all registered users or a selected user.
- User Panel bell/inbox that displays broadcast and user-targeted messages.
- Notification count badge and read-state tracking in browser local storage.
- Lightweight notification inbox styles.
- Performance adjustments: defer external scripts (ordered execution preserved) and Google Fonts `display=swap` to reduce render blocking.

## Important deployment/security setup
This is an **in-panel notification inbox**, not browser push notification delivery. It uses the existing Firebase Firestore project and the `notifications` collection.

1. Review `firestore-notifications-rules.example.txt`.
2. Merge its notification match block into your existing Firestore rules. Do not replace all current rules with this sample.
3. Give the intended admin Firebase Auth account the custom claim `admin: true` using a trusted Firebase Admin SDK environment. Never set admin claims from the browser.
4. Deploy the merged Firestore rules and upload the updated project.

The notification write action is deliberately admin-only. Without the admin custom claim and matching Firestore rules, the Admin Panel will receive a permission error. Ensure existing rules also protect users, orders, balances, and other collections.

## User experience
- Users must be logged in to see their inbox.
- Broadcast messages use `audience: "all"`.
- Targeted messages use `targetUid` equal to the selected Firebase Auth UID.
- Read markers are local to that browser/device; they are not synced between devices.

## External Push
To send actual OS/browser push notifications while the site is closed, you will need a secured push provider/backend (for example Firebase Cloud Messaging with server-side credentials). Do not put service-account credentials or private provider API keys in `index.html`, `script.js`, or public Firestore documents.
