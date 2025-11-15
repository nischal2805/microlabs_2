'use client';

import React, { useState, useRef, useCallback } from 'react';
import { FacialAnalysisResponse, analyzePhoto, APIError } from '@/lib/api.ts';

interface PhotoUploadProps {
  onAnalysisComplete: (analysis: FacialAnalysisResponse) => void;
  disabled?: boolean;
}

export default function PhotoUpload({ onAnalysisComplete, disabled = false }: PhotoUploadProps) {
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
      console.log('Starting camera...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          facingMode: 'user' // Front camera for self-portraits
        } 
      });
      
      console.log('Camera stream obtained');
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to load metadata before setting camera active
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded');
          if (videoRef.current) {
            videoRef.current.play().then(() => {
              console.log('Video playing, setting camera active');
              setCameraActive(true);
            }).catch(err => {
              console.error('Video play error:', err);
              setError('Could not start video playback');
            });
          }
        };

        // Handle any video errors
        videoRef.current.onerror = (err) => {
          console.error('Video error:', err);
          setError('Video playback error occurred');
        };
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      let errorMessage = 'Could not access camera. ';
      
      if (err.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera permissions and try again.';
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'No camera found on this device.';
      } else if (err.name === 'NotSupportedError') {
        errorMessage += 'Camera not supported by this browser.';
      } else {
        errorMessage += 'Please use file upload instead.';
      }
      
      setError(errorMessage);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      setError('Camera not ready for capture');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      setError('Could not get canvas context');
      return;
    }

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas (flip horizontally for selfie mode)
    context.scale(-1, 1);
    context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    context.scale(-1, 1); // Reset scale

    // Convert to blob and process
    canvas.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
        await processPhoto(file);
      } else {
        setError('Failed to capture photo');
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
                w-full py-3 px-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all block
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

      {/* Camera View */}
      {cameraActive && (
        <div className="text-center space-y-4">
          <div className="relative inline-block rounded-lg overflow-hidden bg-black shadow-lg">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full max-w-md h-auto rounded-lg"
              style={{ 
                minHeight: '240px',
                backgroundColor: 'black',
                transform: 'scaleX(-1)' // Mirror the video for selfie mode
              }}
            />
            {/* Camera overlay instructions */}
            <div className="absolute top-2 left-2 right-2 bg-black bg-opacity-50 text-white text-xs p-2 rounded">
              Position your face in the frame • Good lighting recommended
            </div>
          </div>
          <div className="flex justify-center space-x-4">
            <button
              type="button"
              onClick={capturePhoto}
              disabled={uploading}
              className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg"
            >
              📸 Capture Photo
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="bg-gray-600 text-white px-6 py-3 rounded-md font-medium hover:bg-gray-700 transition-colors shadow-lg"
            >
              ❌ Cancel
            </button>
          </div>
          <p className="text-sm text-gray-600">
            Make sure your face is well-lit and clearly visible before capturing
          </p>
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
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs text-red-500 hover:text-red-700 mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Preview and Analysis Results */}
      {preview && analysis && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-semibold text-gray-800">Analysis Results</h4>
            <button
              type="button"
              onClick={clearPhoto}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ✕ Clear
            </button>
          </div>

          {/* Photo Preview */}
          <div className="text-center">
            <img
              src={preview}
              alt="Uploaded photo"
              className="max-w-48 max-h-48 mx-auto rounded-lg shadow-md"
            />
          </div>

          {/* Analysis Results */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Confidence:</span>
              <span className="text-sm font-semibold">
                {Math.round(analysis.confidence_score * 100)}%
              </span>
            </div>

            {analysis.fatigue_indicators.length > 0 && (
              <div>
                <span className="text-sm font-medium text-gray-600 block mb-1">
                  Fatigue Indicators:
                </span>
                <div className="flex flex-wrap gap-1">
                  {analysis.fatigue_indicators.map((indicator, index) => (
                    <span
                      key={index}
                      className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full"
                    >
                      {indicator}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {analysis.fever_indicators.length > 0 && (
              <div>
                <span className="text-sm font-medium text-gray-600 block mb-1">
                  Fever Indicators:
                </span>
                <div className="flex flex-wrap gap-1">
                  {analysis.fever_indicators.map((indicator, index) => (
                    <span
                      key={index}
                      className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded-full"
                    >
                      {indicator}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <span className="text-sm font-medium text-gray-600 block mb-1">
                Overall Appearance:
              </span>
              <p className="text-sm text-gray-700">
                {analysis.overall_health_appearance}
              </p>
            </div>

            {analysis.recommendations.length > 0 && (
              <div>
                <span className="text-sm font-medium text-gray-600 block mb-1">
                  Recommendations:
                </span>
                <ul className="text-sm text-gray-700 space-y-1">
                  {analysis.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-blue-500 mr-1">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="text-xs text-gray-500 text-center">
        <p>For best results: Good lighting, clear face view, no obstructions</p>
        <p>Your photo is processed securely and not stored</p>
      </div>
    </div>
  );
}
