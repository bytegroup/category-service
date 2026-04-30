import {ApolloServer} from "@apollo/server";
import {categoryTypeDefs} from "@/graphql/schemas/category.schema";
import {categoryResolvers} from "@/graphql/resolvers/category.resolver";
import {logger} from "@/utils/logger";
import {fieldExtensionsEstimator, getComplexity, simpleEstimator} from "graphql-query-complexity";
import depthLimit from 'graphql-depth-limit';

const MAX_QUERY_DEPTH = 7;
const MAX_QUERY_COMPLEXITY = 250;
export interface GraphQLContext {
  requestId: string | undefined;
  categoryLoader: any; // Or your specific loader type
}

export function createApolloServer(): ApolloServer<GraphQLContext> {
  const server = new ApolloServer<GraphQLContext>({
    typeDefs: categoryTypeDefs,
    resolvers: categoryResolvers,

    // [NEW] Validation rules: depth limit applied at parse time
    validationRules: [depthLimit(MAX_QUERY_DEPTH)],

    plugins: [
      // [NEW] Complexity plugin — runs after parsing, before execution
      {
        requestDidStart: async () => ({
          didResolveOperation: async ({ request, document, schema }: any) => {
            const complexity = getComplexity({
              schema,
              operationName: request.operationName,
              query: document,
              variables: request.variables,
              estimators: [
                fieldExtensionsEstimator(),
                simpleEstimator({ defaultComplexity: 1 }),
              ],
            });

            logger.debug('Query complexity', { complexity, max: MAX_QUERY_COMPLEXITY });

            if (complexity > MAX_QUERY_COMPLEXITY) {
              throw new Error(
                `Query complexity ${complexity} exceeds maximum allowed complexity of ${MAX_QUERY_COMPLEXITY}. Simplify your query.`
              );
            }
          },
        }),
      },
    ],

    formatError: (formattedError, _error) => {
      logger.error('GraphQL error', {
        message: formattedError.message,
        code: formattedError.extensions?.code,
        path: formattedError.path,
      });

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