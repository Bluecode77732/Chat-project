import { gql } from "@apollo/client";

export const SEND_MESSAGE = gql`
    mutation SendMessage($input: CreateChatInput!, $recipientId: Int!) {
        sendMessage(input: $input, recipientId: $recipientId) {
            id
            message
            participant {
                id
            }
            roomId
        }
    }
`

export const RECEIVE_MESSAGE = gql`
    subscription ReceiveMessage($roomId: ID!) {
        receiveMessage(roomId: $roomId) {
            id
            message
            participant {
              id
            }
        }
    }
`

export const GET_ONLINE_USERS = gql`
    query GetOnlineUser {
        getOnlineUser
    }
`
