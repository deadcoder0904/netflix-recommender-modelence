type MethodResponse<T> = {
  data: T;
  typeMap: unknown;
};

export async function modelenceCall<T>(methodName: string, args: unknown): Promise<T> {
  const res = await fetch(`/api/_internal/method/${methodName}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ args }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Modelence call failed (${res.status})`);
  }

  const json = (await res.json()) as MethodResponse<T>;
  return json.data;
}
