import { ApolloClient, HttpLink, InMemoryCache, split } from '@apollo/client'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { createClient } from 'graphql-ws'
import { useAuthStore } from '../store/auth.store';
import { getMainDefinition } from '@apollo/client/utilities';
// import { setContext } from '@apollo/client/link/context'

// `HttpLink` connects GraphQL HTTP to transfer Query/Mutation via HTTP
const httpLink = new HttpLink({
    uri: `${import.meta.env.VITE_API_URL}/graphql`,
});

// const authLink = setContext((_, { headers }) => ({
//     headers: {
//         ...headers,
//         authorization: `Bearer ${useAuthStore.getState().accessToken}`,
//     },
// }));

// `GraphQLWsLink` responses on Subscription real-time event
const wsLink = new GraphQLWsLink(
    createClient({
        url: `ws://localhost3000/graphql`,
        // Token injection on WebSocket connection for responding to `connectionParams.authorization` validation in `onConnect()`.
        connectionParams: () => ({
            authorization: `Bearer ${useAuthStore.getState().accessToken}`,
        }),
    }),
);

// Link automatic branches based on request type. Branch 1: Subscription => wsLink, Branch 2: Query/Mutation => httpLink
const splitLink = split(
    ({ query }) => {
        // `getMainDefinition` for GraphQL job type determination for branching conditions to distinguish between subscription and query/mutation
        const definition = getMainDefinition(query);
        return (
            definition.kind === 'OperationDefinition' && definition.operation === 'subscription'
        );
    },
    wsLink,
    httpLink,
    // authLink.concat(httpLink),
);

// `InMemoryCache` caches query results for re-request the same query returns from cache without network
export const apolloClient = new ApolloClient({
    link: splitLink,
    cache: new InMemoryCache(),
});
