import { spotifyEmbedUrl, youtubeEmbedUrl } from "@/lib/music/embeds";

/**
 * 곡 상세의 듣기 영역.
 *
 * 유튜브나 Spotify 링크가 있으면 전곡을 여기서 바로 들을 수 있어요.
 * 둘 다 임베드는 키가 필요 없어요.
 */
export function MusicPanel({
  title,
  meta,
}: {
  title: string;
  meta: Record<string, unknown>;
}) {
  const youtube = youtubeEmbedUrl(typeof meta.youtubeUrl === "string" ? meta.youtubeUrl : undefined);
  const spotify = spotifyEmbedUrl(typeof meta.spotifyUrl === "string" ? meta.spotifyUrl : undefined);
  const appleUrl = typeof meta.appleUrl === "string" ? meta.appleUrl : null;

  if (!youtube && !spotify && !appleUrl) return null;

  return (
    <section className="space-y-4 card rounded-xl p-4">
      <h2 className="text-sm font-semibold text-ink-muted">듣기</h2>

      {youtube && (
        <div className="aspect-video overflow-hidden rounded-lg bg-surface-muted">
          <iframe
            src={youtube}
            title={`${title} 유튜브`}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            className="size-full border-0"
          />
        </div>
      )}

      {spotify && (
        <iframe
          src={spotify}
          title={`${title} Spotify`}
          allow="encrypted-media"
          loading="lazy"
          className="h-20 w-full rounded-lg border-0"
        />
      )}

      {appleUrl && (
        <a
          href={appleUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-block text-sm text-accent hover:underline"
        >
          Apple Music 에서 열기 ↗
        </a>
      )}
    </section>
  );
}
