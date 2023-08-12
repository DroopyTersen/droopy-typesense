# droopy-typesense

Enhances your experience with Typesense Node SDK by providing better type inference when querying and importing documents.

**Key Features**

- Simplified Typesense `Client` creation.
- Enhanced type inference for improved code completion and error checking when working with a Typesense `Collection`

**Table of Contents**

- [Installation](#installation)
- [createTypesenseCollection](#createtypesensecollection)
  - [Params](#params)
  - [Returns](#returns)
  - [Defining a Schema](#defining-a-schema)
    - [Fields](#fields)
    - [An `id` field is required](#an-id-field-is-required)
- [createTypesenseClient](#createtypesenseclient)
  - [Configuration Object](#configuration-object)
  - [Usage](#usage)
- [Full Usage Example](#full-usage-example)

## Installation

```
npm install droopy-typesense
```

```
yarn add droopy-typesense
```

## createTypesenseCollection

The `createTypesenseCollection` function is a factory function that creates a repository object for interacting with a Typesense collection.

The function takes a Typesense client instance and a collection schema as its arguments and returns an object with methods for creating, updating, deleting, and searching documents in the collection.

It safely ensures the collection exists, creating it if it does not.

```ts
import { createTypesenseCollection } from "droopy-typesense";

let bookmarks = createTypesenseCollection(
  createTypesenseClient({
    apiKey: process.env.TYPESENSE_API_KEY,
    url: process.env.TYPESENSE_URL,
  }),
  {
    name: "bookmarks",
    fields: {
      id: {
        type: "string",
      },
      title: {
        type: "string",
        facet: false,
      },
      description: {
        type: "string",
        facet: false,
      },
      host: {
        type: "string",
        facet: true,
      },
      url: {
        type: "string",
        index: false,
      },
    },
  }
);
// Import documents
let bookmarksFromDb = await getAllBookmarksFromDB();
await bookmarks.importDocuments(bookmarksFromDb);

// Search documents
let searchResults = await bookmarks.search({
  q: "typesense",
  facets: ["host"],
});
```

### Params

- `client`: An instance of the Typesense `Client`. You can create a Typesense client using the `createTypesenseClient` or with the Typesense SDK's `new Client()` constructor.
- `collectionSchema`: A schema defining the structure of the collection, including its name and fields. **This is where all the type inference will come from.**

### Returns

The function returns an object with the following methods:

| Method           | Description                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| ensureCollection | Ensures the collection exists. If it doesn't, the collection is created with the provided schema.         |
| importDocuments  | Imports documents into the collection. Takes an array of documents as its argument.                       |
| deleteDocument   | Deletes a document by its ID.                                                                             |
| deleteDocuments  | Deletes documents based on filter criteria                                                                |
| updateDocument   | Updates a document by its ID. If the document doesn't exist, it creates a new one with the provided data. |
| deleteCollection | Deletes the entire collection.                                                                            |
| search           | Searches the collection using search criteria.                                                            |
| \_collection     | The underlying Typesense collection object.                                                               |

### Defining a Schema

A `TypesenseCollectionSchema` is an object that describes the structure of a collection in Typesense. It includes properties like the collection name, fields, and default sorting field.

#### Fields

The `fields` property in the schema is an object that defines the fields and their properties for the documents in the collection. Each key in the `fields` object represents a field in the document. The value of each key is another object containing the properties for that field.

Each field object can have the following properties:

| Field | Description                                                                                                                                                                                                             |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| type  | (Required) The Typesense data type of the field.                                                                                                                                                                        |
| facet | (Optional, default=`false`) A boolean value that indicates whether the field should be faceted or not. If set to `true`, Typesense can return facet counts for this field in search results.                            |
| sort  | (Optional, default=`false`) A boolean value that indicates whether the field can be used for sorting search results. If set to `true`, Typesense allows sorting by this field.                                          |
| index | (Optional) A boolean value that indicates whether the field should be indexed for searching. If set to `false`, Typesense will not index the field, and it won't be searchable. If not provided, it defaults to `true`. |

#### An `id` field is required

When defining a `TypesenseCollectionSchema`, you must include an `id` field. Typesense uses this for direct document retrieval. You can't search by this field.

## createTypesenseClient

The `createTypesenseClient` function is a utility function that helps you easily create a new Typesense client instance by providing the required configuration. The function takes a configuration object as its argument and returns a new instance of the Typesense client.

Once you have the Typesense `Client` instance, you can use it to interact with the Typesense server by performing various actions such as creating, updating, or deleting collections, and searching documents.

### Configuration Object

- `apiKey`: The API key to authenticate your requests to the Typesense server.
- `url`: The URL of the Typesense server, including protocol, hostname, and port number.

```ts
type TypesenseConfig = {
  apiKey: string;
  url: string;
};
```

### Usage

```ts
import { createTypesenseClient } from "droopy-typesense";

const config = {
  apiKey: "your-api-key",
  url: "https://your-typesense-server.com",
};

const client = createTypesenseClient(config);
```

## Full Usage Example

This example shows you you can create dyanmic Typesense collections but use a shared Fields schema.

```ts
export const bookmarkSearchFields = {
  id: {
    type: "string",
    facet: false,
    sort: false,
  },
  title: {
    type: "string",
    facet: false,
    sort: false,
  },
  description: {
    type: "string",
    facet: false,
    sort: false,
  },
  text: {
    type: "string",
    facet: false,
    sort: false,
  },
  host: {
    type: "string",
    facet: true,
    sort: false,
  },
  createdBy: {
    type: "string",
    facet: true,
    sort: true,
  },
  createdAt: {
    type: "int64",
    facet: false,
    sort: true,
  },
  image: {
    type: "string",
    facet: false,
    sort: false,
    index: false,
  },
  url: {
    type: "string",
    facet: false,
    sort: false,
    index: false,
  },
} satisfies TypesenseFieldsSchema;

const getCollectionName = (collectionId: string) => `bookmarks_${collectionId}`;

export const createSearchService = (collectionId: string) => {
  const schema = {
    name: getCollectionName(collectionId),
    fields: bookmarkSearchFields,
    default_sorting_field: "createdAt",
  } satisfies TypesenseCollectionSchema;
  let client = createTypesenseClient({
    apiKey: getEnvVar("TYPESENSE_API_KEY"),
    url: getEnvVar("TYPESENSE_URL"),
  });
  let bookmarks = createTypesenseClient(client, schema);
  return {
    bookmarks,
  };
};

type BookmarkFromDb =
  GetBookmarksByCollectionForSearchImportQuery["bookmarks"][number];
export type BookmarkSearchDocument = TypeSenseCollectionDocument<
  typeof bookmarkSearchFields
>;

export const fullCrawlForCollection = async (collectionId: string) => {
  let adminClient = createAdminGqlClient();
  let data = await adminClient.request(
    GetBookmarksByCollectionForSearchImportDocument,
    {
      collectionId,
    }
  );
  let searchService = await createSearchService(collectionId);
  await searchService.bookmarks.deleteCollection();
  await importSearchDocuments(collectionId, data.bookmarks);
  let results = await searchService.bookmarks.search({
    per_page: 1,
  });

  return {
    found: results.found,
    out_of: results.out_of,
  };
};

export const importSearchDocuments = async (
  collectionId: string,
  bookmarks: BookmarkFromDb[]
) => {
  let searchDocs = bookmarks
    ?.map(toTypesenseDocument)
    .filter(Boolean) as BookmarkSearchDocument[];
  let searchService = await createSearchService(collectionId);
  if (searchDocs?.length) {
    await searchService.bookmarks.importDocuments(searchDocs);
  }
};

const toTypesenseDocument = (
  dbItem: BookmarkFromDb
): BookmarkSearchDocument | null => {
  try {
    let url = new URL(dbItem.url);

    let document: BookmarkSearchDocument = {
      id: dbItem.id,
      title: dbItem.title || "",
      description: dbItem.description || "",
      text: dbItem.text || "",
      host: url.host,
      createdBy: dbItem.createdBy?.name || dbItem.createdBy?.email || "",
      createdAt: dayjs(dbItem.createdAt).unix(),
      url: dbItem.url,
      image: dbItem.image || "",
    };

    return document;
  } catch (err: any) {
    console.log("🚀 | toTypesenseDocument | err", err.message);
    console.log(JSON.stringify(dbItem, null, 2));
    return null;
  }
};

export const BookmarkSearchCriteriaSchema = z.object({
  q: z.string().optional(),
  host: z.string().optional(),
  sort: z.string().optional(),
  page: z.coerce.number().optional(),
});

export type BookmarkSearchCriteria = z.infer<
  typeof BookmarkSearchCriteriaSchema
>;

export const searchBookmarks = async (
  collectionId: string,
  criteria: BookmarkSearchCriteria
) => {
  let searchService = await createSearchService(collectionId);
  let searchResults = await searchService.bookmarks.search({
    q: criteria.q,
    page: criteria.page || 1,
    per_page: 20,
    filter: {
      host: criteria.host || undefined,
    },
  });

  return searchResults;
};
```
