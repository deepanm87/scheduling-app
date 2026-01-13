import type { SchemaTypeDefinition } from 'sanity'
import { userType } from './userType'
import { meetingType } from './meetingType'
import { availabilitySlotType } from './availabilitySlotType'
import { connectedAccountType } from './connectedAccountType'
import { bookingType } from './bookingType'
import { feedbackType } from './feedbackType'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [
    userType,
    meetingType,
    availabilitySlotType,
    connectedAccountType,
    bookingType,
    feedbackType
  ],
}
