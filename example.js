import startSystem from "dixlib"

try {
  const start = performance.now()
  const system = await startSystem([])
  console.log("started system", system, "in", performance.now() - start, "ms")
} catch (cause) {
  console.error(new Error("cannot start system", { cause }))
}
