import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

const publicDir = path.resolve(process.cwd(), "public");
const port = Number(process.env.PORT ?? 4174);

const contentTypeByExt = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8"
};

createServer(async (req, res) => {
  try {
    const reqPath = req.url === "/" ? "/index.html" : req.url ?? "/index.html";
    const filePath = path.join(publicDir, reqPath);
    const data = await readFile(filePath);
    const ext = path.extname(filePath);

    res.writeHead(200, {
      "content-type": contentTypeByExt[ext] ?? "application/octet-stream"
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`[fun-fun-cloth/web] listening on ${port}`);
});
