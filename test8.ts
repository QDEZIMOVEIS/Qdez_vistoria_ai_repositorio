async function test() {
  const headers = new Headers();
  headers.append("x-goog-api-key", "YOUR_API_KEY");
  const requestInit = { headers };
  const newRequestInit = Object.assign({}, requestInit, { method: "POST" });
  console.log(newRequestInit.headers instanceof Headers);
  console.log(newRequestInit.headers.get("x-goog-api-key"));
}

test();
