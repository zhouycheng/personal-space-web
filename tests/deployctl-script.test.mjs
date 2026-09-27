import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../scripts/deploy/deployctl.sh", import.meta.url));

function run(args, input = "") {
  return spawnSync("bash", [script, ...args], { input, encoding: "utf8" });
}

test("rejects target path traversal before privileged work", () => {
  const result = run(["deploy", "../etc"], "ghcr.io/example/site@sha256:" + "a".repeat(64) + "\n");

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid deployment target/);
  assert.doesNotMatch(result.stderr, /must run as root/);
});

test("rejects mutable tags and malformed image references", () => {
  const result = run(["deploy", "justinspace"], "ghcr.io/example/site:latest\n");

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /pinned to a sha256 digest/);
  assert.doesNotMatch(result.stderr, /must run as root/);
});

test("rejects extra stdin after the registry credentials", () => {
  const image = "registry.example:5000/team/site@sha256:" + "a".repeat(64);
  const result = run(["deploy", "justinspace"], `${image}\nzhouycheng\ntoken\nunexpected\n`);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unexpected extra input/);
  assert.doesNotMatch(result.stderr, /must run as root/);
});

test("reads an immutable image reference and short-lived registry credentials", () => {
  const image = "ghcr.io/zhouycheng/personal-space-web@sha256:" + "a".repeat(64);
  const result = run(["deploy", "justinspace"], `${image}\nzhouycheng\ntoken\n`);

  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stderr, /expected|invalid|unexpected/);
});

test("accepts rollback only with a registered-target-shaped identifier", () => {
  const result = run(["rollback", "justinspace", "unexpected"]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /usage: deployctl rollback/);
  assert.doesNotMatch(result.stderr, /must run as root/);
});
