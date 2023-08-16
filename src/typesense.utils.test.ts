import { describe, expect, it } from "vitest";
import {
  convertFilterToString,
  toSearchParams,
  toFieldsArray,
} from "./typesense.utils";
import { SearchCriteria } from "./typesense.types";

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

  it("should ignore empty filter arrays", () => {
    const filter = {
      country: "United States",
      category: [],
      price: {
        gte: 100,
      },
    };

    const expected = "country:=United States && price:>=100";
    const result = convertFilterToString(filter);

    expect(result).toBe(expected);
  });
  it("should ignore null and undefined filter values", () => {
    const filter = {
      country: "United States",
      category: null,
      price: {
        gte: 100,
      },
    };

    const expected = "country:=United States && price:>=100";
    const result = convertFilterToString(filter);

    expect(result).toBe(expected);

    const filter2 = {
      country: "United States",
      category: undefined,
      price: {
        gte: 100,
      },
    };

    const expected2 = "country:=United States && price:>=100";
    const result2 = convertFilterToString(filter2);

    expect(result2).toBe(expected2);
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
      query_by: "name,description",
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
      query_by: "name,description",
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
      query_by: "name,description",
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
      query_by: "name,description",
      facet_by: "name,price",
      max_facet_values: 5,
    });
  });

  it("should handle filter criteria", () => {
    const criteria: SearchCriteria<typeof fields> = {
      filter: {
        price: {
          gte: 100,
          lt: 500,
        },
      },
    };
    const result = toSearchParams(criteria, fields);
    expect(result).toEqual({
      q: "*",
      query_by: "name,description",
      filter_by: "(price:>=100 && price:<500)",
    });
  });
  it("Should strip out empty filter arrays", () => {
    const criteria: SearchCriteria<any> = {
      q: "*",
      sort: undefined,
      per_page: 50,
      page: 1,
      filter: {
        "creator.name": [],
        "team.id": "dc262ab3-91c9-4c4d-ae26-7675571dd291",
        "timeline.title": [],
        tags: undefined,
        month: [],
        dot_type: [],
      },
      facets: ["month", "tags", "timeline.title", "creator.name", "dot_type"],
    };

    const result = toSearchParams(criteria, fields);
    expect(result?.filter_by).toBe(
      "team.id:=dc262ab3-91c9-4c4d-ae26-7675571dd291"
    );
  });
});

describe("toFieldsArray", () => {
  it("should return an array of field names", () => {
    const fields = {
      id: { type: "string" },
      name: { type: "string", facet: true, sort: true },
      description: { type: "string" },
      price: { type: "float", facet: true, sort: true },
    } as const;

    const result = toFieldsArray(fields);
    // result should start with { name: ".*", type: "auto"}
    expect(result.length).toBe(5);
    expect(result[0]?.name).toEqual(".*");
    expect(result[0]?.type).toEqual("auto");
    expect(result[1]).toEqual({
      name: "id",
      type: "string",
      optional: false,
    });
    expect(result[2]).toEqual({
      name: "name",
      type: "string",
      optional: false,
      facet: true,
      sort: true,
    });
  });
});
