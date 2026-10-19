import "dotenv/config";

/**
 * 카카오 설정이 제대로 됐는지 한 번에 확인한다.
 *
 * 책 검색 / 장소 검색 / 지도 SDK 는 요구 조건이 조금씩 달라서
 * 하나가 되는데 다른 하나가 안 되는 일이 흔하다. 어디가 막혔는지 바로 알려준다.
 *
 *   npm run check:kakao
 */

const rest = process.env.KAKAO_REST_API_KEY?.trim();
const js = process.env.NEXT_PUBLIC_KAKAO_JS_KEY?.trim();
const DOMAIN = process.env.KAKAO_CHECK_DOMAIN?.trim() || "http://localhost:3000";

const results = [];

function record(name, ok, detail, fix) {
  results.push({ name, ok, detail, fix });
}

async function checkBooks() {
  if (!rest) {
    record("책 검색", false, "KAKAO_REST_API_KEY 가 비어 있다", ".env 에 REST API 키를 넣는다");
    return;
  }
  const url = new URL("https://dapi.kakao.com/v3/search/book");
  url.searchParams.set("query", "소년이 온다");
  url.searchParams.set("size", "1");

  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${rest}` } });
  if (res.ok) {
    const body = await res.json();
    record("책 검색", true, `정상 (검색 결과 ${body.meta?.total_count ?? "?"}건)`);
    return;
  }
  const text = await res.text();
  record("책 검색", false, `HTTP ${res.status} ${text.slice(0, 120)}`, "REST API 키가 맞는지 확인한다");
}

async function checkPlaces() {
  if (!rest) {
    record("장소 검색", false, "KAKAO_REST_API_KEY 가 비어 있다", ".env 에 REST API 키를 넣는다");
    return;
  }
  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", "성수동 카페");
  url.searchParams.set("size", "1");

  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${rest}` } });
  if (res.ok) {
    const body = await res.json();
    record("장소 검색", true, `정상 (검색 결과 ${body.meta?.total_count ?? "?"}건)`);
    return;
  }
  const text = await res.text();
  const fix = text.includes("OPEN_MAP_AND_LOCAL")
    ? "콘솔 > 내 애플리케이션 > 앱 선택 > [카카오맵] > [사용 설정] 을 ON 으로"
    : "REST API 키가 맞는지 확인한다";
  record("장소 검색", false, `HTTP ${res.status} ${text.slice(0, 120)}`, fix);
}

async function checkMapSdk() {
  if (!js) {
    record("지도 SDK", false, "NEXT_PUBLIC_KAKAO_JS_KEY 가 비어 있다", ".env 에 JavaScript 키를 넣는다");
    return;
  }
  if (js === rest) {
    record("지도 SDK", false, "REST 키와 같은 값이다", "앱 키 메뉴에서 JavaScript 키를 따로 복사한다");
    return;
  }
  const url = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(js)}&autoload=false`;
  const res = await fetch(url, { headers: { Referer: `${DOMAIN}/` } });
  const text = await res.text();

  if (res.ok && !text.trimStart().startsWith("{")) {
    record("지도 SDK", true, `정상 (${text.length} bytes)`);
    return;
  }
  const fix = text.includes("domain mismatched")
    ? `콘솔 > 앱 선택 > [플랫폼] > [Web] 에 ${DOMAIN} 을 등록한다`
    : "JavaScript 키가 맞는지 확인한다";
  record("지도 SDK", false, `HTTP ${res.status} ${text.slice(0, 120)}`, fix);
}

await Promise.all([checkBooks(), checkPlaces(), checkMapSdk()]);

console.log("");
for (const { name, ok, detail, fix } of results) {
  console.log(`${ok ? "✅" : "❌"} ${name.padEnd(10)} ${detail}`);
  if (!ok && fix) console.log(`   → ${fix}`);
}
console.log("");

const failed = results.filter((r) => !r.ok).length;
if (failed) {
  console.log(`${failed}개 항목이 아직 설정되지 않았다.`);
  process.exitCode = 1;
} else {
  console.log("전부 정상이다.");
}
