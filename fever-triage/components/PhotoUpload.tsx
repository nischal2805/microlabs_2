'use client';

import React, { useState, useRef, useCallback } from 'react';
import { FacialAnalysisResponse, analyzePhoto, APIError } from '@/lib/api';

interface PhotoUploadProps {
  onAnalysisComplete: (analysis: FacialAnalysisResponse) => void;
  onPhotoCapture?: (photo: File) => void;
  disabled?: boolean;
}

export default function PhotoUpload({ onAnalysisComplete, onPhotoCapture, disabled = false }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FacialAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await processPhoto(file);
  }, []);

  const processPhoto = async (file: File) => {
    setError(null);
    setUploading(true);

    try {
      // Validate file
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File too large (max 10MB)');
      }

      // Create preview
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);

      // Notify parent component about the captured photo
      if (onPhotoCapture) {
        onPhotoCapture(file);
      }

      // Analyze photo
      const analysisResult = await analyzePhoto(file);
      setAnalysis(analysisResult);
      onAnalysisComplete(analysisResult);

    } catch (err) {
      if (err instanceof APIError) {
        setError(`Analysis failed: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to analyze photo');
      }
      console.error('Photo analysis error:', err);
    } finally {
      setUploading(false);
    }
  };

  const startCamera = async () => {
    try {
      setError(null);
      setCameraActive(true); // Set camera active immediately to show the UI
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          facingMode: 'user' // Front camera for self-portraits
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to load metadata before playing
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch((playError) => {
              console.warn('Video play failed:', playError);
              // Still keep camera active even if autoplay fails
            });
          }
        };

        // Also try to play immediately
        videoRef.current.play().catch((playError) => {
          console.warn('Immediate video play failed:', playError);
        });
      }
    } catch (err) {
      setCameraActive(false); // Turn off camera active state on error
      setError('Could not access camera. Please use file upload instead or allow camera permissions.');
      console.error('Camera error:', err);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob and process
    canvas.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
        await processPhoto(file);
      }
    }, 'image/jpeg', 0.8);

    // Stop camera
    stopCamera();
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const clearPhoto = () => {
    setPreview(null);
    setAnalysis(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          📸 Facial Analysis (Optional)
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Upload or take a photo for AI-powered fatigue and fever indicator analysis
        </p>
      </div>

      {/* Upload Options */}
      {!preview && !cameraActive && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* File Upload */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={disabled || uploading}
              className="hidden"
              id="photo-upload"
            />
            <label
              htmlFor="photo-upload"
              className={`
                w-full py-3 px-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all
                ${disabled || uploading
                  ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'border-blue-300 bg-blue-50 text-blue-600 hover:border-blue-400 hover:bg-blue-100'
                }
              `}
            >
              <div className="flex flex-col items-center space-y-2">
                <span className="text-2xl">📁</span>
                <span className="text-sm font-medium">
                  {uploading ? 'Analyzing...' : 'Upload Photo'}
                </span>
              </div>
            </label>
          </div>

          {/* Camera Capture */}
          <button
            type="button"
            onClick={startCamera}
            disabled={disabled || uploading}
            className={`
              w-full py-3 px-4 border-2 border-dashed rounded-lg transition-all
              ${disabled || uploading
                ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'border-green-300 bg-green-50 text-green-600 hover:border-green-400 hover:bg-green-100'
              }
            `}
          >
            <div className="flex flex-col items-center space-y-2">
              <span className="text-2xl">📷</span>
              <span className="text-sm font-medium">Take Photo</span>
            </div>
          </button>
        </div>
      )}

      {/* Enhanced Camera View */}
      {cameraActive && (
        <div className="bg-gray-900 rounded-xl p-6 space-y-4">
          <div className="text-center">
            <h4 className="text-white font-semibold mb-2">📷 Camera Active</h4>
            <p className="text-gray-300 text-sm">Position your face clearly in the frame</p>
          </div>
          
          <div className="relative mx-auto max-w-lg">
            {/* Video with professional styling */}
            <div className="relative rounded-2xl overflow-hidden bg-black shadow-2xl border-4 border-gray-700">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-auto"
                style={{ 
                  minHeight: '320px',
                  maxHeight: '480px',
                  backgroundColor: 'black',
                  transform: 'scaleX(-1)' // Mirror for selfie mode
                }}
              />
              
              {/* Face detection overlay */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Corner guides for face positioning */}
                <div className="absolute top-1/4 left-1/4 right-1/4 bottom-1/4 border-2 border-green-400 border-dashed rounded-full opacity-50"></div>
                
                {/* Top instruction overlay */}
                <div className="absolute top-4 left-4 right-4 bg-black bg-opacity-70 text-white text-sm p-3 rounded-lg text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    <span>Keep your face in the circle • Ensure good lighting</span>
                  </div>
                </div>

                {/* Bottom tips */}
                <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-70 text-white text-xs p-2 rounded text-center">
                  💡 Tips: Remove glasses, look straight, avoid shadows
                </div>
              </div>
            </div>
          </div>

          {/* Camera Controls */}
          <div className="flex justify-center items-center space-x-6">
            <button
              type="button"
              onClick={stopCamera}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full font-medium transition-all duration-200 shadow-lg flex items-center space-x-2"
            >
              <span>❌</span>
              <span>Cancel</span>
            </button>

            {/* Large capture button */}
            <button
              type="button"
              onClick={capturePhoto}
              disabled={uploading}
              className={`
                bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-bold text-lg 
                transition-all duration-200 shadow-2xl transform hover:scale-105 disabled:opacity-50 
                disabled:cursor-not-allowed flex items-center space-x-3
                ${uploading ? 'animate-pulse' : ''}
              `}
            >
              <span className="text-2xl">📸</span>
              <span>{uploading ? 'Processing...' : 'Capture'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                // Toggle camera (for switching front/back camera in future)
                console.log('Camera settings');
              }}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-full font-medium transition-all duration-200 shadow-lg flex items-center space-x-2"
            >
              <span>⚙️</span>
              <span>Settings</span>
            </button>
          </div>

          {/* Status indicators */}
          <div className="text-center space-y-2">
            <div className="flex justify-center items-center space-x-4 text-sm">
              <div className="flex items-center space-x-1 text-green-400">
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                <span>Camera Active</span>
              </div>
              <div className="flex items-center space-x-1 text-blue-400">
                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                <span>AI Ready</span>
              </div>
            </div>
            <p className="text-gray-400 text-xs">
              The AI will analyze your facial appearance for fatigue and fever indicators
            </p>
          </div>
        </div>
      )}

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Loading State */}
      {uploading && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Analyzing facial indicators...</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Enhanced Preview and Analysis Results */}
      {preview && analysis && (
        <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl p-6 space-y-6 border border-green-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🎯</span>
              <h4 className="font-bold text-gray-800 text-lg">AI Analysis Complete</h4>
            </div>
            <button
              type="button"
              onClick={clearPhoto}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full text-sm transition-colors duration-200"
            >
              ✕ Clear
            </button>
          </div>

          {/* Enhanced Photo Preview */}
          <div className="text-center">
            <div className="relative inline-block">
              <img
                src={preview}
                alt="Analyzed photo"
                className="max-w-64 max-h-64 mx-auto rounded-2xl shadow-2xl border-4 border-white"
              />
              <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-2 shadow-lg">
                <span className="text-sm font-bold">✓</span>
              </div>
            </div>
          </div>

          {/* Enhanced Analysis Results */}
          <div className="space-y-6">
            {/* Confidence Score with visual indicator */}
            <div className="bg-white rounded-lg p-4 shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-700 flex items-center space-x-1">
                  <span>🎯</span>
                  <span>AI Confidence:</span>
                </span>
                <span className="text-lg font-bold text-blue-600">
                  {Math.round(analysis.confidence_score * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round(analysis.confidence_score * 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Fatigue Indicators */}
            {analysis.fatigue_indicators.length > 0 && (
              <div className="bg-white rounded-lg p-4 shadow-md">
                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-lg">😴</span>
                  <span className="text-sm font-bold text-gray-700">Fatigue Indicators:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {analysis.fatigue_indicators.map((indicator: string, index: number) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 bg-yellow-50 border border-yellow-200 rounded-lg p-2"
                    >
                      <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                      <span className="text-sm text-yellow-800 font-medium">{indicator}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fever Indicators */}
            {analysis.fever_indicators.length > 0 && (
              <div className="bg-white rounded-lg p-4 shadow-md">
                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-lg">🌡️</span>
                  <span className="text-sm font-bold text-gray-700">Fever Indicators:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {analysis.fever_indicators.map((indicator: string, index: number) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 bg-red-50 border border-red-200 rounded-lg p-2"
                    >
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      <span className="text-sm text-red-800 font-medium">{indicator}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Overall Health Appearance */}
            <div className="bg-white rounded-lg p-4 shadow-md">
              <div className="flex items-center space-x-2 mb-3">
                <span className="text-lg">👁️</span>
                <span className="text-sm font-bold text-gray-700">Overall Assessment:</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border-l-4 border-blue-500">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {analysis.overall_health_appearance}
                </p>
              </div>
            </div>

            {/* AI Recommendations */}
            {analysis.recommendations.length > 0 && (
              <div className="bg-white rounded-lg p-4 shadow-md">
                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-lg">💡</span>
                  <span className="text-sm font-bold text-gray-700">AI Recommendations:</span>
                </div>
                <div className="space-y-3">
                  {analysis.recommendations.map((rec: string, index: number) => (
                    <div key={index} className="flex items-start space-x-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mt-0.5">
                        {index + 1}
                      </div>
                      <p className="text-sm text-blue-800 leading-relaxed flex-1">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Enhanced Instructions */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2 text-blue-600">
            <span>ℹ️</span>
            <span className="font-semibold text-sm">Photo Analysis Guidelines</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
            <div className="flex items-center space-x-2">
              <span>💡</span>
              <span>Good lighting recommended</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>👁️</span>
              <span>Clear face view, front-facing</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>🚫</span>
              <span>Remove glasses/obstructions</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>🔒</span>
              <span>Secure processing, not stored</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
