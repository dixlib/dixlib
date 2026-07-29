import type { IncomingHttpHeaders } from "node:http"
import type { SecureServerOptions, ServerHttp2Stream } from "node:http2"
import { createSecureServer } from "node:http2"

import certificate from "./unsafe-test-certificate.pem"
import privateKey from "./unsafe-test-private-key.pem"

export default 42

// ----------------------------------------------------------------------------------------------------------------- //
const serverOptions = { key: privateKey, cert: certificate } as SecureServerOptions

const server = createSecureServer(serverOptions)

server.on("error", err => console.error(err))

server.on("stream", (stream: ServerHttp2Stream, headers: IncomingHttpHeaders) => {
  // stream is a Duplex
  stream.respond({
    "content-type": "text/html; charset=utf-8",
    ":status": 200,
  })
  stream.end("<h1>Hello World</h1>")
  console.log(headers)
  console.log(headers[":path"])
  console.log(headers[":method"])
})

server.listen(8443)
