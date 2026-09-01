import fs from "fs";
import path from "path";

// src 전체를 훑어 import한 이름이 실제로 export되는지 확인한다.
// 문법 검사(node --check)는 파일 하나씩만 보므로 이런 어긋남을 못 잡는다.

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith(".js")) files.push(full.replace(/\\/g, "/"));
  }
})("src");

let problems = 0;

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const dir = path.dirname(file);

  for (const m of src.matchAll(/import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/g)) {
    const spec = m[2];
    if (!spec.startsWith(".")) continue; // three 등 외부 모듈은 건너뛴다

    const target = path.join(dir, spec).replace(/\\/g, "/");
    if (!fs.existsSync(target)) {
      console.log(`  [파일없음] ${file} → ${spec}`);
      problems++;
      continue;
    }

    const targetSrc = fs.readFileSync(target, "utf8");
    for (const raw of m[1].split(",")) {
      const name = raw.trim().split(/\s+as\s+/)[0].trim();
      if (!name) continue;
      const patterns = [
        new RegExp(`export\\s+(?:default\\s+)?(?:class|function|const|let|var)\\s+${name}\\b`),
        new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`),
        new RegExp(`export\\s+function\\s*\\*\\s*${name}\\b`),
      ];
      if (!patterns.some((p) => p.test(targetSrc))) {
        console.log(`  [export없음] ${file}: ${name} ← ${spec}`);
        problems++;
      }
    }
  }
}

console.log(problems === 0
  ? `import 검사 통과 (${files.length}개 파일)`
  : `${problems}건 문제`);
