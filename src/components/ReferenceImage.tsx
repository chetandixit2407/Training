import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { Language } from '../types';
import { CloudPhotoService } from '../services/cloudPhotoService';

interface ReferenceImageProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  language?: Language;
  compact?: boolean;
}

export const ReferenceImage: React.FC<ReferenceImageProps> = ({
  src,
  alt,
  className = '',
  onClick,
  language = 'en',
  compact = false,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [resolvedCloudSrc, setResolvedCloudSrc] = useState<string>('');
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const isCloudAsset = Boolean(src && src.startsWith('cloud-asset://'));

  useEffect(() => {
    setFallbackSrc(null);
  }, [src]);

  useEffect(() => {
    let active = true;
    if (isCloudAsset) {
      const assetId = src.replace('cloud-asset://', '');
      setIsLoading(true);
      CloudPhotoService.getPhotoAssetDataUrl(assetId)
        .then((dataUrl) => {
          if (!active) return;
          if (dataUrl) {
            setResolvedCloudSrc(dataUrl);
            setHasError(false);
          } else {
            setHasError(true);
            setIsLoading(false);
          }
        })
        .catch(() => {
          if (active) {
            setHasError(true);
            setIsLoading(false);
          }
        });
    } else {
      setResolvedCloudSrc('');
    }
    return () => {
      active = false;
    };
  }, [src, isCloudAsset, retryCount]);

  const activeRawSrc = fallbackSrc || (isCloudAsset ? resolvedCloudSrc : src);

  const normalizedSrc = activeRawSrc
    ? activeRawSrc.replace(/^https?:\/\/[^/]+(?=\/uploads\/)/i, '')
    : '';

  const effectiveSrc =
    retryCount > 0 && normalizedSrc && !normalizedSrc.startsWith('data:')
      ? `${normalizedSrc}${normalizedSrc.includes('?') ? '&' : '?'}retry=${retryCount}`
      : normalizedSrc;

  useEffect(() => {
    setRetryCount(0);
  }, [src]);

  useEffect(() => {
    if (!effectiveSrc) {
      if (!isCloudAsset) {
        setIsLoading(false);
        setHasError(false);
      }
      return;
    }

    const img = imgRef.current;
    if (img && img.complete) {
      if (img.naturalWidth > 0) {
        setIsLoading(false);
        setHasError(false);
      } else {
        setIsLoading(false);
        setHasError(true);
      }
      return;
    }

    setIsLoading(true);
    setHasError(false);

    // Safety timeout so an image can never stay stuck in infinite loading
    const timer = setTimeout(() => {
      const currentImg = imgRef.current;
      if (currentImg && currentImg.complete && currentImg.naturalWidth > 0) {
        setIsLoading(false);
        setHasError(false);
      } else {
        setIsLoading(false);
        setHasError(true);
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [effectiveSrc]);

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.info(`[ReferenceImage] Retrying image load: ${normalizedSrc}`);
    setHasError(false);
    setIsLoading(true);
    setRetryCount((c) => c + 1);
  };

  if (!src) {
    return null;
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-100">
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100/90 text-slate-500 z-10 pointer-events-none">
          <RefreshCw className={`${compact ? 'w-3.5 h-3.5' : 'w-6 h-6'} animate-spin text-amber-500`} />
          {!compact && (
            <span className="text-[11px] font-bold mt-1.5 text-slate-600">
              {language === 'hi' ? 'फोटो लोड हो रही है...' : 'Loading photo...'}
            </span>
          )}
        </div>
      )}

      {hasError ? (
        <div
          onClick={onClick}
          className={`w-full h-full flex flex-col items-center justify-center bg-rose-50 text-rose-700 p-2 text-center ${
            onClick ? 'cursor-pointer' : ''
          }`}
        >
          <AlertCircle className={`${compact ? 'w-4 h-4' : 'w-7 h-7 mb-1.5'} text-rose-500 shrink-0`} />
          {!compact && (
            <>
              <span className="text-xs font-bold">
                {language === 'hi' ? 'फोटो लोड नहीं हो सकी' : 'Failed to load photo'}
              </span>
              <button
                type="button"
                onClick={handleRetry}
                className="mt-2 px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{language === 'hi' ? 'पुनः प्रयास करें' : 'Retry'}</span>
              </button>
            </>
          )}
        </div>
      ) : (
        <img
          ref={imgRef}
          src={effectiveSrc}
          alt={alt}
          referrerPolicy="no-referrer"
          className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
          onClick={onClick}
          onLoad={(e) => {
            if (e.currentTarget.naturalWidth > 0) {
              setIsLoading(false);
              setHasError(false);
            } else {
              setIsLoading(false);
              setHasError(true);
            }
          }}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
            console.error(`[ReferenceImage] Failed to load image: ${effectiveSrc} (attempt ${retryCount + 1})`);
          }}
        />
      )}
    </div>
  );
};
