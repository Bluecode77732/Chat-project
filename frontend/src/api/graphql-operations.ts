import { gql } from "@apollo/client";

export const SEND_MESSAGE = gql`
mutation SendMessage($input: CreateChatInput!, $recipientId: Int!) {
    sendMessage(input: $input, recipientId: $recipientId) {
        id
        message
        participant {
            id
            email
            role
        }
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
}
`

// "input": {
//     "message": "Sent from Postman",
//         "recipientId": 1,
//             "room": 1
// }
