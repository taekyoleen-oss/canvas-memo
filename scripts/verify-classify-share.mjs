// 순수 함수 회귀 검증. 본격 검증은 npx tsc 와 수동 시나리오로 갈음.
import { strict as assert } from "node:assert";

const URL_REGEX = /^(https?:\/\/[^\s]+)$/i;
function isUrlString(s) {
  const t = s.trim();
  if (URL_REGEX.test(t)) return true;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch { return false; }
}

assert.equal(isUrlString("https://youtu.be/abc"), true);
assert.equal(isUrlString("  http://example.com  "), true);
assert.equal(isUrlString("hello world"), false);
assert.equal(isUrlString("ftp://example.com"), false);
assert.equal(isUrlString(""), false);

console.log("classifyShare URL detection OK");
