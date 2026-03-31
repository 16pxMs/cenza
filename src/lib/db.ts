type DBResult<T> = {
  data: T | null
  error: string | null
}

export async function dbWrite<T>(
  query: Promise<{ data: T | null; error: unknown }>
): Promise<DBResult<T>> {
  const { data, error } = await query

  if (error) {
    console.error('DB WRITE ERROR:', error)

    return {
      data: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }

  return { data, error: null }
}