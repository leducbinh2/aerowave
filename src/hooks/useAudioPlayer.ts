import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueueItem } from '../../shared/types';

export interface UseAudioPlayerResult {
  playingItem: QueueItem | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  playItem: (item: QueueItem) => Promise<void>;
  togglePlay: () => Promise<void>;
  seek: (seconds: number) => void;
  setVolume: (vol: number) => void;
  stop: () => void;
}

export function useAudioPlayer(onError: (msg: string) => void): UseAudioPlayerResult {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const [playingItem, setPlayingItem] = useState<QueueItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.85);

  const ensureAudioPipeline = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.preload = 'metadata';
      audio.volume = volume;
      audioRef.current = audio;

      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime || 0);
      });
      audio.addEventListener('loadedmetadata', () => {
        setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      });
      audio.addEventListener('durationchange', () => {
        setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      });
      audio.addEventListener('play', () => {
        setIsPlaying(true);
      });
      audio.addEventListener('pause', () => {
        setIsPlaying(false);
      });
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setCurrentTime(0);
      });
      audio.addEventListener('error', () => {
        setIsPlaying(false);
        onErrorRef.current('Không thể phát tệp âm thanh. Kiểm tra tệp còn tồn tại trên ổ đĩa.');
      });
    }

    if (!audioCtxRef.current && audioRef.current) {
      const AudioContextCtor = window.AudioContext;
      const ctx = new AudioContextCtor();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      sourceNodeRef.current = source;
      analyserRef.current = analyser;
    }

    return {
      audio: audioRef.current,
      ctx: audioCtxRef.current
    };
  }, [volume]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        void audioCtxRef.current.close();
      }
    };
  }, []);

  const playItem = useCallback(
    async (item: QueueItem) => {
      if (!item.filePath) {
        onErrorRef.current('Bài hát chưa hoàn tất tải xuống để nghe thử.');
        return;
      }

      const { audio, ctx } = ensureAudioPipeline();
      if (!audio) return;

      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
      }

      if (playingItem?.id === item.id) {
        if (audio.paused) {
          try {
            await audio.play();
          } catch {
            onErrorRef.current('Không thể tiếp tục phát tệp âm thanh.');
          }
        } else {
          audio.pause();
        }
        return;
      }

      const mediaUrl = window.aerowave.toMediaUrl(item.filePath);
      setPlayingItem(item);
      setCurrentTime(0);
      setDuration(item.duration ?? 0);
      audio.src = mediaUrl;
      audio.load();

      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
        onErrorRef.current('Không thể phát tệp âm thanh này.');
      }
    },
    [ensureAudioPipeline, playingItem?.id]
  );

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !playingItem) return;

    const { ctx } = ensureAudioPipeline();
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        onErrorRef.current('Không thể phát tệp âm thanh.');
      }
    } else {
      audio.pause();
    }
  }, [ensureAudioPipeline, playingItem]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    const maxDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const clamped = Math.max(0, Math.min(maxDuration, seconds));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setPlayingItem(null);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  return {
    playingItem,
    isPlaying,
    currentTime,
    duration,
    volume,
    analyserRef,
    playItem,
    togglePlay,
    seek,
    setVolume,
    stop
  };
}
