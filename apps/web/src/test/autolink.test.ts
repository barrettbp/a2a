import { describe, expect, it } from "vitest";
import { autolink } from "../lib/autolink";

const links = (s: string) => autolink(s).filter((p) => p.type === "link").map((p) => p.value);

describe("autolink", () => {
  it("links http and https", () => {
    expect(links("see https://example.com/a and http://x.org")).toEqual(["https://example.com/a", "http://x.org"]);
  });
  it("strips trailing punctuation", () => {
    expect(links("go to https://example.com/a.")).toEqual(["https://example.com/a"]);
    expect(links("(https://example.com/a)!")).toEqual(["https://example.com/a"]);
    expect(links('"https://example.com/a",')).toEqual(["https://example.com/a"]);
  });
  it("keeps balanced brackets", () => {
    expect(links("https://en.wikipedia.org/wiki/Foo_(bar)")).toEqual(["https://en.wikipedia.org/wiki/Foo_(bar)"]);
    expect(links("(see https://en.wikipedia.org/wiki/Foo_(bar))")).toEqual(["https://en.wikipedia.org/wiki/Foo_(bar)"]);
  });
  it("rejects other schemes and bare domains", () => {
    expect(links("javascript:alert(1) mailto:a@b.c ftp://x.org example.com www.example.com")).toEqual([]);
  });
  it("does not turn HTML into anything but text", () => {
    const parts = autolink('<a href="https://evil.test">x</a> <script>alert(1)</script>');
    expect(parts.map((p) => p.value).join("")).toBe('<a href="https://evil.test">x</a> <script>alert(1)</script>');
    expect(links('<a href="https://evil.test">x</a>')).toEqual(["https://evil.test"]);
  });
  it("round-trips the text", () => {
    const s = "a https://x.org/y, b (https://z.org) c";
    expect(autolink(s).map((p) => p.value).join("")).toBe(s);
  });
  it("ignores a bare scheme", () => {
    expect(links("https:// nothing")).toEqual([]);
  });
});
