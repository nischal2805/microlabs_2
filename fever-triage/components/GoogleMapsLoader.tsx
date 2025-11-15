"use client";

import { useState, useEffect } from "react";
import { GOOGLE_MAPS_CONFIG } from "../lib/googleMaps";

interface GoogleMapsLoaderProps {
	children: (loaded: boolean) => React.ReactNode;
}

export default function GoogleMapsLoader({ children }: GoogleMapsLoaderProps) {
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!GOOGLE_MAPS_CONFIG.apiKey) {
			setError(
				"Google Maps API key is missing. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your environment variables."
			);
			return;
		}

		// Check if Google Maps is already loaded
		if (window.google && window.google.maps) {
			setLoaded(true);
			return;
		}

		// Load Google Maps script
		const script = document.createElement("script");
		script.async = true;
		script.defer = true;

		window.initGoogleMaps = () => {
			// Verify maps loaded with a small delay
			setTimeout(() => {
				if (window.google && window.google.maps) {
					setLoaded(true);
					setError(null);
				}
			}, 100);
		};

		script.src = `https://maps.googleapis.com/maps/api/js?key=${
			GOOGLE_MAPS_CONFIG.apiKey
		}&libraries=${GOOGLE_MAPS_CONFIG.libraries.join(
			","
		)}&callback=initGoogleMaps`;

		script.onerror = () => {
			setError(
				"Failed to load Google Maps. Please check your API key and network connection."
			);
			console.error("Google Maps script loading failed");
		};

		// Handle timeout - allow app to continue without maps after 8 seconds
		const timeoutId = setTimeout(() => {
			if (!loaded) {
				setError(null);
				setLoaded(false); // Don't show error, just continue without maps
				console.warn(
					"Google Maps took too long to load, app will continue without map features"
				);
			}
		}, 8000);

		document.head.appendChild(script);

		return () => {
			clearTimeout(timeoutId);
			delete window.initGoogleMaps;
			if (script.parentNode) {
				script.parentNode.removeChild(script);
			}
		};
	}, [loaded]);

	if (error) {
		return (
			<div className="max-w-4xl mx-auto p-6">
				<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
					<div className="text-yellow-800">
						<p className="font-semibold">Note: Maps feature unavailable</p>
						<p className="text-sm mt-1">{error}</p>
						<p className="text-sm mt-2">
							The app will continue to work without map features.
						</p>
					</div>
				</div>
				<div className="text-center">{children(false)}</div>
			</div>
		);
	}

	return <>{children(loaded)}</>;
}

// Add global type declaration
declare global {
	interface Window {
		initGoogleMaps?: () => void;
		google: any;
	}
}
