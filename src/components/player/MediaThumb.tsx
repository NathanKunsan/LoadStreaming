import React, { useState, useEffect } from 'react';
import { Disc3, Tv } from 'lucide-react';
import { getDeterministicPalette } from '../../utils/mediaHelpers';

interface MediaThumbProps {
  src?: string;
  filePath?: string;
  title: string;
  mediaType?: 'video' | 'audio';
  className?: string;
  imgClassName?: string;
}

function getYoutubeFallbackUrl(url: string): string | null {
  if (!url) return null;
  const match = /ytimg\.com\/(?:vi|vi_webp)\/([^/?#]+)\/(maxresdefault|sddefault)/i.exec(url);
  if (match && match[1]) {
    return `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
  }
  return null;
}

export const MediaThumb: React.FC<MediaThumbProps> = ({
  src,
  filePath,
  title,
  mediaType = 'audio',
  className = 'w-full h-full',
  imgClassName = 'w-full h-full object-cover'
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string>(src || '');
  const [triedYtFallback, setTriedYtFallback] = useState<boolean>(false);
  const [triedLocalExtract, setTriedLocalExtract] = useState<boolean>(false);
  const [failedAll, setFailedAll] = useState<boolean>(false);

  useEffect(() => {
    setResolvedSrc(src || '');
    setTriedYtFallback(false);
    setTriedLocalExtract(false);
    setFailedAll(!src);

    if (!src && filePath && window.electronAPI?.extractMediaThumbnail) {
      setTriedLocalExtract(true);
      window.electronAPI
        .extractMediaThumbnail(filePath)
        .then((extracted) => {
          if (extracted) {
            setResolvedSrc(extracted);
            setFailedAll(false);
          }
        })
        .catch(() => {});
    }
  }, [src, filePath]);

  const handleError = () => {
    if (!triedYtFallback && resolvedSrc) {
      const ytFallback = getYoutubeFallbackUrl(resolvedSrc);
      setTriedYtFallback(true);
      if (ytFallback && ytFallback !== resolvedSrc) {
        setResolvedSrc(ytFallback);
        return;
      }
    }

    if (!triedLocalExtract && filePath && window.electronAPI?.extractMediaThumbnail) {
      setTriedLocalExtract(true);
      window.electronAPI
        .extractMediaThumbnail(filePath)
        .then((extracted) => {
          if (extracted && extracted !== resolvedSrc) {
            setResolvedSrc(extracted);
            setFailedAll(false);
          } else {
            setFailedAll(true);
          }
        })
        .catch(() => setFailedAll(true));
      return;
    }

    setFailedAll(true);
  };

  const [c1, darkBg, c2] = getDeterministicPalette(title || filePath || 'media');

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: `linear-gradient(135deg, ${c1}, ${darkBg}, ${c2})` }}
    >
      {resolvedSrc && !failedAll ? (
        <img
          src={resolvedSrc}
          alt={title}
          onError={handleError}
          className={imgClassName}
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-black/30 text-white/80">
          {mediaType === 'video' ? <Tv className="w-5 h-5" /> : <Disc3 className="w-5 h-5" />}
        </div>
      )}
    </div>
  );
};
