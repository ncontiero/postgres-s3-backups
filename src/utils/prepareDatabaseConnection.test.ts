import { describe, expect, test } from "bun:test";
import { prepareDatabaseConnection } from "./prepareDatabaseConnection";

describe("prepareDatabaseConnection", () => {
  test("moves a percent-encoded password out of the connection string", () => {
    const result = prepareDatabaseConnection(
      "postgresql://user:p%40ss@host:5432/database?sslmode=require",
    );

    expect(result).toEqual({
      connectionString: "postgresql://user@host:5432/database?sslmode=require",
      password: "p@ss",
    });
  });

  test("moves a query password out of the connection string", () => {
    const result = prepareDatabaseConnection(
      "postgresql://user:ignored@host/database?password=query%20secret&sslmode=require",
    );

    expect(result).toEqual({
      connectionString: "postgresql://user@host/database?sslmode=require",
      password: "query secret",
    });
  });

  test("preserves a connection string without a password", () => {
    const result = prepareDatabaseConnection(
      "postgresql://user@host/database?sslmode=require",
    );

    expect(result).toEqual({
      connectionString: "postgresql://user@host/database?sslmode=require",
      password: undefined,
    });
  });
});
