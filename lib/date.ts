/**
 * 날짜 하나를 가리키는 키.
 *
 * DailyPick 은 "그 날의 추천" 이라 시간이 의미가 없는데, DateTime 으로 저장된다.
 * 자정을 쓰면 시간대에 따라 하루가 밀려 다른 날로 잡히므로 UTC 정오로 고정한다.
 * 저장하는 쪽과 조회하는 쪽이 같은 규칙을 써야 해서 함수로 묶어 두었다.
 */
export function toDayKey(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0),
  );
}

export function todayKey(): Date {
  return toDayKey(new Date());
}

/** <input type="date"> 가 읽고 쓰는 형식 */
export function toDateInput(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export function formatKoreanDate(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}
