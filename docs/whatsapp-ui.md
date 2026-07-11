# Realtime WhatsApp-style UI

The alternate interface lives at `/whatsapp`. The existing `/` experience,
research APIs, and checkout APIs are unchanged.

## Firebase setup

1. Create or select a Firebase web app and enable Cloud Firestore.
2. Enable **Authentication → Sign-in method → Anonymous**. The current UI
   uses an anonymous, browser-persisted identity so chat documents are not
   publicly readable.
3. Deploy the repository's `firestore.rules` to the project.
4. Add the six `NEXT_PUBLIC_FIREBASE_*` values documented in `.env.example`,
   then restart/rebuild Next.js.

Without those variables, `/whatsapp` deliberately runs as a local preview
and keeps the session in `localStorage`. The header always states whether it
is `Firebase live`, `Syncing`, `Local preview`, or unavailable.

## Data model

Each conversation is one `purchaseChats/{chatId}` document. A snapshot holds
the lightweight elicitation state, research mode, run ID, and recent progress
labels. Recommendation payloads remain in the existing research backend and
are fetched through `/api/research/{runId}/result`; this avoids duplicating
large evidence graphs in Firestore documents.

The `chat` query parameter is stable for the browser session. Firestore rules
restrict a document to its authenticated owner. A future signed-in Firebase
identity can replace anonymous auth without changing the snapshot schema.
