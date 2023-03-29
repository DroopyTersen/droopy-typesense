import { Client } from "typesense";
import {
  AllFieldKeys,
  SearchCriteria,
  TypeSenseCollectionDocument,
  TypesenseCollectionSchema,
  VectorFieldKeys,
} from "./typesense.types";
import {
  DEFAULT_TOKEN_SEPARATORS,
  parseResponseFacets,
  toFieldsArray,
  toSearchParams,
} from "./typesense.utils";
import {
  MultiSearchRequestSchema,
  MultiSearchResponse,
} from "typesense/lib/Typesense/MultiSearch";

export const createTypesenseRepo = <
  const TSchema extends TypesenseCollectionSchema
>(
  client: Client,
  collectionSchema: TSchema
) => {
  type TDocument = TypeSenseCollectionDocument<TSchema["fields"]>;

  const ensureCollection = async () => {
    try {
      let exists = await client
        .collections<TDocument>(collectionSchema.name)
        .exists();
      if (!exists) {
        await client.collections().create({
          ...collectionSchema,
          token_separators:
            collectionSchema.token_separators || DEFAULT_TOKEN_SEPARATORS,
          fields: toFieldsArray(collectionSchema.fields),
        });
      }
    } catch (err: any) {
      console.log("error in ensureCollection", err);
    }
    return client.collections<TDocument>(collectionSchema.name);
  };
  const deleteCollection = async () => {
    let exists = await client.collections(collectionSchema.name).exists();
    if (exists) {
      return client.collections(collectionSchema.name).delete();
    }
  };

  const importDocuments = async (documents: TDocument[]) => {
    let collection = await ensureCollection();
    return collection.documents().import(documents, {
      action: "upsert",
      dirty_values: "coerce_or_drop",
      return_id: true,
    });
  };

  const search = async (searchCriteria: SearchCriteria<TSchema["fields"]>) => {
    let collection = await ensureCollection();
    let response = await collection
      .documents()
      .search(toSearchParams(searchCriteria, collectionSchema.fields));

    return {
      ...response,
      hits: Array.from(response.hits || []),
      facets: parseResponseFacets(response),
    };
  };

  const vectorSearch = async ({
    field,
    vector,
    numResults = 10,
    include,
  }: {
    /** The vector field name to query */
    field: VectorFieldKeys<TSchema["fields"]>;
    /** The vector/embedding */
    vector: number[];
    /** Defaults to 10 */
    numResults?: number;
    /** Defaults to everything */
    include?: AllFieldKeys<TSchema["fields"]>[];
  }) => {
    let vectorQueryParams: MultiSearchRequestSchema = {
      collection: collectionSchema.name,
      vector_query: `${(field as string) + ""}:([${vector.join(
        ","
      )}], k:${numResults})`,
      query_by: "",
      q: "*",
    };
    if (include) {
      vectorQueryParams["include_fields"] = include.join(",");
    }
    let response = client.multiSearch.perform({
      searches: [vectorQueryParams],
    }) as unknown as MultiSearchResponse<TDocument>;
    return response;
  };

  const getDocument = async (id: string) => {
    let collection = await ensureCollection();
    try {
      return collection.documents(id).retrieve();
    } catch (error) {
      return null;
    }
  };

  const deleteDocument = async (id: string) => {
    let collection = await ensureCollection();
    let existing = await getDocument(id);
    if (!existing) return Promise.resolve(null);
    return collection.documents(id).delete();
  };

  const updateDocument = async (id: string, document: TDocument) => {
    let collection = await ensureCollection();
    let existing = await getDocument(id);
    if (!existing) {
      return collection.documents().create(document);
    }
    return collection.documents(id).update(document);
  };

  return {
    collectionName: collectionSchema.name,
    ensureCollection,
    importDocuments,
    deleteDocument,
    updateDocument,
    deleteCollection,
    search,
    vectorSearch,
    _collection: client.collections<TDocument>(collectionSchema.name),
  };
};
