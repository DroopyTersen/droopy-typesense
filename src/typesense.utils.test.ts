import { describe, expect, it } from "vitest";
import { convertFilterToString, toSearchParams } from "./typesense.utils";
import {
  SearchCriteria,
  TypesenseCollectionSchema,
  TypesenseFieldsSchema,
} from "./typesense.types";
describe("convertFilterToString", () => {
  it("should convert a simple filter object to a Typesense filter string", () => {
    const filter = {
      country: "United States",
      category: "Software",
      price: {
        gte: 100,
        lt: 500,
      },
    };

    const expected =
      "country:=United States && category:=Software && (price:>=100 && price:<500)";
    const result = convertFilterToString(filter);

    expect(result).toBe(expected);
  });

  it("should convert a filter object with array values to a Typesense filter string", () => {
    const filter = {
      country: "United States",
      category: ["Software", "Healthcare"],
      price: {
        gte: 100,
      },
    };

    const expected =
      "country:=United States && category:=[Software,Healthcare] && price:>=100";
    const result = convertFilterToString(filter);

    expect(result).toBe(expected);
  });

  it("should convert a filter object with an array of filter operator opbjects", () => {
    const filter = {
      price: [
        {
          gte: 100,
          lt: 500,
        },
        {
          gte: 1000,
          lt: 5000,
        },
      ],
    };

    const expected =
      "((price:>=100 && price:<500) || (price:>=1000 && price:<5000))";
    const result = convertFilterToString(filter);

    expect(result).toBe(expected);
  });
});

describe("toSearchParams", () => {
  const fields = {
    id: { type: "string" },
    name: { type: "string", facet: true, sort: true },
    description: { type: "string" },
    price: { type: "float", facet: true, sort: true },
  } as const;

  it("should return default search params with wildcard query when no criteria is provided", () => {
    const criteria: SearchCriteria<typeof fields> = {};
    const result = toSearchParams(criteria, fields);
    expect(result).toEqual({
      q: "*",
      query_by: "name,description,price",
    });
  });

  it("should return search params with queryBy and weights when criteria.queryBy is provided", () => {
    const criteria: SearchCriteria<typeof fields> = {
      queryBy: { name: 2, description: 1 },
    };
    const result = toSearchParams(criteria, fields);
    expect(result).toEqual({
      q: "*",
      query_by: "name,description",
      query_by_weights: "2,1",
    });
  });

  it("should return search params with sort_by when criteria.sort is provided as a string", () => {
    const criteria: SearchCriteria<typeof fields> = {
      sort: "price:desc",
    };
    const result = toSearchParams(criteria, fields);
    expect(result).toEqual({
      q: "*",
      query_by: "name,description,price",
      sort_by: "price:desc",
    });
  });

  it("should return search params with sort_by when criteria.sort is provided as an array", () => {
    const criteria: SearchCriteria<typeof fields> = {
      sort: ["price:desc", "name:asc"],
    };
    const result = toSearchParams(criteria, fields);
    expect(result).toEqual({
      q: "*",
      query_by: "name,description,price",
      sort_by: "price:desc,name:asc",
    });
  });

  it("should return search params with facet_by and max_facet_values when criteria.facets and criteria.maxFacetValues are provided", () => {
    const criteria: SearchCriteria<typeof fields> = {
      facets: ["name", "price"],
      maxFacetValues: 5,
    };
    const result = toSearchParams(criteria, fields);
    expect(result).toEqual({
      q: "*",
      query_by: "name,description,price",
      facet_by: "name,price",
      max_facet_values: 5,
    });
  });
});
