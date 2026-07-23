import { describe, expect, it } from "vitest";
import { filterFunctionSuggestions, moveFunctionSuggestionIndex } from "./FunctionPicker";

describe("filterFunctionSuggestions", () => {
    const options = ["Bar staff", "Runner", "Host / Hostess", "Kitchen assistant"];

    it("returns all options for an empty query", () => {
        expect(filterFunctionSuggestions(options, "  ")).toEqual(options);
    });

    it("matches case-insensitively on a substring", () => {
        expect(filterFunctionSuggestions(options, "ost")).toEqual(["Host / Hostess"]);
        expect(filterFunctionSuggestions(options, "STAFF")).toEqual(["Bar staff"]);
    });

    it("returns nothing when no option contains the query", () => {
        expect(filterFunctionSuggestions(options, "manager")).toEqual([]);
    });
});

describe("moveFunctionSuggestionIndex", () => {
    it("wraps around when navigating past the ends", () => {
        expect(moveFunctionSuggestionIndex(-1, "ArrowDown", 3)).toBe(0);
        expect(moveFunctionSuggestionIndex(2, "ArrowDown", 3)).toBe(0);
        expect(moveFunctionSuggestionIndex(0, "ArrowUp", 3)).toBe(2);
    });

    it("returns -1 when there are no suggestions", () => {
        expect(moveFunctionSuggestionIndex(0, "ArrowDown", 0)).toBe(-1);
    });
});
