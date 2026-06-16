import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { ApolloLink } from '@apollo/client/link';
import { SetContextLink } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { Observable } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import { useAuthStore } from '../store/auth.store';
import api from './axios';

const httpLink = new HttpLink({
    uri: `${import.meta.env.VITE_API_URL}/graphql`,
});

const errorLink = new ErrorLink(({ error, operation, forward }) => {
    if (
        CombinedGraphQLErrors.is(error) &&
        error.errors.some((e) => e.extensions?.['code'] === 'UNAUTHENTICATED')
    ) {
        return new Observable<ApolloLink.Result>((observer) => {
            api.post('/auth/token/refreshaccess')
                .then(({ data }) => {
                    const { sub, role } = jwtDecode<{ sub: number; role: number }>(data.accessToken);
                    useAuthStore.getState().setTokens(data.accessToken, sub, role);
                    operation.setContext(({ headers = {} }) => ({
                        headers: { ...headers, authorization: `Bearer ${data.accessToken}` },
                    }));
                    forward(operation).subscribe(observer);
                })
                .catch(() => {
                    useAuthStore.getState().clearTokens();
                    window.location.replace('/');
                });
        });
    }
});

const authLink = new SetContextLink((prevContext) => ({
    headers: {
        ...prevContext['headers'],
        'content-type': 'application/json',
        'apollo-require-preflight': 'true',
        authorization: `Bearer ${useAuthStore.getState().accessToken}`,
    },
}));

export const apolloClient = new ApolloClient({
    link: errorLink.concat(authLink).concat(httpLink),
    cache: new InMemoryCache(),
});
