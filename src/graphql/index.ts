import {ApolloServer} from "@apollo/server";
import {categoryTypeDefs} from "@/graphql/schemas/category.schema";
import {categoryResolvers} from "@/graphql/resolvers/category.resolver";
import {logger} from "@/utils/logger";

export function createApolloServer(): ApolloServer {
    const server = new ApolloServer({
        typeDefs: categoryTypeDefs,
        resolvers: categoryResolvers,
        formatError: (formattedError, error) => {
            logger.error('GraphQL error', {
                message: formattedError.message,
                code: formattedError.extensions?.code,
                path: formattedError.path,
            });

            // In production, hide internal error details
            if (
                process.env.NODE_ENV === 'production' &&
                formattedError.extensions?.code === 'INTERNAL_ERROR'
            ) {
                return {
                    message: 'An internal server error occurred',
                    extensions: { code: 'INTERNAL_ERROR', statusCode: 500 },
                };
            }

            return formattedError;
        },
        introspection: process.env.NODE_ENV !== 'production',
    });

    return server;
}