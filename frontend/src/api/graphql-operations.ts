import { gql } from "@apollo/client";

export type SendMessageInput = {
    message: string;
    aiPersonality?: string;
};

export type SendMessageVariables = {
    input: SendMessageInput;
    recipientId: number;
};

export const SEND_MESSAGE = gql`
    mutation SendMessage($input: CreateChatInput!, $recipientId: Int!) {
        sendMessage(input: $input, recipientId: $recipientId) {
            id
            message
            participant {
                id
            }
            roomId
            createdAt
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

export const GET_ALL_USERS = gql`
    query GetAllUsers {
        getAllUsers
    }
`

export const GET_ROOM = gql`
    query GetRoom($recipientId: Int!) {
        getRoom(recipientId: $recipientId)
    }
`

export const GET_MY_ROOMS = gql`
    query GetMyRooms {
        getMyRooms {
            roomId
            recipientId
        }
    }
`

export const GET_MESSAGES = gql`
    query GetMessages($roomId: Int!, $cursor: Int) {
        getMessages(roomId: $roomId, cursor: $cursor) {
            id
            message
            participant {
                id
            }
            createdAt
        }
    }
`

export const GET_AI_USER_ID = gql`
    query GetAiUserId {
        getAiUserId
    }
`

export const SET_AI_PERSONALITY = gql`
    mutation SetAiPersonality($roomId: Int!, $personality: AiPersonality!) {
        setAiPersonality(roomId: $roomId, personality: $personality)
    }
`

export const GET_AI_PERSONALITY_INFO = gql`
    query GetAiPersonalityInfo($roomId: Int!) {
        getAiPersonalityInfo(roomId: $roomId) {
            personality
            canChange
        }
    }
`
