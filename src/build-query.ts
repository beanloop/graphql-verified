import {GraphQLFieldConfig, GraphQLFieldConfigMap} from 'graphql'
import graphqlRule from 'graphql-rule'

import {Query} from './entities'
import {getType, joiToArgs, joiValidate} from './graphql-helpers'
import {applyReadRules} from './rule-helpers'

/**
 * Builds a graphql query using joi validations to specify (and valdiate) args
 *
 * Example:
 *
 *    const queries = buildQueries(GraphQLString, {
 *      getGreeting: {
 *        validate: {
 *          name: joi.string().default('World'),
 *        },
 *        resolve: (_, {name}) => `Hello, ${name}!`,
 *      },
 *    })
 */
export function buildQueries(queries: {[name: string]: Query}): GraphQLFieldConfigMap {
  const built = {}
  Object.entries(queries).forEach(([name, query]) => {
    built[name] = buildQuery(name, query)
  })
  return built
}

export function buildQuery(name: string, query: Query): GraphQLFieldConfig {
  const args = Object.assign({}, query.args)
  const {builtType, graphQLType} = getType(query.type)

  if (query.validate === undefined && query.resolve.length > 1)
    throw Error(`validate is not specifed for query ${name}, set to false to disable`)

  if (builtType && query.validate) {
    joiToArgs(args, query.validate, builtType)
  }

  return {
    type: graphQLType,
    description: query.description,
    args,
    async resolve(source, args, context, info) {
      if (query.validate) {
        args = await joiValidate(args, query.validate)
      }

      const parent =
        source instanceof graphqlRule.Model
          ? source
          : null

      return applyReadRules(
        builtType,
        await query.resolve(source, args, context, info),
        parent,
        context,
      )
    },
  }
}