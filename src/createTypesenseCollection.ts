import { Client } from "typesense";

import {
  FilterCriteria,
  MultiSearchRequestSchema,
  MultiSearchResponse,
  SearchCriteria,
  SearchResponseFacets,
  TypeSenseCollectionDocument,
  TypesenseCollectionSchema,
  VectorFieldKeys,
  VectorSearchResult,
} from "./typesense.types";
import {
  DEFAULT_TOKEN_SEPARATORS,
  convertFilterToString,
  parseResponseFacets,
  toFieldsArray,
  toSearchParams,
} from "./typesense.utils";
import {
  ImportResponse,
  SearchResponse,
  SearchResponseHit,
} from "typesense/lib/Typesense/Documents";
import Collection from "typesense/lib/Typesense/Collection";

export type {
  ImportResponse,
  SearchResponse,
  SearchResponseHit,
} from "typesense/lib/Typesense/Documents";
export { default as Collection } from "typesense/lib/Typesense/Collection";

export const createTypesenseCollection = <
  const TSchema extends TypesenseCollectionSchema
>(
  client: Client,
  collectionSchema: TSchema
) => {
  type TDocument = TypeSenseCollectionDocument<TSchema["fields"]>;
  type TCollection = Collection<TypeSenseCollectionDocument<TSchema["fields"]>>;
  type TSearchResponse = SearchResponse<
    TypeSenseCollectionDocument<TSchema["fields"]> & {
      hits: SearchResponseHit<TypeSenseCollectionDocument<TSchema["fields"]>>[];
      facets: SearchResponseFacets<TSchema["fields"]>;
    }
  >;
  const ensureCollection = async (): Promise<TCollection> => {
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
    let collection = client.collections<TDocument>(collectionSchema.name);
    return collection;
  };
  const deleteCollection = async (): Promise<void> => {
    let exists = await client.collections(collectionSchema.name).exists();
    if (exists) {
      await client.collections(collectionSchema.name).delete();
    }
  };

  const importDocuments = async (
    documents: TDocument[]
  ): Promise<ImportResponse[]> => {
    let collection = await ensureCollection();
    let result = collection.documents().import(documents, {
      action: "upsert",
      dirty_values: "coerce_or_drop",
      return_id: true,
    });
    return result;
  };

  const search = async (
    searchCriteria: SearchCriteria<TSchema["fields"]>
  ): Promise<TSearchResponse> => {
    let collection = await ensureCollection();
    let response = await collection
      .documents()
      .search(toSearchParams(searchCriteria, collectionSchema.fields));
    return {
      ...response,
      facets: parseResponseFacets(response),
    } as TSearchResponse;
  };

  const vectorSearch = async ({
    field,
    vector,
    searchCriteria,
  }: {
    /** The vector field name to query */
    field: VectorFieldKeys<TSchema["fields"]>;
    /** The vector/embedding */
    vector: number[];
    searchCriteria?: SearchCriteria<TSchema["fields"]>;
  }) => {
    const vectorDefaults: SearchCriteria<TSchema["fields"]> = {
      queryBy: {},
      q: "*",
    };
    let searchParams = toSearchParams(
      {
        ...vectorDefaults,
        ...searchCriteria,
      },
      collectionSchema.fields
    );
    let vectorQueryParams: MultiSearchRequestSchema = {
      collection: collectionSchema.name,
      vector_query: `${(field as string) + ""}:([${vector.join(",")}])`,
      ...searchParams,
    };
    console.log("🚀 | vectorQueryParams:", vectorQueryParams);
    let response = await client.multiSearch.perform({
      searches: [vectorQueryParams],
    });
    console.log("🚀 | response:", response);

    return response?.results?.[0] as VectorSearchResult<TDocument>;
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

  const deleteDocuments = async (
    deleteQuery: FilterCriteria<TSchema["fields"]>
  ) => {
    let collection = await ensureCollection();
    let filterStr = convertFilterToString(deleteQuery);
    if (!filterStr) {
      return Promise.resolve(null);
    }
    return collection.documents().delete(filterStr);
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
    _collection: client.collections<TDocument>(
      collectionSchema.name
    ) as TCollection,
  };
};
