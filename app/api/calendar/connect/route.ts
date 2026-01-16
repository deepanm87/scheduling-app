import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { getGoogleAuthUrl } from "@/lib/google-calendar"

export async function GET() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/")
  }

  const state = Buffer.from(
    JSON.stringify({
      userId,
      timestamp: Date.now()
    })
  ).toString("base64")

  const authUrl = getGoogleAuthUrl(state)

  redirect(authUrl)
}