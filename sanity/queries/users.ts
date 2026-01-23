import { defineQuery } from "next-sanity"
import type {
  USER_WITH_TOKENS_QUERYResult,
  HOST_BY_SLUG_WITH_TOKENS_QUERYResult,
  USER_CONNECTED_ACCOUNTS_DISPLAY_QUERYResult
} from "@/sanity/types"

export type ConnectedAccountWithTokens = NonNullable<NonNullable<USER_WITH_TOKENS_QUERYResult>["connectedAccounts"]>[number]

export type HostWithTokens = NonNullable<HOST_BY_SLUG_WITH_TOKENS_QUERYResult>

export type ConnectedAccountDisplay = NonNullable<
  NonNullable<USER_CONNECTED_ACCOUNTS_DISPLAY_QUERYResult>["connectedAccounts"]
>[number]

export const USER_BY_CLERK_ID_QUERY = defineQuery(`*[
  _type == "user"
  && clerkID == $clerkId
][0]{
  _id,
  _type,
  clerkId,
  name,
  email,
  slug,
  availability[]{
    _key,
    startDateTime,
    endDateTime
  },
  connectedAccounts[]{
    _key,
    accountId,
    email,
    provider,
    isDefault,
    connectedAt
  }
}`)

export const USER_BY_SLUG_QUERY = defineQuery(`*[
  _type == "user"
  && slug.current == $slug
][0]{
  _id,
  _type,
  name,
  email,
  slug,
  availability[]{
    _key,
    startDateTime,
    endDateTime
  }
}`)

export const USER_WITH_TOKENS_QUERY = defineQuery(`*[
  _type == "user"
  && clerkId == $clerkId
][0]{
  _id,
  connectedAccounts[]{
    _key,
    accountId,
    email,
    accessToken,
    refreshToken,
    expiryDate,
    isDefault
  }
}`)

export const USER_ID_BY_ACCOUNT_KEY_QUERY = defineQuery(`*[
  _type == "user"
  && defined(connectedAccounts[_key == $accountKey])
][0]{
  _id
}`)

export const USER_ID_BY_CLERK_ID_QUERY = defineQuery(`*[
  _type == "user"
  && clerkId == $clerkId
][0]{
  _id
}`)

export const USER_WITH_AVAILABILITY_QUERY = defineQuery(`*[
  _type == "user"
  && clerkId == $clerkId
][0]{
  _id,
  availability[]{
    _key,
    startDateTime,
    endDateTime
  }
}`)

export const USER_WITH_CONNECTED_ACCOUNTS_QUERY = defineQuery(`*[
  _type == "user"
  && clerkId == $clerkId
][0]{
  _id,
  connectedAccounts[]{
    accountId
  }
}`)

export const HOST_BY_SLUG_WITH_TOKENS_QUERY = defineQuery(`*[
  _type == "user"
  && slug.current == $slug
][0]{
  _id,
  name,
  email,
  slug,
  availability[]{
    _key,
    startDateTime,
    endDateTime
  },
  connectedAccounts[]{
    _key,
    accountId,
    email,
    accessToken,
    refreshToken,
    expiryDate,
    isDefault
  }
}`)

export const USER_CONNECTED_ACCOUNTS_DISPLAY_QUERY = defineQuery(`*[
  _type == "user"
  && clerkId == $clerkId
][0]{
  connectedAccounts[]{
    _key,
    accountId,
    email,
    isDefault
  }
}`)

export const USER_SLUG_QUERY = defineQuery(`*[
  _type == "user"
  && clerkId == $clerkId
][0]{
  _id,
  name,
  slug
}`)