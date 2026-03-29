import express from "express";
import rateLimit from "express-rate-limit";
import winston from "winston";
import expressWinston from "express-winston";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import compression from "compression";
import axios from "axios";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", "..", "..", ".env") });

const app = express();
const port = parseInt(process.env.PORT || "4000", 10);

const args = process.argv.map((arg) => arg.trim());
function getArgValue(arg: string): string | undefined {
  const i = args.indexOf(arg);
  if (i === -1) return;
  return args[i + 1];
}

const backend =
  getArgValue("--backend") === undefined
    ? process.env.BACKEND_URL || process.env.HOST_URL
    : getArgValue("--backend");

app.use(
  expressWinston.logger({
    transports: [new winston.transports.Console()],
    format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    meta: false,
    msg: "HTTP {{req.method}} {{req.url}} {{res.statusCode}}",
    expressFormat: false,
    colorize: true,
    metaField: null,
  })
);
app.use(compression());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
const pageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", apiLimiter);

app.use(express.static("public"));

if (backend) {
  console.log(`Backend for api calls: ${backend}`);
  app.use(express.json());
  app.use("/api*", (req, res) => {
    const forwardUrl = backend + req.originalUrl;
    console.log(`Calling backend ${forwardUrl}`);
    const headers = Object.assign({}, req.headers) as Record<string, string>;
    delete headers.host;
    delete headers.referer;
    axios({
      method: req.method,
      url: forwardUrl,
      responseType: "stream",
      headers,
      data: req.body,
    })
      .then((response) => {
        res.status(response.status);
        res.set(response.headers as Record<string, string>);
        response.data.pipe(res);
      })
      .catch((error) => {
        if (error.response) {
          res.status(error.response.status);
          res.set(error.response.headers);
          error.response.data.pipe(res);
        } else if (error.request) {
          res.status(418).end();
        } else {
          console.error("Error", error.message);
          res.status(418).end();
        }
      });
  });
} else {
  console.log("No backend supplied for api calls, not going to handle api requests");
}

app.get("*", pageLimiter, function (request, response) {
  if (request.path.includes("/map") && request.path.includes(".png")) {
    response.sendStatus(404);
  } else {
    response.sendFile(path.resolve("public", "index.html"));
  }
});

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
