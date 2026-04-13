/**
 * OpenAPI/Swagger Documentation Route
 * 
 * Serves interactive API documentation using Swagger UI.
 */

import { Router, Response, Request } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

const router = Router();

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load OpenAPI spec
const specPath = path.resolve(__dirname, "../../openapi.yaml");
let openApiSpec: any = null;

try {
    const specContent = fs.readFileSync(specPath, "utf-8");
    openApiSpec = yaml.load(specContent);
} catch (err) {
    console.error("Failed to load OpenAPI spec:", err);
}

/**
 * GET /docs
 * Serves Swagger UI HTML
 */
router.get("/", (req: Request, res: Response) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AniCrawl CMS API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; background: #fafafa; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { font-size: 32px; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: "/docs/openapi.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        persistAuthorization: true,
        tryItOutEnabled: true
      });
    };
  </script>
</body>
</html>
  `.trim();

    res.type("html").send(html);
});

/**
 * GET /docs/openapi.json
 * Returns OpenAPI spec as JSON
 */
router.get("/openapi.json", (req: Request, res: Response) => {
    if (!openApiSpec) {
        return res.status(500).json({ error: "OpenAPI spec not loaded" });
    }

    // Update server URL based on request
    const spec = { ...openApiSpec };
    const protocol = req.protocol;
    const host = req.get("host");
    spec.servers = [{ url: `${protocol}://${host}`, description: "Current server" }];

    res.json(spec);
});

/**
 * GET /docs/openapi.yaml
 * Returns OpenAPI spec as YAML
 */
router.get("/openapi.yaml", (req: Request, res: Response) => {
    if (!openApiSpec) {
        return res.status(500).json({ error: "OpenAPI spec not loaded" });
    }
    res.type("yaml").send(yaml.dump(openApiSpec));
});

export default router;
