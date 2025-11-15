'use client';

import { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';

interface PhotoUploadProps {
  onPhotoUploaded: (photoUrl: string, photoData: string) => void;
  currentPhoto?: string;
}

export default function PhotoUpload({ onPhotoUploaded, currentPhoto }: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentPhoto || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload to Firebase Storage (if user is authenticated)
      if (user) {
        const storageRef = ref(storage, `patient-photos/${user.uid}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);
        
        // Get base64 for AI analysis
        const base64 = await fileToBase64(file);
        onPhotoUploaded(downloadURL, base64);
      } else {
        // If not authenticated, just use base64
        const base64 = await fileToBase64(file);
        onPhotoUploaded('', base64);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Extract base64 part (remove data:image/jpeg;base64, prefix)
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleRemove = () => {
    setPreview(null);
    setError(null);
    onPhotoUploaded('', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt="Patient photo"
              className="max-w-full max-h-64 mx-auto rounded-lg"
            />
            <button
              onClick={handleRemove}
              className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
              disabled={uploading}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              <Camera className="w-16 h-16 text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-700">Upload Patient Photo</h3>
              <p className="text-sm text-gray-500 mt-1">
                Optional: Upload a photo for visual analysis (e.g., rash, skin condition)
              </p>
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    Choose Photo
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Accepted formats: JPG, PNG, GIF (Max 5MB)
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
