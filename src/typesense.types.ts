import { FieldType } from "typesense/lib/Typesense/Collection";
import { SearchParams } from "typesense/lib/Typesense/Documents";
export type TypesenseConfig = {
  apiKey: string;
  url: string;
};
export type TypesenseFieldType = FieldType;

export type TypesenseField = {
  type: TypesenseFieldType;
  index?: boolean;
  optional?: boolean;
  facet?: boolean;
  sort?: boolean;
  locale?: string;
  infix?: boolean;
  num_dim?: number;
};
export interface IdField extends Omit<TypesenseField, "optional"> {
  type: "string";
  optional?: false;
}
export type TypesenseFieldsSchema = {
  id: IdField;
  [key: string]: TypesenseField;
};

export type TypesenseCollectionSchema = {
  name: string;
  fields: TypesenseFieldsSchema;
  token_separators?: string[];
  default_sorting_field?: string;
};

export type AllFieldKeys<TFieldsSchema extends TypesenseFieldsSchema> = Extract<
  keyof TFieldsSchema,
  string
>;
type FilterFields<
  TFieldsObj extends TypesenseFieldsSchema,
  TCriteria extends Partial<TypesenseField>
> = {
  [FieldKey in keyof TFieldsObj]: TFieldsObj[FieldKey] extends TCriteria
    ? FieldKey
    : never;
}[keyof TFieldsObj];

export type SortableFieldKeys<TFieldsSchema extends TypesenseFieldsSchema> =
  FilterFields<TFieldsSchema, { sort: true }>;

export type FacetableFieldKeys<TFieldsSchema extends TypesenseFieldsSchema> =
  FilterFields<TFieldsSchema, { facet: true }>;

export type UnsearchableFieldKeys<TFieldsSchema extends TypesenseFieldsSchema> =
  FilterFields<TFieldsSchema, { index: false }> | ".*" | "id";

export type SearchableFieldKeys<TFieldsSchema extends TypesenseFieldsSchema> =
  Exclude<AllFieldKeys<TFieldsSchema>, UnsearchableFieldKeys<TFieldsSchema>>;

export type FieldTypeToJsType<T extends string> = T extends "string"
  ? string
  : T extends "int32"
  ? number
  : T extends "int64"
  ? number
  : T extends "float"
  ? number
  : T extends "bool"
  ? boolean
  : T extends "geopoint"
  ? [number, number]
  : T extends "geopoint[]"
  ? [number, number][]
  : T extends "string[]"
  ? string[]
  : T extends "int32[]"
  ? number[]
  : T extends "int64[]"
  ? number[]
  : T extends "float[]"
  ? number[]
  : T extends "bool[]"
  ? boolean[]
  : T extends "object"
  ? Record<string, unknown>
  : T extends "object[]"
  ? Record<string, unknown>[]
  : T extends "auto"
  ? any
  : T extends `${infer U}*`
  ? FieldTypeToJsType<U>[]
  : never;

export type TypeSenseCollectionDocument<
  TFieldsSchema extends TypesenseFieldsSchema
> = {
  [K in keyof TFieldsSchema]: TFieldsSchema[K] extends { optional: true }
    ? FieldTypeToJsType<TFieldsSchema[K]["type"]> | undefined
    : FieldTypeToJsType<TFieldsSchema[K]["type"]>;
};

// Create a utitliy type to unwrap all the custom types
// and display the actual types

export type SortOrder = "asc" | "desc";
export type SortableFieldOrder<TFieldsSchema extends TypesenseFieldsSchema> =
  | {
      [K in SortableFieldKeys<TFieldsSchema>]: K extends string
        ? `${K}:${SortOrder}`
        : never;
    }[SortableFieldKeys<TFieldsSchema>]
  | "_text_match:desc";

export type SortBy<TFieldsSchema extends TypesenseFieldsSchema> =
  | SortableFieldOrder<TFieldsSchema>
  | SortableFieldOrder<TFieldsSchema>[];

export type SearchCriteria<TFieldsSchema extends TypesenseFieldsSchema> = {
  q?: string;
  /**
   * Defaults to all searchable fields at the same weight
   * The key is the field name to search in.
   * The value is the relative weight to give each query_by field when ranking results. Values can be between 0 and 127. This can be used to boost fields in priority, when looking for matches.
   */
  queryBy?: {
    [K in SearchableFieldKeys<TFieldsSchema>]?: number;
  };
  /** Defaults to highest ranked match */
  sort?: SortBy<TFieldsSchema>;
  /** Defaults to 1 */
  page?: number;
  /** Max of 250 */
  per_page?: number;
  /** Facet fields with the maximum number of values to return. */
  facets?: FacetCriteria<TFieldsSchema>;
  /** Defaults to 10 */
  maxFacetValues?: number;
  /**
   * Filter results by a field value. Multiple values to the same filter field
   * will be "OR"ed together. Each separate filter field will be "AND"ed together.
   * You can also pass a raw typesense filter string.
   */
  filter?: FilterCriteria<TFieldsSchema> | string;
  /** Raw typesense Search Params overrides */
  _searchParams?: Partial<SearchParams>;
};

export type FacetCriteria<TFieldsSchema extends TypesenseFieldsSchema> = (
  | {
      field: FacetableFieldKeys<TFieldsSchema>;
      /**
       * Facet values that are returned can now be filtered via this parameter.
       * The matching facet text is also highlighted. For example, when faceting
       * by category, you can set facet_query=category:shoe to return only facet
       * values that contain the prefix "shoe".
       */
      facet_query?: string;
    }
  | FacetableFieldKeys<TFieldsSchema>
)[];

export const TYPSENSE_FILTER_OPERATORS = {
  eq: ":=",
  contains: ":",
  neq: ":!=",
  gt: ":>",
  gte: ":>=",
  lt: ":<",
  lte: ":<=",
} as const;

export type FilterOperator = keyof typeof TYPSENSE_FILTER_OPERATORS;
export type FilterCriteria<TFieldsSchema extends TypesenseFieldsSchema> = {
  [K in SearchableFieldKeys<TFieldsSchema>]?:
    | FieldTypeToJsType<TFieldsSchema[K]["type"]>
    | FieldTypeToJsType<TFieldsSchema[K]["type"]>[]
    | {
        [Operator in FilterOperator]?: FieldTypeToJsType<
          TFieldsSchema[K]["type"]
        >;
      }
    | {
        [Operator in FilterOperator]?: FieldTypeToJsType<
          TFieldsSchema[K]["type"]
        >;
      }[];
};

export type SearchResponseFacets<TFieldsSchema extends TypesenseFieldsSchema> =
  {
    [K in FacetableFieldKeys<TFieldsSchema>]: {
      count: number;
      highlighted: string;
      value: string;
    };
  };
