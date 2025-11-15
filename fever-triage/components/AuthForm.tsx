"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthForm() {
	const [isLogin, setIsLogin] = useState(true);
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [googleLoading, setGoogleLoading] = useState(false);
	const [successMessage, setSuccessMessage] = useState("");
	const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setSuccessMessage("");
		setLoading(true);

		try {
			if (isLogin) {
				await signIn(email, password);
			} else {
				if (!name.trim()) {
					setError("Please enter your name");
					setLoading(false);
					return;
				}
				await signUp(email, password, name.trim());
				setSuccessMessage("Account created successfully! Redirecting...");
			}
		} catch (err: any) {
			// Handle Firebase auth errors
			let errorMessage = "Authentication failed";
			if (err.code === "auth/user-not-found") {
				errorMessage = "No account found with this email";
			} else if (err.code === "auth/wrong-password") {
				errorMessage = "Incorrect password";
			} else if (err.code === "auth/email-already-in-use") {
				errorMessage = "An account with this email already exists";
			} else if (err.code === "auth/weak-password") {
				errorMessage = "Password should be at least 6 characters";
			} else if (err.code === "auth/invalid-email") {
				errorMessage = "Invalid email address";
			} else if (err.message) {
				errorMessage = err.message;
			}
			setError(errorMessage);
		} finally {
			setLoading(false);
		}
	};

	const handleGoogleSignIn = async () => {
		setError("");
		setSuccessMessage("");
		setGoogleLoading(true);
		try {
			await signInWithGoogle();
		} catch (err: any) {
			// Don't show error if redirect is required (user will be redirected)
			if (err.message === "REDIRECT_REQUIRED") {
				// User will be redirected, just wait
				return;
			}

			let errorMessage = "Google sign-in failed";
			if (err.code === "auth/popup-closed-by-user") {
				errorMessage = "Sign-in popup was closed";
			} else if (err.code === "auth/popup-blocked") {
				errorMessage = "Popup was blocked. Redirecting to Google sign-in...";
				// Try redirect as fallback
				try {
					await signInWithGoogle(true);
					return; // Redirect will happen, don't show error
				} catch (redirectErr) {
					errorMessage = "Please allow popups or try again.";
				}
			} else if (err.code === "auth/account-exists-with-different-credential") {
				errorMessage =
					"An account already exists with this email. Please sign in with email/password.";
			} else if (
				err.message?.includes("sessionStorage") ||
				err.message?.includes("missing initial state")
			) {
				errorMessage =
					"Browser storage issue detected. Trying redirect method...";
				// Try redirect as fallback
				try {
					await signInWithGoogle(true);
					return; // Redirect will happen
				} catch (redirectErr) {
					errorMessage =
						"Please enable cookies and try again, or use email/password sign-in.";
				}
			} else if (err.message) {
				errorMessage = err.message;
			}
			setError(errorMessage);
		} finally {
			setGoogleLoading(false);
		}
	};

	const handleResetPassword = async () => {
		if (!email) {
			setError("Please enter your email first");
			return;
		}
		setError("");
		setSuccessMessage("");
		setLoading(true);
		try {
			await resetPassword(email);
			setSuccessMessage("Password reset email sent! Check your inbox.");
		} catch (err: any) {
			let errorMessage = "Failed to send reset email";
			if (err.code === "auth/user-not-found") {
				errorMessage = "No account found with this email";
			} else if (err.message) {
				errorMessage = err.message;
			}
			setError(errorMessage);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-md w-full space-y-8">
				{/* Header */}
				<div className="text-center">
					<h1 className="text-4xl font-bold text-blue-900 mb-2">
						AI Fever Triage System
					</h1>
					<p className="text-lg text-blue-700">
						Intelligent clinical decision support powered by AI
					</p>
				</div>

				{/* Auth Form Card */}
				<div className="bg-white rounded-lg shadow-xl p-8">
					<h2 className="text-2xl font-bold text-center mb-6 text-gray-900">
						{isLogin ? "Sign In" : "Create Account"}
					</h2>

					{error && (
						<div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md mb-4">
							<p className="text-sm text-red-700">{error}</p>
						</div>
					)}

					{successMessage && (
						<div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-md mb-4">
							<p className="text-sm text-green-700">{successMessage}</p>
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-6">
						{!isLogin && (
							<div>
								<label
									htmlFor="name"
									className="block text-sm font-medium text-gray-700 mb-2"
								>
									Full Name
								</label>
								<input
									id="name"
									type="text"
									value={name}
									onChange={(e) => setName(e.target.value)}
									required={!isLogin}
									className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
									placeholder="John Doe"
									disabled={loading}
								/>
							</div>
						)}
						<div>
							<label
								htmlFor="email"
								className="block text-sm font-medium text-gray-700 mb-2"
							>
								Email Address
							</label>
							<input
								id="email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
								placeholder="your@email.com"
								disabled={loading}
							/>
						</div>

						<div>
							<label
								htmlFor="password"
								className="block text-sm font-medium text-gray-700 mb-2"
							>
								Password
							</label>
							<input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								minLength={6}
								className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
								placeholder="••••••••"
								disabled={loading}
							/>
							{!isLogin && (
								<p className="mt-1 text-xs text-gray-500">
									Password must be at least 6 characters
								</p>
							)}
						</div>

						<button
							type="submit"
							disabled={loading}
							className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
						>
							{loading ? (
								<span className="flex items-center justify-center">
									<svg
										className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
									>
										<circle
											className="opacity-25"
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											strokeWidth="4"
										></circle>
										<path
											className="opacity-75"
											fill="currentColor"
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
										></path>
									</svg>
									Processing...
								</span>
							) : isLogin ? (
								"Sign In"
							) : (
								"Create Account"
							)}
						</button>
					</form>

					{/* Divider */}
					<div className="relative my-6">
						<div className="absolute inset-0 flex items-center">
							<div className="w-full border-t border-gray-300"></div>
						</div>
						<div className="relative flex justify-center text-sm">
							<span className="px-2 bg-white text-gray-500">OR</span>
						</div>
					</div>

					{/* Google Sign In Button */}
					<button
						type="button"
						onClick={handleGoogleSignIn}
						disabled={loading || googleLoading}
						className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-md font-medium hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
					>
						{googleLoading ? (
							<svg
								className="animate-spin h-5 w-5 text-gray-600"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
							>
								<circle
									className="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									strokeWidth="4"
								></circle>
								<path
									className="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
						) : (
							<>
								<svg
									className="w-5 h-5"
									viewBox="0 0 24 24"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										fill="#4285F4"
										d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
									/>
									<path
										fill="#34A853"
										d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
									/>
									<path
										fill="#FBBC05"
										d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
									/>
									<path
										fill="#EA4335"
										d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
									/>
								</svg>
								<span>Continue with Google</span>
							</>
						)}
					</button>

					<div className="mt-6 space-y-3">
						<div className="text-center">
							<button
								type="button"
								onClick={() => {
									setIsLogin(!isLogin);
									setError("");
									setSuccessMessage("");
									setName(""); // Clear name when switching
								}}
								className="text-sm text-blue-600 hover:text-blue-800 font-medium"
								disabled={loading}
							>
								{isLogin
									? "Don't have an account? Sign up"
									: "Already have an account? Sign in"}
							</button>
						</div>

						{isLogin && (
							<div className="text-center">
								<button
									onClick={handleResetPassword}
									className="text-sm text-gray-600 hover:text-gray-800"
									disabled={loading}
								>
									Forgot your password?
								</button>
							</div>
						)}
					</div>
				</div>

				{/* Medical Disclaimer */}
				<div className="bg-gray-50 border-l-4 border-gray-400 p-4 rounded-lg">
					<p className="text-xs text-gray-600 text-center">
						<strong>Medical Disclaimer:</strong> This system is for educational
						and demonstration purposes only. Always consult healthcare
						professionals for medical advice.
					</p>
				</div>
			</div>
		</div>
	);
}
