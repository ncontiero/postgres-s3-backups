interface DatabaseConnection {
  connectionString: string;
  password?: string;
}

export function prepareDatabaseConnection(
  databaseUrl: string,
): DatabaseConnection {
  const connectionUrl = new URL(databaseUrl);
  const queryPassword = connectionUrl.searchParams.get("password");
  const password =
    queryPassword ??
    (connectionUrl.password
      ? decodeURIComponent(connectionUrl.password)
      : undefined);

  connectionUrl.password = "";
  connectionUrl.searchParams.delete("password");

  return {
    connectionString: connectionUrl.toString(),
    password,
  };
}
