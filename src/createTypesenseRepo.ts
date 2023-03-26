import { Client } from "typesense";
import {
  SearchCriteria,
  TypeSenseCollectionDocument,
  TypesenseCollectionSchema,
} from "./typesense.types";
import {
  DEFAULT_TOKEN_SEPARATORS,
  parseResponseFacets,
  toFieldsArray,
  toSearchParams,
} from "./typesense.utils";

export const createTypesenseRepo = <const TSchema extends TypesenseCollectionSchema>(
  client: Client,
  collectionSchema: TSchema
) => {
  type TDocument = TypeSenseCollectionDocument<TSchema["fields"]>;

  const ensureCollection = async () => {
  console.log("default headers in ensureCollection", client.apiCall.defaultHeaders());
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

    } catch(err:any) {
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
    return collection
      .documents()
      .import(documents, {
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
    if (!existing)  {
      return collection.documents().create(document);
    }
    return collection.documents(id).update(document);
  };

  return {
    ensureCollection,
    importDocuments,
    deleteDocument,
    updateDocument,
    deleteCollection,
    search,
    _collection: client.collections<TDocument>(collectionSchema.name)
  };
};
