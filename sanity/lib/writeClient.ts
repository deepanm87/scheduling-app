import { createClient } from "next-sanity"
import { apiVersion, dataset, projectId } from "../env"

export const writeClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token: process.env.SANITY_API_TOKEN
})

if (!writeClient.config().token) {
  console.warn("Warning: SANITY_API_TOKEN is not set. Write operations will fail.")
}