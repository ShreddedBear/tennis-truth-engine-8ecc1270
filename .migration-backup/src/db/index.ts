// Table definitions and row types. Safe to import from anywhere, including the browser
// bundle, because nothing here opens a connection -- these are column descriptors and
// TypeScript types.
//
// The connection itself lives in ./client.server, which is server-only.
export * from "./schema";
