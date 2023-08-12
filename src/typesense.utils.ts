import type { CollectionFieldSchema } from "typesense/lib/Typesense/Collection";
import type {
  SearchParams,
  SearchResponse,
} from "typesense/lib/Typesense/Documents";
import {
  FilterCriteria,
  FilterOperator,
  SearchCriteria,
  SearchResponseFacets,
  SearchableFieldKeys,
  TYPSENSE_FILTER_OPERATORS,
  TypeSenseCollectionDocument,
  TypesenseFieldsSchema,
} from "./typesense.types.js";

export const toFieldsArray = (
  fields: TypesenseFieldsSchema
): CollectionFieldSchema[] => {
  let fieldsArray: CollectionFieldSchema[] = Object.entries(fields).map(
    ([name, field]) => {
      return {
        name,
        ...field,
        optional:
          field.index === false || field?.optional === true ? true : false,
      };
    }
  );
  fieldsArray.unshift({
    name: ".*",
    type: "auto",
    sort: false,
    facet: false,
    index: true,
  });
  return fieldsArray;
};

export const DEFAULT_TOKEN_SEPARATORS = [
  "@",
  "-",
  ".",
  ",",
  ";",
  ":",
  "_",
  "/",
  "|",
  "(",
  ")",
];

export const toSearchParams = <TFieldsSchema extends TypesenseFieldsSchema>(
  criteria: SearchCriteria<TFieldsSchema>,
  fields: TFieldsSchema
): SearchParams => {
  // If no queryBy is passed in criteria, we will use all fields that are indexed
  let query_by = Object.keys(fields)
    .filter(
      (key) =>
        fields[key]?.index !== false &&
        key !== ".*" &&
        key !== "id" &&
        fields[key]?.type?.startsWith("string")
    )
    .join(",");
  // query_by_weights needs to be a comma separated string (list of weights)
  // It should be in the same order as query_by
  let query_by_weights = undefined;
  // You can pass an object { field1: weight1, field2: weight2 } to specify the query_by and weights
  if (criteria.queryBy) {
    query_by = Object.keys(criteria.queryBy).join(",");
    query_by_weights = Object.values(criteria.queryBy).join(",");
  }

  let params: SearchParams = {
    q: criteria.q || "*",
    query_by,
    query_by_weights,
  };
  // SORTING
  if (criteria.sort) {
    if (typeof criteria.sort === "string") {
      params.sort_by = criteria.sort;
    } else if (Array.isArray(criteria.sort)) {
      params.sort_by = criteria.sort.join(",");
    }
  }

  // FACETS
  if (criteria?.facets?.length) {
    let facetBy = criteria.facets
      ?.map((facet) => {
        if (typeof facet !== "string") {
          return (facet as any)?.field || "";
        }
        return facet;
      })
      .filter(Boolean)
      .join(",");
    params.facet_by = facetBy;
    if (criteria.maxFacetValues !== undefined) {
      params.max_facet_values = criteria.maxFacetValues;
    }
  }

  // Filters
  if (criteria.filter) {
    if (typeof criteria.filter === "string") {
      params.filter_by = criteria.filter;
    } else {
      params.filter_by = convertFilterToString(criteria.filter);
    }
  }

  // Inlclude
  if (criteria.include) {
    params.include_fields = criteria.include.join(",");
  }
  return {
    ...params,
    ...criteria._searchParams,
  };
};

export const parseResponseFacets = <
  TFieldsSchema extends TypesenseFieldsSchema
>(
  searchResponse: SearchResponse<TypeSenseCollectionDocument<TFieldsSchema>>
) => {
  let facets: any = {};
  searchResponse.facet_counts?.forEach((rawFacet) => {
    facets[rawFacet.field_name] = rawFacet.counts;
  });

  return facets as SearchResponseFacets<TFieldsSchema>;
};

// type RawFilterValue = string | number | boolean;

// type ParseableFilterValueObject = {
//   [operator: keyof typeof TYPSENSE_FILTER_OPERATORS]: string | number | boolean | string[] | number[] | boolean[];
// }

// type ParseableFilterValue = RawFilterValue | RawFilterValue[] | ParseableFilterValueObject[]

// const _parseFilterObject = (fieldKey:string, value: ParseableFilterValueObject) => {
//   let
//   return ``
// }
// const toFilterString = <TFieldsSchema extends TypesenseFieldsSchema>(filter: FilterCriteria<TFieldsSchema>) : string => {
//   for(let key in filter) {
//     let value = filter[key as SearchableFieldKeys<TFieldsSchema>] as ParseableFilterValue;

//     if (typeof value === "string") {
//       return `${key}${TYPSENSE_FILTER_OPERATORS.eq}${value}`;
//     }

//     if (Array.isArray(value)) {
//       return `${key} = (${value.join(",")})`;
//     } else if (typeof value === "object") {
//       let filterString = "";
//       for(let operator in value) {
//         let filterValue = value[operator];
//         if (Array.isArray(filterValue)) {
//           filterString += `${key} ${operator} (${filterValue.join(",")})`;
//         } else {
//           filterString += `${key} ${operator} ${filterValue}`;
//         }
//       }
//       return filterString;
//     }
//   }

// }

export function convertFilterToString<
  TFieldsSchema extends TypesenseFieldsSchema
>(filter: FilterCriteria<TFieldsSchema>): string {
  const clauses: string[] = [];

  for (const key in filter) {
    const value: any = filter[key as SearchableFieldKeys<TFieldsSchema>];

    if (Array.isArray(value)) {
      if (typeof value[0] === "object" && !Array.isArray(value[0])) {
        // Handle array of filter operator objects
        const subClauses: string[] = [];

        for (const operatorObject of value) {
          const operatorClauses: string[] = [];

          for (const operator in operatorObject) {
            const operatorValue = operatorObject[operator];
            const typesenseOperator =
              TYPSENSE_FILTER_OPERATORS[operator as FilterOperator];
            const operatorClause = `${key}${typesenseOperator}${operatorValue}`;
            operatorClauses.push(operatorClause);
          }

          const subClause = `(${operatorClauses.join(" && ")})`;
          subClauses.push(subClause);
        }

        const arrayClause = `(${subClauses.join(" || ")})`;
        clauses.push(arrayClause);
      } else {
        // Handle primitive array
        const arrayClause = `${key}:=[${value.join(",")}]`;
        clauses.push(arrayClause);
      }
    } else if (typeof value === "object") {
      const subClauses: string[] = [];

      for (const operator in value) {
        const operatorValue = value[operator];
        const typesenseOperator =
          TYPSENSE_FILTER_OPERATORS[operator as FilterOperator];

        if (Array.isArray(operatorValue)) {
          const arraySubClause = `${key}${typesenseOperator}[${operatorValue.join(
            ","
          )}]`;
          subClauses.push(arraySubClause);
        } else {
          const subClause = `${key}${typesenseOperator}${operatorValue}`;
          subClauses.push(subClause);
        }
      }

      const objectClause =
        subClauses?.length > 1 ? `(${subClauses.join(" && ")})` : subClauses[0];
      clauses.push(objectClause);
    } else {
      const primitiveClause = `${key}:=${value}`;
      clauses.push(primitiveClause);
    }
  }

  return `${clauses.join(" && ")}`;
}
