// 결정론적 노이즈.
//
// 라이브러리를 쓰지 않는 이유는 이 프로젝트에 빌드 도구가 없어서다.
// 그리고 Math.random()을 쓸 수 없는 이유가 더 중요하다 — 같은 좌표는 언제나
// 같은 지형이 나와야 한다. 플레이어가 왔던 곳으로 돌아왔는데 숲이 사라져
// 있으면 안 되고, 청크를 버렸다 다시 만들 때도 똑같이 나와야 하며,
// 나중에 멀티플레이에서 두 사람이 같은 세계를 봐야 하기 때문이다.
//
// 그래서 모든 값은 (시드, 좌표)만으로 계산한다. 저장할 것은 시드 하나뿐이다.

/**
 * 정수 두 개를 섞어 [0,1) 난수를 만든다.
 * 곱하는 상수는 서로소인 큰 소수들이라 비트가 골고루 흩어진다.
 */
export function hash2(seed, x, y) {
  let h = seed | 0;
  h = Math.imul(h ^ (x | 0), 0x27d4eb2d);
  h = Math.imul(h ^ (y | 0), 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** 정수 셋 버전 — 같은 칸에서 여러 값이 필요할 때 i로 구분한다 */
export function hash3(seed, x, y, i) {
  return hash2(seed ^ Math.imul(i | 0, 0x9e3779b9), x, y);
}

/** 5차 부드럽기 함수. 3차(3t²−2t³)보다 이음매의 각이 덜 보인다 */
function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * 값 노이즈 — 격자점마다 난수를 두고 그 사이를 보간한다.
 * 펄린 노이즈보다 단순하지만, 여러 옥타브를 겹치면 차이가 거의 드러나지 않는다.
 *
 * @returns {number} [-1, 1]
 */
export function valueNoise(seed, x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = fade(x - x0), fy = fade(y - y0);

  const a = hash2(seed, x0, y0);
  const b = hash2(seed, x0 + 1, y0);
  const c = hash2(seed, x0, y0 + 1);
  const d = hash2(seed, x0 + 1, y0 + 1);

  const top = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  return (top + (bottom - top) * fy) * 2 - 1;
}

/**
 * 여러 배율의 노이즈를 겹친다(fractal Brownian motion).
 * 큰 파도 위에 작은 물결을 얹는 것과 같아서, 한 겹만 쓸 때보다 자연스럽다.
 *
 * @param {number} octaves 겹치는 횟수. 많을수록 세밀하지만 그만큼 느리다
 * @param {number} lacunarity 옥타브마다 주파수를 곱하는 비율
 * @param {number} gain 옥타브마다 진폭을 곱하는 비율
 * @returns {number} 대략 [-1, 1]
 */
export function fbm(seed, x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(seed + i * 1013, x * freq, y * freq) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/**
 * 능선 노이즈 — 절댓값을 뒤집어 날카로운 산등성이를 만든다.
 * 평범한 fbm은 언덕이 둥글둥글해서 바위 지대에 어울리지 않는다.
 * @returns {number} [0, 1]
 */
export function ridged(seed, x, y, octaves = 4) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise(seed + i * 7717, x * freq, y * freq));
    sum += n * n * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.0;
  }
  return sum / norm;
}

/**
 * 좌표를 씨앗 삼는 난수 발생기.
 * 청크 안에서 나무 30그루를 놓을 때처럼 여러 값이 연달아 필요한 경우에 쓴다.
 * Math.random()과 달리 같은 청크는 언제나 같은 수열을 낸다.
 */
export function rngAt(seed, x, y) {
  let s = (Math.imul(seed ^ (x | 0), 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1)) >>> 0;
  return function next() {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
