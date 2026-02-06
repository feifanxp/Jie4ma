import fs from "fs/promises";
import { Signer } from "@volcengine/openapi";

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env ${name}`);
  }
  return value;
};

const loadConfig = async (path) => {
  const raw = await fs.readFile(path, "utf-8");
  return JSON.parse(raw);
};

const main = async () => {
  const configPath = process.env.FC_CONFIG || "volc-fc/deploy-config.json";
  const config = await loadConfig(configPath);

  const accessKeyId = requiredEnv("VOLC_ACCESSKEY");
  const secretKey = requiredEnv("VOLC_SECRETKEY");

  const host = process.env.VOLC_HOST || config.host || "open.volcengineapi.com";
  const service = process.env.VOLC_SERVICE || config.service || "vefaas";
  const region = process.env.VOLC_REGION || config.region || "cn-beijing";

  const action = config.action;
  const version = config.version;
  if (!action || !version) {
    throw new Error("Missing action/version in deploy-config.json");
  }

  const body = JSON.stringify(config.body || {});
  const request = {
    region,
    method: "POST",
    params: { Action: action, Version: version },
    headers: {
      "Content-Type": "application/json",
      Host: host,
    },
    body,
  };

  const signer = new Signer(request, service);
  signer.addAuthorization({ accessKeyId, secretKey, sessionToken: "" });

  const url = new URL(`https://${host}/`);
  url.searchParams.set("Action", action);
  url.searchParams.set("Version", version);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: request.headers,
    body,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAPI failed: ${response.status} ${text}`);
  }
  console.log(text);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
