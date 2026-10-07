import { describe, expect, it } from "vitest";
import { PAGE_SIZE, pageSkipTake, parsePage, splitPage } from "../lib/pagination";

describe("parsePage", () => {
  it("defaults to page 1 when missing or invalid", () => {
    expect(parsePage()).toBe(1);
    expect(parsePage({ page: "0" })).toBe(1);
    expect(parsePage({ page: "-3" })).toBe(1);
    expect(parsePage({ page: "abc" })).toBe(1);
  });

  it("parses a valid page number", () => {
    expect(parsePage({ page: "3" })).toBe(3);
  });
});

describe("pageSkipTake", () => {
  it("computes skip/take one page ahead so callers can detect a next page", () => {
    expect(pageSkipTake(1)).toEqual({ skip: 0, take: PAGE_SIZE + 1 });
    expect(pageSkipTake(2)).toEqual({ skip: PAGE_SIZE, take: PAGE_SIZE + 1 });
  });
});

describe("splitPage", () => {
  it("reports no next page when rows fit within the page size", () => {
    const rows = Array.from({ length: PAGE_SIZE }, (_, index) => index);
    const result = splitPage(rows);
    expect(result.hasNext).toBe(false);
    expect(result.rows).toHaveLength(PAGE_SIZE);
  });

  it("trims the lookahead row and reports a next page when it exists", () => {
    const rows = Array.from({ length: PAGE_SIZE + 1 }, (_, index) => index);
    const result = splitPage(rows);
    expect(result.hasNext).toBe(true);
    expect(result.rows).toHaveLength(PAGE_SIZE);
  });
});
