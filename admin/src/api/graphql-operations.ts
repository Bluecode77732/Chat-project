import { gql } from '@apollo/client';

export const GET_ALL_ROOMS = gql`
  query GetAllRooms {
    getAllRooms {
      roomId
      participantIds
    }
  }
`;

export const DELETE_ROOM = gql`
  mutation DeleteRoom($roomId: Int!) {
    deleteRoom(roomId: $roomId)
  }
`;
