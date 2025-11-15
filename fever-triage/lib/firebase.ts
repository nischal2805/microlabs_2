import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import {
	getFirestore,
	Firestore,
	enableIndexedDbPersistence,
} from "firebase/firestore";

const firebaseConfig = {
	apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
	authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
	projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
	storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
	appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
	app = initializeApp(firebaseConfig);
} else {
	app = getApps()[0];
}

export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence for Firestore
if (typeof window !== "undefined") {
	enableIndexedDbPersistence(db).catch((err) => {
		if (err.code === "failed-precondition") {
			// Multiple tabs open, persistence can only be enabled in one tab at a time
			console.warn("Firestore persistence already enabled in another tab");
		} else if (err.code === "unimplemented") {
			// The current browser does not support all of the features required
			console.warn("Firestore persistence is not supported in this browser");
		} else {
			console.warn("Error enabling Firestore persistence:", err);
		}
	});
}

export default app;
