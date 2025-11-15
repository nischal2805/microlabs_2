"use client";

import {
	createContext,
	useContext,
	useEffect,
	useState,
	ReactNode,
} from "react";
import {
	User,
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
	signInWithPopup,
	signInWithRedirect,
	getRedirectResult,
	GoogleAuthProvider,
	signOut,
	onAuthStateChanged,
	sendPasswordResetEmail,
	updateProfile,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export interface UserProfile {
	name: string;
	email: string;
	createdAt: string;
	updatedAt: string;
}

interface AuthContextType {
	user: User | null;
	userProfile: UserProfile | null;
	loading: boolean;
	signIn: (email: string, password: string) => Promise<void>;
	signUp: (email: string, password: string, name: string) => Promise<void>;
	signInWithGoogle: (useRedirect?: boolean) => Promise<void>;
	logout: () => Promise<void>;
	resetPassword: (email: string) => Promise<void>;
	refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
	const [loading, setLoading] = useState(true);

	// Function to load user profile from Firestore
	const loadUserProfile = async (userId: string) => {
		try {
			const userDocRef = doc(db, "users", userId);
			const userDoc = await getDoc(userDocRef);

			if (userDoc.exists()) {
				const profileData = userDoc.data() as UserProfile;
				setUserProfile(profileData);
			} else {
				setUserProfile(null);
			}
		} catch (error: any) {
			// Handle offline errors gracefully
			if (error.code === "unavailable" || error.message?.includes("offline")) {
				console.warn("Firestore is offline, using cached data if available");
				// Try to get from cache
				try {
					const userDocRef = doc(db, "users", userId);
					const userDoc = await getDoc(userDocRef);
					if (userDoc.exists()) {
						const profileData = userDoc.data() as UserProfile;
						setUserProfile(profileData);
					} else {
						setUserProfile(null);
					}
				} catch (cacheError) {
					console.error("Error loading user profile from cache:", cacheError);
					setUserProfile(null);
				}
			} else {
				console.error("Error loading user profile:", error);
				setUserProfile(null);
			}
		}
	};

	// Function to create or update user profile in Firestore
	const createOrUpdateUserProfile = async (user: User) => {
		try {
			const userDocRef = doc(db, "users", user.uid);
			let existingProfile: UserProfile | null = null;

			try {
				const userDoc = await getDoc(userDocRef);
				if (userDoc.exists()) {
					existingProfile = userDoc.data() as UserProfile;
				}
			} catch (readError: any) {
				// If offline, try to read from cache
				if (
					readError.code === "unavailable" ||
					readError.message?.includes("offline")
				) {
					console.warn("Firestore offline, attempting to read from cache");
					try {
						const userDoc = await getDoc(userDocRef);
						if (userDoc.exists()) {
							existingProfile = userDoc.data() as UserProfile;
						}
					} catch (cacheError) {
						console.warn("Could not read from cache:", cacheError);
					}
				}
			}

			const userProfileData: UserProfile = {
				name: user.displayName || user.email?.split("@")[0] || "User",
				email: user.email || "",
				createdAt: existingProfile?.createdAt || new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			// Try to save, but don't fail if offline (will sync when online)
			try {
				await setDoc(userDocRef, userProfileData, { merge: true });
			} catch (writeError: any) {
				if (
					writeError.code === "unavailable" ||
					writeError.message?.includes("offline")
				) {
					console.warn(
						"Firestore offline, data will sync when connection is restored"
					);
					// Still update local state so UI works
				} else {
					throw writeError; // Re-throw other errors
				}
			}

			setUserProfile(userProfileData);
		} catch (error) {
			console.error("Error creating/updating user profile:", error);
			// Don't throw - allow app to continue even if profile save fails
		}
	};

	useEffect(() => {
		// Set a timeout to ensure loading doesn't hang forever
		const loadingTimeout = setTimeout(() => {
			console.warn("Auth loading timeout - forcing loading to false");
			setLoading(false);
		}, 5000); // 5 second timeout as safety net

		// Check for redirect result (for Google sign-in fallback) - don't block on this
		const checkRedirectResult = async () => {
			try {
				const result = await getRedirectResult(auth);
				if (result && result.user) {
					await createOrUpdateUserProfile(result.user);
				}
			} catch (error) {
				console.error("Error handling redirect result:", error);
			}
		};

		// Don't await - let it run in background
		checkRedirectResult().catch(() => {
			// Ignore errors, don't block loading
		});

		// Listen for auth state changes - this handles session persistence
		const unsubscribe = onAuthStateChanged(auth, async (user) => {
			try {
				setUser(user);
				if (user) {
					// Load user profile when user is logged in
					try {
						await loadUserProfile(user.uid);
					} catch (profileError) {
						console.warn("Error loading profile:", profileError);
					}

					// Check if profile exists, if not create one
					try {
						const userDocRef = doc(db, "users", user.uid);
						const userDoc = await getDoc(userDocRef);

						if (!userDoc.exists() && (user.displayName || user.email)) {
							// Create profile for existing users who don't have one yet
							await createOrUpdateUserProfile(user);
						}
					} catch (error: any) {
						// Handle offline errors - if offline and no profile exists, create one
						if (
							(error.code === "unavailable" ||
								error.message?.includes("offline")) &&
							(user.displayName || user.email)
						) {
							// Try to create profile (will sync when online)
							try {
								await createOrUpdateUserProfile(user);
							} catch (createError) {
								console.warn("Error creating profile:", createError);
							}
						} else {
							console.warn("Error checking user profile:", error);
						}
					}
				} else {
					setUserProfile(null);
				}
			} catch (error) {
				console.error("Error in auth state change handler:", error);
			} finally {
				// Always set loading to false, even if there are errors
				setLoading(false);
			}
		});

		return () => {
			clearTimeout(loadingTimeout);
			unsubscribe();
		};
	}, []);

	const signIn = async (email: string, password: string) => {
		await signInWithEmailAndPassword(auth, email, password);
	};

	const signUp = async (email: string, password: string, name: string) => {
		// Create the user account
		const userCredential = await createUserWithEmailAndPassword(
			auth,
			email,
			password
		);
		const user = userCredential.user;

		// Update the user's display name in Firebase Auth
		await updateProfile(user, {
			displayName: name,
		});

		// Save user profile to Firestore
		const userProfileData: UserProfile = {
			name,
			email,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		const userDocRef = doc(db, "users", user.uid);
		await setDoc(userDocRef, userProfileData);

		// Update local state
		setUserProfile(userProfileData);
	};

	const signInWithGoogle = async (useRedirect = false) => {
		const provider = new GoogleAuthProvider();

		if (useRedirect) {
			// Use redirect method as fallback when popup fails
			await signInWithRedirect(auth, provider);
			// Note: The redirect result will be handled in useEffect
		} else {
			// Try popup first (better UX)
			try {
				const result = await signInWithPopup(auth, provider);
				const user = result.user;
				// Create or update user profile in Firestore
				await createOrUpdateUserProfile(user);
			} catch (error: any) {
				// If popup fails due to storage issues, fall back to redirect
				if (
					error.code === "auth/popup-blocked" ||
					error.message?.includes("sessionStorage") ||
					error.message?.includes("missing initial state")
				) {
					// Retry with redirect
					await signInWithRedirect(auth, provider);
					throw new Error("REDIRECT_REQUIRED"); // Special error to indicate redirect
				}
				throw error; // Re-throw other errors
			}
		}
	};

	const logout = async () => {
		await signOut(auth);
		setUserProfile(null);
	};

	const resetPassword = async (email: string) => {
		await sendPasswordResetEmail(auth, email);
	};

	const refreshUserProfile = async () => {
		if (user) {
			await loadUserProfile(user.uid);
		}
	};

	return (
		<AuthContext.Provider
			value={{
				user,
				userProfile,
				loading,
				signIn,
				signUp,
				signInWithGoogle,
				logout,
				resetPassword,
				refreshUserProfile,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
