"use client";

import { useEffect, useRef, useState } from "react";

/**
 * iTunes 가 주는 30초 미리듣기.
 *
 * 목록에 여러 개가 함께 놓이므로, 하나를 틀면 나머지는 멈추게 한다.
 * 모듈 수준에 현재 재생 중인 엘리먼트를 들고 있어 컴포넌트끼리 상태를 공유한다.
 */
let nowPlaying: HTMLAudioElement | null = null;

export function PreviewPlayer({
  src,
  label,
  size = "md",
}: {
  src: string;
  label: string;
  size?: "sm" | "md";
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      // 화면을 떠날 때 소리가 남지 않게 한다.
      if (audio && nowPlaying === audio) {
        audio.pause();
        nowPlaying = null;
      }
    };
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      return;
    }

    if (nowPlaying && nowPlaying !== audio) {
      nowPlaying.pause();
      nowPlaying.currentTime = 0;
    }
    nowPlaying = audio;
    void audio.play().catch(() => setPlaying(false));
  }

  const diameter = size === "sm" ? "size-9" : "size-12";

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? `${label} 미리듣기 멈춤` : `${label} 미리듣기 재생`}
        className={`${diameter} flex shrink-0 items-center justify-center rounded-full bg-accent text-white transition-opacity hover:opacity-90`}
      >
        {playing ? (
          <span className="block text-sm leading-none">❙❙</span>
        ) : (
          <span className="block translate-x-px text-sm leading-none">▶</span>
        )}
      </button>

      {size === "md" && (
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full bg-accent transition-[width] duration-200"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          if (audio.duration > 0) setProgress(audio.currentTime / audio.duration);
        }}
      />
    </div>
  );
}
