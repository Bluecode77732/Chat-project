import { gql } from '@apollo/client';

export const GET_ALL_ROOMS = gql`
  query GetAllRooms($page: Int, $take: Int, $sort: String, $sortBy: String) {
    getAllRooms(page: $page, take: $take, sort: $sort, sortBy: $sortBy) {
      data {
        roomId
        participantIds
        created
      }
      total
      page
      take
    }
  }
`;

export const DELETE_ROOM = gql`
  mutation DeleteRoom($roomId: Int!) {
    deleteRoom(roomId: $roomId)
  }
`;

export const GET_USER_NICKNAMES = gql`
  query GetUserNicknames {
    getUserNicknames {
      id
      nickname
    }
  }
`;
