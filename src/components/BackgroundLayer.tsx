import React, { useEffect, useState } from 'react';

interface BackgroundLayerProps {
  trackThumbnail: string | null;
  trackVideoId: string | null;
  customBgPath: string | null;
}

function buildTrackCandidateList(
  thumbnail: string | null,
  videoId: string | null
): string[] {
  const candidates: string[] = [];
  if (videoId) {
    candidates.push(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
    candidates.push(`https://i.ytimg.com/vi/${videoId}/sddefault.jpg`);
  }
  if (thumbnail) {
    candidates.push(thumbnail);
  }
  if (videoId) {
    candidates.push(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
  }
  return Array.from(new Set(candidates));
}

export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({
  trackThumbnail,
  trackVideoId,
  customBgPath
}) => {
  const [resolvedTrackBg, setResolvedTrackBg] = useState<string | null>(null);
  const [customBgValid, setCustomBgValid] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const candidates = buildTrackCandidateList(trackThumbnail, trackVideoId);

    if (candidates.length === 0) {
      setResolvedTrackBg(null);
      return;
    }

    const tryNext = (index: number) => {
      if (cancelled || index >= candidates.length) {
        if (!cancelled) setResolvedTrackBg(null);
        return;
      }

      const url = candidates[index];
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        // YouTube returns a 120x90 placeholder when maxresdefault does not exist
        if (img.naturalWidth <= 130 && index + 1 < candidates.length) {
          tryNext(index + 1);
          return;
        }
        setResolvedTrackBg(url);
      };
      img.onerror = () => {
        if (!cancelled) tryNext(index + 1);
      };
      img.src = url;
    };

    tryNext(0);
    return () => {
      cancelled = true;
    };
  }, [trackThumbnail, trackVideoId]);

  const customBgUrl = customBgPath ? window.aerowave.toMediaUrl(customBgPath) : null;

  useEffect(() => {
    setCustomBgValid(true);
  }, [customBgPath]);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#0b1221] pointer-events-none">
      {/* Deep atmospheric CSS fallback */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 30% 25%, rgba(251, 191, 36, 0.35), transparent 55%), radial-gradient(circle at 75% 45%, rgba(56, 189, 248, 0.25), transparent 55%), linear-gradient(135deg, #1b2845 0%, #274060 45%, #0f172a 100%)'
        }}
      />

      {/* Bundled default sunset artwork */}
      <img
        src="./default-bg.png"
        alt="AEROWAVE Sunset"
        className="absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1000 opacity-100"
      />

      {/* User custom local wallpaper */}
      {customBgUrl && customBgValid && (
        <img
          src={customBgUrl}
          alt="Custom HUD Background"
          onError={() => setCustomBgValid(false)}
          className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1000 ${
            resolvedTrackBg ? 'opacity-0' : 'opacity-100'
          }`}
        />
      )}

      {/* Active/Playing high-res track cover crossfade */}
      {resolvedTrackBg && (
        <img
          src={resolvedTrackBg}
          alt="Track Cover"
          className="absolute inset-0 w-full h-full object-cover object-center scale-[1.03] transition-opacity duration-1000 opacity-100"
        />
      )}

      {/* Subtle atmospheric dark tint + 4-corner vignette for legible crisp white text */}
      <div
        className="absolute inset-0 transition-colors duration-700"
        style={{
          background: resolvedTrackBg
            ? 'linear-gradient(180deg, rgba(6,11,22,0.48) 0%, rgba(6,11,22,0.28) 45%, rgba(6,11,22,0.62) 100%)'
            : 'linear-gradient(180deg, rgba(6,11,22,0.34) 0%, rgba(6,11,22,0.14) 48%, rgba(6,11,22,0.48) 100%)'
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 42%, rgba(5, 9, 18, 0.58) 100%)'
        }}
      />
    </div>
  );
};
