import { ApolloClient, HttpLink, InMemoryCache, split } from '@apollo/client'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { createClient } from 'graphql-ws'
import { useAuthStore } from '../store/auth.store';
import { getMainDefinition } from '@apollo/client/utilities';
import { SetContextLink } from '@apollo/client/link/context'
import { ErrorLink } from '@apollo/client/link/error'
import { CombinedGraphQLErrors } from '@apollo/client/errors'
import { Observable } from 'rxjs'
import api from './axios';

// `HttpLink` connects GraphQL HTTP to transfer Query/Mutation via HTTP
const httpLink = new HttpLink({
    uri: `${import.meta.env.VITE_API_URL}/graphql`,
    headers: {
        // Without below contents, the Apollo CSRF sends 'BAD_REQUEST' and block the request.
        // By setting json as safe content type, the request can pass the Apollo CSRF defense.
        'content-type': 'application/json',
        // Indirect the header authentication Apollo CSRF by forcing the browser to send request over prior the Preflight OPTIONS.
        'apollo-require-preflight': 'true',
    },
});

const errorLink = new ErrorLink(({ error, operation, forward }) => {
    if (CombinedGraphQLErrors.is(error) &&
        error.errors.some(e => e.extensions?.['code'] === 'UNAUTHENTICATED')) {
        return new Observable((observer) => {
            const { refreshToken, setTokens, userId } = useAuthStore.getState()

            api.post('/auth/token/refreshaccess', null, {
                headers: { Authorization: `Bearer ${refreshToken}` },
            })
                .then(({ data }) => {
                    setTokens(data.accessToken, refreshToken!, userId!)
                    operation.setContext(({ headers = {} }) => ({
                        headers: { ...headers, authorization: `Bearer ${data.accessToken}` },
                    }))
                    forward(operation).subscribe(observer)
                })
                .catch(() => {
                    useAuthStore.getState().clearTokens()
                    observer.error(new Error('Session expired. Please sign in again.'))
                })
        })
    }
})

const authLink = new SetContextLink((prevContext) => ({
    headers: {
        ...prevContext['headers'],
        authorization: `Bearer ${useAuthStore.getState().accessToken}`,
    },
}));

// `GraphQLWsLink` responses on Subscription real-time event
const wsLink = new GraphQLWsLink(
    createClient({
        url: `${import.meta.env.VITE_WS_URL}/graphql`,
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
    errorLink.concat(authLink).concat(httpLink),
);

// `InMemoryCache` caches query results for re-request the same query returns from cache without network
export const apolloClient = new ApolloClient({
    link: splitLink,
    cache: new InMemoryCache(),
});
