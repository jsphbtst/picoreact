Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url)
    let path = url.pathname

    if (path === '/') path = '/index.html'

    const file = Bun.file('./frontend' + path)
    return new Response(file)
  }
})

console.log('Server running at http://localhost:3000')
