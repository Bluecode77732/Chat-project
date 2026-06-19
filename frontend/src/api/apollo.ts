import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client'
import { ApolloLink } from '@apollo/client/link'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { createClient } from 'graphql-ws'
import { useAuthStore } from '../store/auth.store';
import { getMainDefinition } from '@apollo/client/utilities';
import { SetContextLink } from '@apollo/client/link/context'
import { ErrorLink } from '@apollo/client/link/error'
import { CombinedGraphQLErrors } from '@apollo/client/errors'
import { Observable } from 'rxjs'
import { refreshAccessTokenSafely } from '../auth/session-guard'

const httpLink = new HttpLink({
    uri: `${import.meta.env.VITE_API_URL}/graphql`,
});

const errorLink = new ErrorLink(({ error, operation, forward }) => {
    if (CombinedGraphQLErrors.is(error) &&
        error.errors.some(e => e.extensions?.['code'] === 'UNAUTHENTICATED')) {
        return new Observable<ApolloLink.Result>((observer) => {
            refreshAccessTokenSafely().then((accessToken) => {
                if (!accessToken) return
                operation.setContext(({ headers = {} }) => ({
                    headers: { ...headers, authorization: `Bearer ${accessToken}` },
                }))
                forward(operation).subscribe(observer)
            })
        })
    }
})

const authLink = new SetContextLink((prevContext) => ({
    headers: {
        ...prevContext['headers'],
        'content-type': 'application/json',
        'apollo-require-preflight': 'true',
        authorization: `Bearer ${useAuthStore.getState().accessToken}`,
    },
}));

const wsLink = new GraphQLWsLink(
    createClient({
        url: `${import.meta.env.VITE_WS_URL}/graphql`,
        retryAttempts: 5,
        connectionParams: async () => {
            let { accessToken } = useAuthStore.getState();

            if (!accessToken) {
                accessToken = await refreshAccessTokenSafely();
            }

            return { authorization: `Bearer ${accessToken ?? ''}` };
        },
    }),
);

const splitLink = ApolloLink.split(
    ({ query }) => {
        const definition = getMainDefinition(query);
        return (
            definition.kind === 'OperationDefinition' && definition.operation === 'subscription'
        );
    },
    wsLink,
    errorLink.concat(authLink).concat(httpLink),
);

export const apolloClient = new ApolloClient({
    link: splitLink,
    cache: new InMemoryCache(),
});
